"""Thin wrapper around the official Neo4j driver with the MERGE patterns the
pipeline needs.

Design choices encoded here (see spec §"Zasady implementacji"):

* Article MERGE by `source_text_hash` — dedup is hash-level, not title-level.
* Entity MERGE by `id`. The id is minted either by the linker (new node) or
  re-used (existing node). We never rely on MERGE-by-name.
* On *existing* entity, we only add `surface_form` to `aliases`. We never
  overwrite `canonical_name` or `embedding` (see spec §4, §5).
* Relationship MERGE is keyed by `source_article_id` — i.e. the same fact
  stated in a different article yields a *new* edge (multi-edge), allowing
  downstream queries like "how many sources corroborate X?".
"""

from __future__ import annotations

import hashlib
import uuid
from contextlib import contextmanager
from typing import Any, Iterable

from neo4j import GraphDatabase, ManagedTransaction
from neo4j.exceptions import Neo4jError

from ..config import get_settings
from ..logging_setup import get_logger
from ..models import EntityKind
from ..schema import INDEX_MAP

log = get_logger(__name__)


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def new_id(kind: EntityKind) -> str:
    prefix = INDEX_MAP[kind.value]["id_prefix"]
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def new_article_id() -> str:
    return str(uuid.uuid4())


class Neo4jClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._database = settings.neo4j_database
        self._driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )

    def close(self) -> None:
        self._driver.close()

    # ------------------------------------------------------------------
    # Low-level helpers
    # ------------------------------------------------------------------

    @contextmanager
    def _session(self):
        session = self._driver.session(database=self._database)
        try:
            yield session
        finally:
            session.close()

    def execute_read(self, cypher: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        with self._session() as s:
            return [dict(r) for r in s.run(cypher, **params)]

    def execute_write(self, cypher: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        with self._session() as s:
            return [dict(r) for r in s.run(cypher, **params)]

    def ping(self) -> bool:
        try:
            self.execute_read("RETURN 1 AS ok", {})
            return True
        except Neo4jError:
            return False

    # ------------------------------------------------------------------
    # Article
    # ------------------------------------------------------------------

    def article_exists_by_hash(self, source_text_hash: str) -> str | None:
        rows = self.execute_read(
            "MATCH (a:Article {source_text_hash: $h}) RETURN a.id AS id LIMIT 1",
            {"h": source_text_hash},
        )
        return rows[0]["id"] if rows else None

    def merge_article(
        self,
        *,
        article_id: str,
        title: str,
        url: str | None,
        date_published: str | None,
        source_text_hash: str,
    ) -> str:
        cypher = """
        MERGE (a:Article {source_text_hash: $hash})
        ON CREATE SET
            a.id = $id,
            a.title = $title,
            a.url = $url,
            a.datePublished = CASE WHEN $datePublished IS NULL THEN NULL ELSE date($datePublished) END,
            a.createdAt = datetime()
        RETURN a.id AS id
        """
        rows = self.execute_write(
            cypher,
            {
                "hash": source_text_hash,
                "id": article_id,
                "title": title,
                "url": url,
                "datePublished": date_published,
            },
        )
        return rows[0]["id"]

    # ------------------------------------------------------------------
    # Entity create / alias growth
    # ------------------------------------------------------------------

    def create_entity(
        self,
        kind: EntityKind,
        *,
        entity_id: str,
        canonical_name: str,
        aliases: list[str],
        embedding: list[float],
        extra_props: dict[str, Any],
    ) -> None:
        """Create-or-idempotent-merge an entity by id.

        canonical_name / embedding are written only on CREATE (see spec §4, §5).
        aliases are *always* the order-preserving dedup of existing + incoming.
        """
        label = INDEX_MAP[kind.value]["label"]
        cypher = f"""
        MERGE (n:{label} {{id: $id}})
        ON CREATE SET
            n.canonical_name = $canonical_name,
            n.embedding = $embedding,
            n += $extra,
            n.createdAt = datetime()
        WITH n, coalesce(n.aliases, []) + $aliases AS combined
        WITH n, combined,
             [i IN range(0, size(combined) - 1)
              WHERE combined[i] IS NOT NULL
                AND NOT combined[i] IN combined[0..i]
              | combined[i]] AS deduped
        SET n.aliases = deduped
        """
        self.execute_write(
            cypher,
            {
                "id": entity_id,
                "canonical_name": canonical_name,
                "aliases": aliases,
                "embedding": embedding,
                "extra": extra_props,
            },
        )

    def grow_alias(self, kind: EntityKind, entity_id: str, surface_form: str) -> None:
        """Add `surface_form` to the node's aliases, deduped. Never changes canonical_name."""
        label = INDEX_MAP[kind.value]["label"]
        cypher = f"""
        MATCH (n:{label} {{id: $id}})
        WITH n, coalesce(n.aliases, []) AS existing
        WITH n, existing,
             CASE WHEN $form IN existing OR $form = n.canonical_name
                  THEN existing ELSE existing + $form END AS merged
        SET n.aliases = merged
        """
        self.execute_write(cypher, {"id": entity_id, "form": surface_form})

    # ------------------------------------------------------------------
    # Candidate search
    # ------------------------------------------------------------------

    def fulltext_search(
        self,
        kind: EntityKind,
        query: str,
        top_k: int,
    ) -> list[dict[str, Any]]:
        index_name = INDEX_MAP[kind.value]["fulltext"]
        cypher = """
        CALL db.index.fulltext.queryNodes($index, $q, {limit: $k})
        YIELD node, score
        RETURN node.id AS id,
               node.canonical_name AS canonical_name,
               coalesce(node.aliases, []) AS aliases,
               coalesce(node.role, null) AS role,
               score AS score
        """
        return self.execute_read(
            cypher, {"index": index_name, "q": query, "k": top_k}
        )

    def vector_search(
        self,
        kind: EntityKind,
        embedding: list[float],
        top_k: int,
    ) -> list[dict[str, Any]]:
        index_name = INDEX_MAP[kind.value]["vector"]
        cypher = """
        CALL db.index.vector.queryNodes($index, $k, $vec)
        YIELD node, score
        RETURN node.id AS id,
               node.canonical_name AS canonical_name,
               coalesce(node.aliases, []) AS aliases,
               coalesce(node.role, null) AS role,
               score AS score
        """
        return self.execute_read(
            cypher, {"index": index_name, "k": top_k, "vec": embedding}
        )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    def merge_relationship(
        self,
        *,
        rel_type: str,
        from_label: str,
        from_id: str,
        to_label: str,
        to_id: str,
        source_article_id: str,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        """MERGE a typed relationship keyed by source_article_id (multi-edge per article)."""
        attributes = attributes or {}
        cypher = f"""
        MATCH (a:{from_label} {{id: $from_id}})
        MATCH (b:{to_label} {{id: $to_id}})
        MERGE (a)-[r:{rel_type} {{source_article_id: $aid}}]->(b)
        ON CREATE SET r.extracted_at = datetime(), r += $attrs
        ON MATCH SET r += $attrs
        """
        self.execute_write(
            cypher,
            {
                "from_id": from_id,
                "to_id": to_id,
                "aid": source_article_id,
                "attrs": attributes,
            },
        )

    def merge_mentions(
        self,
        *,
        article_id: str,
        mentions: Iterable[tuple[str, str, float]],
    ) -> int:
        """Bulk MERGE (:Article)-[:MENTIONS {salience}]->(:Entity).

        `mentions` yields tuples of (label, entity_id, salience).
        """
        count = 0
        for label, entity_id, salience in mentions:
            cypher = f"""
            MATCH (a:Article {{id: $aid}})
            MATCH (n:{label} {{id: $nid}})
            MERGE (a)-[r:MENTIONS {{source_article_id: $aid}}]->(n)
            ON CREATE SET r.extracted_at = datetime(), r.salience = $sal
            ON MATCH SET r.salience = $sal
            """
            self.execute_write(
                cypher, {"aid": article_id, "nid": entity_id, "sal": float(salience)}
            )
            count += 1
        return count

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> dict[str, Any]:
        nodes = self.execute_read(
            "CALL db.labels() YIELD label "
            "CALL { WITH label MATCH (n) WHERE label IN labels(n) RETURN count(n) AS c } "
            "RETURN label, c ORDER BY label",
            {},
        )
        rels = self.execute_read(
            "CALL db.relationshipTypes() YIELD relationshipType "
            "CALL { WITH relationshipType "
            "       MATCH ()-[r]->() WHERE type(r) = relationshipType RETURN count(r) AS c } "
            "RETURN relationshipType, c ORDER BY relationshipType",
            {},
        )
        return {
            "nodes": {row["label"]: row["c"] for row in nodes},
            "relationships": {row["relationshipType"]: row["c"] for row in rels},
        }
