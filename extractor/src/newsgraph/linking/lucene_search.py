"""Lucene fulltext candidate search with fuzzy matching.

We build the query string ourselves rather than letting the user write raw
Lucene, so we can:

* Escape reserved operators (Tuska + ( would explode otherwise)
* Add per-term fuzzy factor (`~0.75`) — crucial for Polish inflection:
  `Tuska~0.75` matches "Tusk" in the index.
"""

from __future__ import annotations

import re
from typing import Any

from ..config import get_settings
from ..models import Candidate, EntityKind
from ..storage.neo4j_client import Neo4jClient

# Lucene reserved characters — everything in this set gets escaped in user input
_LUCENE_SPECIALS = r'+-&|!(){}[]^"~*?:\\/'
_LUCENE_ESCAPE_RE = re.compile(r'([' + re.escape(_LUCENE_SPECIALS) + r'])')

# Token splitter — keep letters (incl. Polish diacritics) and digits
_TOKEN_RE = re.compile(r"[\wĄĆĘŁŃÓŚŹŻąćęłńóśźż]+", re.UNICODE)


def _escape(term: str) -> str:
    return _LUCENE_ESCAPE_RE.sub(r"\\\1", term)


def build_fuzzy_query(text: str) -> str:
    settings = get_settings()
    factor = settings.lucene_fuzzy_factor
    tokens = _TOKEN_RE.findall(text)
    if not tokens:
        return _escape(text)
    # Combine as OR; each token gets fuzzy + a small boost on exact match
    parts = []
    for tok in tokens:
        esc = _escape(tok)
        parts.append(f'({esc} OR {esc}~{factor})')
    return " ".join(parts)


def search_candidates(
    client: Neo4jClient,
    kind: EntityKind,
    query_text: str,
    *,
    top_k: int | None = None,
) -> list[Candidate]:
    settings = get_settings()
    top_k = top_k or settings.top_k_candidates
    q = build_fuzzy_query(query_text)
    if not q.strip():
        return []
    try:
        rows: list[dict[str, Any]] = client.fulltext_search(kind, q, top_k)
    except Exception:  # noqa: BLE001
        return []
    return [
        Candidate(
            id=r["id"],
            canonical_name=r["canonical_name"],
            aliases=r.get("aliases") or [],
            role=r.get("role"),
            kind=kind,
            lucene_score=float(r["score"]),
        )
        for r in rows
    ]
