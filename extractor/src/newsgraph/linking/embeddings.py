"""MMLW embeddings wrapper.

The `sdadas/mmlw-retrieval-*` models follow the E5-style query/passage
distinction. For MMLW-retrieval-roberta variants the prefixes are:

    query:   "zapytanie: "
    passage: ""   (no prefix needed)

We embed canonical names as passages (no prefix), and the query-time mention
as a query (with prefix). Both are L2-normalised by the model card, so cosine
similarity is the right metric — that matches our HNSW vector index config.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Iterable

import numpy as np

from ..config import get_settings
from ..logging_setup import get_logger

log = get_logger(__name__)


@lru_cache(maxsize=1)
def _load_model():
    # Imported lazily so CLI help etc. don't pay the model-load cost.
    from sentence_transformers import SentenceTransformer

    settings = get_settings()
    log.info("load_embedding_model", model=settings.embedding_model)
    return SentenceTransformer(settings.embedding_model)


def _encode(texts: list[str]) -> list[list[float]]:
    model = _load_model()
    arr = model.encode(
        texts,
        batch_size=16,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    if isinstance(arr, np.ndarray):
        return arr.astype(np.float32).tolist()
    return [list(map(float, v)) for v in arr]


def embed_query(text: str) -> list[float]:
    settings = get_settings()
    return _encode([settings.embedding_query_prefix + text])[0]


def embed_passage(text: str) -> list[float]:
    settings = get_settings()
    return _encode([settings.embedding_passage_prefix + text])[0]


def embed_queries(texts: Iterable[str]) -> list[list[float]]:
    settings = get_settings()
    return _encode([settings.embedding_query_prefix + t for t in texts])


def embed_passages(texts: Iterable[str]) -> list[list[float]]:
    settings = get_settings()
    return _encode([settings.embedding_passage_prefix + t for t in texts])
