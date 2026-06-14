"""Entity linking: Lucene + vector -> RRF -> rapidfuzz rerank -> threshold routing.

For every extracted mention we:

1. Pull top-k candidates from the Lucene fulltext index (fuzzy, inflection-friendly).
2. Pull top-k candidates from the vector index (MMLW embeddings, semantic).
3. Fuse the two lists via Reciprocal Rank Fusion, normalized against the
   *theoretical* RRF maximum (rank-1 in every list) so the score reflects
   absolute retrieval strength rather than mere rank within this result set.
4. Rerank the top-N by a kind-aware name similarity (surname-gated for people,
   `token_set_ratio` otherwise) and take a weighted blend with the RRF score
   -> final `combined_score ∈ [0, 1]`.
5. Route:
    * >= AUTO_MERGE_THRESHOLD (0.88)  -> auto-merge, add alias
    * >= DISAMBIGUATE_THRESHOLD (0.70) -> LLM disambiguation call
    * <  DISAMBIGUATE_THRESHOLD        -> create new node
"""

from __future__ import annotations

from typing import Any

from rapidfuzz import fuzz

from ..config import get_settings
from ..logging_setup import get_logger
from ..models import Candidate, EntityKind, LinkDecision
from ..storage.neo4j_client import Neo4jClient, new_id
from . import lucene_search, vector_search
from .embeddings import embed_query

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Reciprocal Rank Fusion
# ---------------------------------------------------------------------------


def _rrf(
    ranked_lists: list[list[Candidate]],
    k: int,
) -> dict[str, tuple[Candidate, float]]:
    """Merge several ranked candidate lists via RRF. Returns {id: (cand, score)}."""

    fused: dict[str, tuple[Candidate, float]] = {}
    for lst in ranked_lists:
        for rank, cand in enumerate(lst, start=1):
            contrib = 1.0 / (k + rank)
            if cand.id in fused:
                existing, s = fused[cand.id]
                # Keep the richer object (merge scalar scores)
                merged = existing.model_copy(
                    update={
                        "lucene_score": existing.lucene_score or cand.lucene_score,
                        "vector_score": existing.vector_score or cand.vector_score,
                    }
                )
                fused[cand.id] = (merged, s + contrib)
            else:
                fused[cand.id] = (cand, contrib)
    return fused


def _normalize_rrf(
    fused: dict[str, tuple[Candidate, float]],
    num_lists: int,
    k: int,
) -> list[tuple[Candidate, float]]:
    """Normalize fused RRF scores against the *theoretical maximum*.

    The theoretical max is the score of a candidate ranked #1 in every
    contributing list: ``num_lists * 1/(k+1)``. Normalizing against this
    fixed ceiling (instead of the observed max) means the returned score is
    an *absolute* measure of retrieval strength — a weak top hit stays low.

    Normalizing against the observed max (the previous behaviour) forced the
    best candidate to 1.0 no matter how poor the match, so a candidate that
    merely shared a token (e.g. the given name "Donald") sailed through the
    auto-merge gate. ``num_lists`` counts only the retrievers that actually
    returned something, so a down/empty retriever doesn't permanently cap the
    achievable score.
    """
    if not fused:
        return []
    theoretical_max = num_lists * (1.0 / (k + 1)) if num_lists > 0 else 0.0
    if theoretical_max <= 0:
        return [(c, 0.0) for c, _ in fused.values()]
    return sorted(
        [(c, min(s / theoretical_max, 1.0)) for c, s in fused.values()],
        key=lambda x: x[1],
        reverse=True,
    )


def _surname(name: str) -> str:
    """Last whitespace-delimited token, lowercased — the distinguishing token
    for a person ("Donald Trump" -> "trump"). Empty for blank input."""
    tokens = name.strip().split()
    return tokens[-1].lower() if tokens else ""


def _name_similarity(mention: str, candidate_form: str, kind: EntityKind) -> float:
    """Kind-aware fuzzy name similarity in [0, 100].

    `token_set_ratio` over-credits people who merely share a given name
    ("Donald Trump" vs "Donald Tusk" -> 78 on the shared "Donald"). For PERSON
    entities we additionally require the *surname* — the distinguishing token —
    to match: if the surnames disagree, the pair cannot be the same person
    regardless of the shared given name, so the score is capped at the (low)
    surname similarity, pulling it out of the merge band. Non-person kinds keep
    the plain token-set behaviour.
    """
    base = fuzz.token_set_ratio(mention, candidate_form)
    if kind is not EntityKind.PERSON:
        return base
    m_sur = _surname(mention)
    c_sur = _surname(candidate_form)
    if not m_sur or not c_sur:
        return base
    surname_sim = fuzz.ratio(m_sur, c_sur)
    if surname_sim < get_settings().surname_match_min:
        return min(base, surname_sim)
    return base


def _rerank(
    candidates: list[tuple[Candidate, float]],
    mention: str,
    top_n: int,
) -> list[tuple[Candidate, float, float]]:
    """Return [(candidate, rrf_norm, combined_score)] sorted by combined_score desc.

    combined_score = 0.5 * rrf_norm + 0.5 * (name_sim / 100)
    name_sim = max over (canonical_name | aliases) of `_name_similarity`,
    which is surname-gated for PERSON candidates.
    """
    out: list[tuple[Candidate, float, float]] = []
    for cand, rrf in candidates[:top_n]:
        pool = [cand.canonical_name, *cand.aliases]
        best_fuzz = max(
            _name_similarity(mention, candidate_form, cand.kind)
            for candidate_form in pool
        )
        combined = 0.5 * rrf + 0.5 * (best_fuzz / 100.0)
        out.append((cand, rrf, combined))
    out.sort(key=lambda x: x[2], reverse=True)
    return out


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def find_candidates(
    client: Neo4jClient,
    kind: EntityKind,
    mention_canonical: str,
    mention_embedding: list[float],
) -> list[tuple[Candidate, float]]:
    lx = lucene_search.search_candidates(client, kind, mention_canonical)
    vx = vector_search.search_candidates(client, kind, mention_embedding)
    settings = get_settings()
    ranked_lists = [lx, vx]
    fused = _rrf(ranked_lists, k=settings.rrf_k)
    num_lists = sum(1 for lst in ranked_lists if lst)
    return _normalize_rrf(fused, num_lists=num_lists, k=settings.rrf_k)


def link_mention(
    client: Neo4jClient,
    kind: EntityKind,
    surface_form: str,
    canonical_name: str,
    *,
    disambiguator=None,
    context_sentence: str = "",
    article_title: str = "",
) -> LinkDecision:
    """Run the full linking decision for a single mention.

    `disambiguator` is an optional callable:
        disambiguator(article_title, sentence, surface_form, [candidate, ...]) -> str
        Returns an existing id or 'NEW'.
    """
    settings = get_settings()
    emb = embed_query(canonical_name)
    fused = find_candidates(client, kind, canonical_name, emb)
    reranked = _rerank(fused, canonical_name, settings.rerank_top_n)

    if not reranked:
        nid = new_id(kind)
        return LinkDecision(
            kind=kind,
            surface_form=surface_form,
            canonical_name=canonical_name,
            decision="create_new",
            target_id=nid,
            score=0.0,
        )

    top_cand, _rrf_norm, top_score = reranked[0]

    if top_score >= settings.auto_merge_threshold:
        return LinkDecision(
            kind=kind,
            surface_form=surface_form,
            canonical_name=canonical_name,
            decision="auto_merge",
            target_id=top_cand.id,
            score=top_score,
            chosen_candidate=top_cand,
        )

    if top_score >= settings.disambiguate_threshold:
        if disambiguator is None:
            # No LLM available -> be safe: create new.
            nid = new_id(kind)
            return LinkDecision(
                kind=kind,
                surface_form=surface_form,
                canonical_name=canonical_name,
                decision="create_new",
                target_id=nid,
                score=top_score,
                chosen_candidate=top_cand,
            )
        top_candidates = [c for c, _, _ in reranked]
        choice = disambiguator(article_title, context_sentence, surface_form, top_candidates)
        if choice and choice != "NEW":
            match = next((c for c in top_candidates if c.id == choice), None)
            if match is not None:
                return LinkDecision(
                    kind=kind,
                    surface_form=surface_form,
                    canonical_name=canonical_name,
                    decision="llm_merge",
                    target_id=match.id,
                    score=top_score,
                    chosen_candidate=match,
                )
        nid = new_id(kind)
        return LinkDecision(
            kind=kind,
            surface_form=surface_form,
            canonical_name=canonical_name,
            decision="create_new",
            target_id=nid,
            score=top_score,
        )

    nid = new_id(kind)
    return LinkDecision(
        kind=kind,
        surface_form=surface_form,
        canonical_name=canonical_name,
        decision="create_new",
        target_id=nid,
        score=top_score,
    )


def debug_scores(
    client: Neo4jClient,
    kind: EntityKind,
    canonical_name: str,
) -> list[dict[str, Any]]:
    """Convenience for manual debugging (CLI). Returns top candidates + scores."""
    emb = embed_query(canonical_name)
    fused = find_candidates(client, kind, canonical_name, emb)
    rr = _rerank(fused, canonical_name, get_settings().rerank_top_n)
    return [
        {
            "id": c.id,
            "canonical_name": c.canonical_name,
            "aliases": c.aliases[:5],
            "rrf_norm": round(rrf, 4),
            "combined_score": round(combined, 4),
        }
        for c, rrf, combined in rr
    ]
