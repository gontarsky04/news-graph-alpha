"""HNSW cosine vector search over the entity-typed vector indexes."""

from __future__ import annotations

from ..config import get_settings
from ..models import Candidate, EntityKind
from ..storage.neo4j_client import Neo4jClient


def search_candidates(
    client: Neo4jClient,
    kind: EntityKind,
    query_embedding: list[float],
    *,
    top_k: int | None = None,
) -> list[Candidate]:
    settings = get_settings()
    top_k = top_k or settings.top_k_candidates
    try:
        rows = client.vector_search(kind, query_embedding, top_k)
    except Exception:  # noqa: BLE001
        return []
    return [
        Candidate(
            id=r["id"],
            canonical_name=r["canonical_name"],
            aliases=r.get("aliases") or [],
            role=r.get("role"),
            kind=kind,
            vector_score=float(r["score"]),
        )
        for r in rows
    ]
