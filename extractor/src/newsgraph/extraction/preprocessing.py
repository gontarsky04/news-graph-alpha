"""Light preprocessing with spaCy pl_core_news_lg.

Used only to:
* produce NER hints for the LLM prompt (kotwice),
* split the text into sentences so we can pick a context sentence for
  disambiguation.

Morfeusz2 integration is intentionally not wired in yet — the binary install
is fragile in containers. spaCy's lemmatiser covers enough cases for the PoC.

TODO(morfeusz): add a Morfeusz2-backed lemmatiser here behind a
`preprocessing.morfeusz_available` flag so we can compare quality.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable

from ..logging_setup import get_logger

log = get_logger(__name__)


@dataclass
class NerHint:
    surface: str
    lemma: str
    label: str


@dataclass
class Preprocessed:
    sentences: list[str]
    ner_hints: list[NerHint]


@lru_cache(maxsize=1)
def _load_nlp():
    import spacy

    log.info("load_spacy_model", model="pl_core_news_lg")
    return spacy.load("pl_core_news_lg")


_SPACY_TO_KIND = {
    "persName": "Person",
    "PER": "Person",
    "PERSON": "Person",
    "orgName": "Organization",
    "ORG": "Organization",
    "placeName": "Location",
    "LOC": "Location",
    "GPE": "Location",
    "geogName": "Location",
}


def preprocess(text: str) -> Preprocessed:
    nlp = _load_nlp()
    doc = nlp(text)
    sentences = [s.text.strip() for s in doc.sents if s.text.strip()]
    hints: list[NerHint] = []
    for ent in doc.ents:
        label = _SPACY_TO_KIND.get(ent.label_)
        if not label:
            continue
        lemma = " ".join(t.lemma_ for t in ent if t.lemma_)
        hints.append(NerHint(surface=ent.text, lemma=lemma or ent.text, label=label))
    return Preprocessed(sentences=sentences, ner_hints=hints)


def pick_context_sentence(sentences: Iterable[str], surface_form: str) -> str:
    """Return the first sentence containing `surface_form` (or prefix thereof)."""
    needle = surface_form.strip()
    if not needle:
        return ""
    for s in sentences:
        if needle in s:
            return s
    # fall back to prefix matching (handle inflection on the mention)
    head = needle.split()[0]
    if len(head) >= 4:
        for s in sentences:
            if head in s:
                return s
    return ""
