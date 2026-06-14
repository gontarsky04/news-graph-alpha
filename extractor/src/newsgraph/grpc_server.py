"""gRPC server exposing the NewsGraph pipeline as `Extractor.ProcessArticle`.

The Spring backend owns the Article node (status/body/tags/counts) and article
dedup; this service owns extraction + entity linking + writing entities,
relationships and MENTIONS edges to Neo4j.

Generated stubs (`extractor_pb2`, `extractor_pb2_grpc`) are produced from
`proto/extractor.proto` at build time into `newsgraph/grpcgen/` — see the
Dockerfile and `scripts/gen_grpc.sh`.
"""

from __future__ import annotations

import os
import sys
from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

# The generated grpc stub does `import extractor_pb2`, so the gen dir must be on
# sys.path as a flat module location.
_GEN_DIR = os.path.join(os.path.dirname(__file__), "grpcgen")
if _GEN_DIR not in sys.path:
    sys.path.insert(0, _GEN_DIR)

import extractor_pb2  # noqa: E402
import extractor_pb2_grpc  # noqa: E402

from .config import get_settings  # noqa: E402
from .logging_setup import configure_logging, get_logger  # noqa: E402
from .models import InputArticle, PipelineStats  # noqa: E402
from .pipeline import extract_link_persist  # noqa: E402
from .storage.neo4j_client import Neo4jClient  # noqa: E402

log = get_logger(__name__)


class ExtractorServicer(extractor_pb2_grpc.ExtractorServicer):
    """One shared Neo4jClient (driver is thread-safe; a session is opened per
    Cypher call). Each request gets its own PipelineStats."""

    def __init__(self, client: Neo4jClient) -> None:
        self._client = client

    def ProcessArticle(self, request, context):  # noqa: N802 (gRPC naming)
        if not request.article_id:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "article_id is required")
        if not request.text:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "text is required")

        article = InputArticle(
            title=request.title or "",
            url=request.url or None,
            datePublished=request.date_published or None,
            text=request.text,
        )
        stats = PipelineStats()
        try:
            extract_link_persist(self._client, request.article_id, article, stats)
        except Exception as exc:  # noqa: BLE001
            log.exception("process_article_failed", article_id=request.article_id, error=str(exc))
            context.abort(grpc.StatusCode.INTERNAL, f"extraction failed: {exc}")

        return extractor_pb2.ProcessArticleResponse(
            entities_created=stats.entities_created,
            entities_auto_merged=stats.entities_auto_merged,
            entities_llm_merged=stats.entities_llm_merged,
            relationships_written=stats.relationships_written,
            mentions_written=stats.mentions_written,
            elapsed_seconds=stats.elapsed_seconds,
        )


def _init_indexes(client: Neo4jClient) -> None:
    """Create constraints + range/fulltext/vector indexes (idempotent)."""
    from .schema import all_ddl_statements

    for stmt in all_ddl_statements():
        try:
            client.execute_write(stmt, {})
        except Exception as exc:  # noqa: BLE001
            log.warning("ddl_failed", stmt=stmt[:120], error=str(exc))


def _warm_up() -> None:
    """Load the spaCy + MMLW models at boot so the first article doesn't pay the
    cold-start cost (which previously blew the client's gRPC deadline)."""
    from .extraction.preprocessing import preprocess
    from .linking.embeddings import embed_passage

    log.info("warmup_start")
    try:
        preprocess("Rozgrzewka modelu jezykowego.")  # loads pl_core_news_lg
        embed_passage("rozgrzewka")                   # loads MMLW into memory
        log.info("warmup_done")
    except Exception as exc:  # noqa: BLE001
        log.warning("warmup_failed", error=str(exc))


def serve() -> None:
    configure_logging()
    settings = get_settings()
    port = int(os.environ.get("GRPC_PORT", "50051"))
    max_workers = int(os.environ.get("GRPC_MAX_WORKERS", "4"))

    client = Neo4jClient()
    log.info("extractor_boot", neo4j_uri=settings.neo4j_uri, llm_model=settings.llm_model)
    _init_indexes(client)
    _warm_up()

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=max_workers))
    extractor_pb2_grpc.add_ExtractorServicer_to_server(ExtractorServicer(client), server)

    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    # Mark both the named service and overall server as SERVING.
    health_servicer.set("newsgraph.v1.Extractor", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)

    server.add_insecure_port(f"[::]:{port}")
    server.start()
    log.info("extractor_serving", port=port, max_workers=max_workers)
    try:
        server.wait_for_termination()
    finally:
        client.close()


if __name__ == "__main__":
    serve()
