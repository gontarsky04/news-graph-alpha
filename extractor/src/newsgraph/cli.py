"""Typer entrypoint. Exposed as `newsgraph` via [project.scripts]."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated

import typer

from .logging_setup import configure_logging, get_logger
from .models import InputArticle

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="NewsGraph PoC — extract Polish news entities into Neo4j.",
)
log = get_logger(__name__)


def _load_articles(path: Path) -> list[InputArticle]:
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    if isinstance(payload, dict):
        payload = [payload]
    if not isinstance(payload, list):
        raise typer.BadParameter(f"{path} must contain a JSON object or list of objects")
    return [InputArticle.model_validate(obj) for obj in payload]


@app.command()
def init() -> None:
    """Create constraints, range/fulltext/vector indexes. Idempotent."""
    configure_logging()
    from .schema import all_ddl_statements
    from .storage.neo4j_client import Neo4jClient

    client = Neo4jClient()
    try:
        for stmt in all_ddl_statements():
            try:
                client.execute_write(stmt, {})
                log.info("ddl_ok", stmt=stmt[:120])
            except Exception as exc:  # noqa: BLE001
                log.warning("ddl_failed", stmt=stmt[:120], error=str(exc))
    finally:
        client.close()
    typer.echo("init: done")


@app.command("import")
def import_cmd(
    path: Annotated[Path, typer.Argument(exists=True, readable=True, help="JSON file with article(s)")],
) -> None:
    """Import articles from a JSON file (list or single object)."""
    configure_logging()
    articles = _load_articles(path)
    typer.echo(f"Loaded {len(articles)} article(s) from {path}")
    from .pipeline import run

    stats = run(articles)
    typer.echo(
        "import: done | "
        f"total={stats.articles_total} processed={stats.articles_processed} "
        f"dup_skip={stats.articles_skipped_duplicate} "
        f"created={stats.entities_created} auto_merged={stats.entities_auto_merged} "
        f"llm_merged={stats.entities_llm_merged} "
        f"rels={stats.relationships_written} mentions={stats.mentions_written} "
        f"elapsed_s={stats.elapsed_seconds:.1f}"
    )


@app.command()
def reset(
    yes: Annotated[bool, typer.Option("--yes", "-y", help="Skip confirmation")] = False,
) -> None:
    """DROP all data and recreate indexes."""
    configure_logging()
    if not yes:
        typer.echo("This will DELETE ALL DATA in the Neo4j database.")
        confirm = typer.prompt("Type 'reset' to confirm")
        if confirm.strip() != "reset":
            typer.echo("Aborted.")
            raise typer.Exit(code=1)

    from .schema import all_ddl_statements
    from .storage.neo4j_client import Neo4jClient

    client = Neo4jClient()
    try:
        try:
            client.execute_write(
                "CALL apoc.periodic.iterate("
                "'MATCH (n) RETURN n', "
                "'DETACH DELETE n', "
                "{batchSize: 1000, parallel: false}) "
                "YIELD batches, total RETURN batches, total",
                {},
            )
        except Exception:
            client.execute_write("MATCH (n) DETACH DELETE n", {})
        for stmt in all_ddl_statements():
            try:
                client.execute_write(stmt, {})
            except Exception as exc:  # noqa: BLE001
                log.warning("ddl_failed", stmt=stmt[:120], error=str(exc))
    finally:
        client.close()
    typer.echo("reset: done")


@app.command()
def serve() -> None:
    """Start the gRPC extractor server (ensures indexes, then serves)."""
    from .grpc_server import serve as _serve

    _serve()


@app.command()
def stats() -> None:
    """Print node and relationship counts."""
    configure_logging()
    from .storage.neo4j_client import Neo4jClient

    client = Neo4jClient()
    try:
        s = client.stats()
    finally:
        client.close()
    typer.echo("Nodes:")
    for k, v in sorted(s["nodes"].items()):
        typer.echo(f"  {k}: {v}")
    typer.echo("Relationships:")
    for k, v in sorted(s["relationships"].items()):
        typer.echo(f"  {k}: {v}")


@app.command("debug-link")
def debug_link(
    kind: Annotated[str, typer.Argument(help="Person | Organization | Location | Event | Topic")],
    canonical_name: Annotated[str, typer.Argument(help="Name to resolve")],
) -> None:
    """Show candidate scores for a hypothetical mention (useful for tuning thresholds)."""
    configure_logging()
    from .linking.entity_linker import debug_scores
    from .models import EntityKind
    from .storage.neo4j_client import Neo4jClient

    try:
        ek = EntityKind(kind)
    except ValueError:
        typer.echo(f"Unknown kind: {kind}. Expected one of {[e.value for e in EntityKind]}")
        raise typer.Exit(1)

    client = Neo4jClient()
    try:
        rows = debug_scores(client, ek, canonical_name)
    finally:
        client.close()

    if not rows:
        typer.echo("No candidates.")
        return
    for r in rows:
        typer.echo(json.dumps(r, ensure_ascii=False))


def main() -> None:
    configure_logging()
    try:
        app()
    except Exception:  # noqa: BLE001
        log.exception("cli_failed")
        sys.exit(2)


if __name__ == "__main__":
    main()
