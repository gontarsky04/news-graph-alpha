"""Entity-linking regression tests.

Focus: the "Donald Trump" / "Donald Tusk" false merge. Two compounding bugs
let two different people collapse into one node:

  1. RRF scores were normalized against the *observed* max, forcing the top
     candidate to 1.0 regardless of how weak the match was.
  2. `token_set_ratio` over-credited the shared given name ("Donald"), scoring
     Trump vs Tusk at 78 — above the effective auto-merge cutoff.

These tests pin both fixes and assert the two stay separate end to end.
"""

from __future__ import annotations

import pytest

from newsgraph.config import get_settings
from newsgraph.linking import entity_linker as el
from newsgraph.models import Candidate, EntityKind


def _person(cid: str, name: str, **kw) -> Candidate:
    return Candidate(id=cid, canonical_name=name, kind=EntityKind.PERSON, **kw)


# ---------------------------------------------------------------------------
# Fix #1 — RRF normalized against the theoretical max, not the observed max
# ---------------------------------------------------------------------------


def test_normalize_rrf_uses_theoretical_max() -> None:
    """A candidate found by only one of two retrievers must not score 1.0."""
    cand = _person("PER_a", "Donald Trump")
    fused = el._rrf([[cand]], k=60)  # rank-1 in a single list
    [(_, score)] = el._normalize_rrf(fused, num_lists=2, k=60)
    # 1/(60+1) over a 2-list theoretical max of 2/(60+1) -> 0.5, not 1.0
    assert score == pytest.approx(0.5, abs=1e-6)


def test_normalize_rrf_full_agreement_hits_one() -> None:
    """Rank-1 in *every* contributing list still saturates at 1.0."""
    cand = _person("PER_a", "Donald Trump")
    fused = el._rrf([[cand], [cand]], k=60)
    [(_, score)] = el._normalize_rrf(fused, num_lists=2, k=60)
    assert score == pytest.approx(1.0, abs=1e-6)


def test_normalize_rrf_empty() -> None:
    assert el._normalize_rrf({}, num_lists=2, k=60) == []


# ---------------------------------------------------------------------------
# Fix #2 — surname-gated name similarity for PERSON entities
# ---------------------------------------------------------------------------


def test_name_similarity_caps_mismatched_surnames() -> None:
    """Shared given name, different surname -> capped well below the merge band."""
    sim = el._name_similarity("Donald Tusk", "Donald Trump", EntityKind.PERSON)
    # token_set_ratio alone is ~78; surname gate drops it to the surname sim (~44)
    assert sim < 50


def test_name_similarity_allows_polish_inflection() -> None:
    """Inflected surname ("Tuska" genitive) still matches "Tusk"."""
    sim = el._name_similarity("Donald Tuska", "Donald Tusk", EntityKind.PERSON)
    assert sim >= get_settings().auto_merge_threshold * 100


def test_name_similarity_same_person_high() -> None:
    assert el._name_similarity("Donald Tusk", "Donald Tusk", EntityKind.PERSON) == 100


def test_name_similarity_non_person_unaffected() -> None:
    """Non-person kinds keep plain token_set_ratio (no surname gating)."""
    org = el._name_similarity(
        "Platforma Obywatelska", "Platforma Obywatelska RP", EntityKind.ORGANIZATION
    )
    assert org > 80


# ---------------------------------------------------------------------------
# End-to-end routing through link_mention (retrieval + embeddings stubbed out)
# ---------------------------------------------------------------------------


@pytest.fixture
def stub_retrieval(monkeypatch):
    """Force find_candidates to surface a given candidate list at rrf_norm=1.0,
    and stub embeddings so no model is loaded."""

    def _install(candidates: list[Candidate]):
        monkeypatch.setattr(el, "embed_query", lambda _name: [0.0])
        monkeypatch.setattr(
            el,
            "find_candidates",
            lambda *a, **k: [(c, 1.0) for c in candidates],
        )

    return _install


def test_tusk_does_not_merge_into_trump(stub_retrieval) -> None:
    """The original bug: 'Donald Tusk' must not auto-merge into 'Donald Trump'."""
    stub_retrieval([_person("PER_trump", "Donald Trump")])
    decision = el.link_mention(
        client=None,
        kind=EntityKind.PERSON,
        surface_form="Donalda Tuska",
        canonical_name="Donald Tusk",
    )
    assert decision.decision == "create_new"
    assert decision.target_id != "PER_trump"


def test_same_person_still_auto_merges(stub_retrieval) -> None:
    """Guard against over-correction: a true match must still auto-merge."""
    stub_retrieval([_person("PER_tusk", "Donald Tusk")])
    decision = el.link_mention(
        client=None,
        kind=EntityKind.PERSON,
        surface_form="Donalda Tuska",
        canonical_name="Donald Tusk",
    )
    assert decision.decision == "auto_merge"
    assert decision.target_id == "PER_tusk"
