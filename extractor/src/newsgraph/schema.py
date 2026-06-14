"""Cypher DDL for the NewsGraph PoC.

All statements are idempotent — safe to run repeatedly.

NOTE on Polish analyzer:
    Neo4j 5 ships a stempel-based Polish analyzer inside the stock Lucene analyzer
    set (`polish`). If your deployment lacks it (e.g. a stripped Community build),
    set `polish_analyzer_available=False` in config — we then fall back to the
    default analyzer. Lucene fuzzy (`~`) still works for inflected forms
    like "Tuska"/"Tuskowi".
"""

from __future__ import annotations

from .config import get_settings


def _fulltext_options() -> str:
    settings = get_settings()
    if settings.polish_analyzer_available:
        return (
            " OPTIONS { indexConfig: { `fulltext.analyzer`: 'polish', "
            "`fulltext.eventually_consistent`: true } }"
        )
    return ""


def _vector_options(dim: int) -> str:
    return (
        " OPTIONS { indexConfig: { "
        f"`vector.dimensions`: {dim}, "
        "`vector.similarity_function`: 'cosine' "
        "} }"
    )


def constraint_statements() -> list[str]:
    return [
        "CREATE CONSTRAINT article_id_unique IF NOT EXISTS FOR (n:Article) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT article_hash_unique IF NOT EXISTS FOR (n:Article) REQUIRE n.source_text_hash IS UNIQUE",
        "CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (n:Person) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT org_id_unique IF NOT EXISTS FOR (n:Organization) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT loc_id_unique IF NOT EXISTS FOR (n:Location) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (n:Event) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT topic_id_unique IF NOT EXISTS FOR (n:Topic) REQUIRE n.id IS UNIQUE",
    ]


def range_index_statements() -> list[str]:
    return [
        "CREATE INDEX person_canonical_name IF NOT EXISTS FOR (n:Person) ON (n.canonical_name)",
        "CREATE INDEX org_canonical_name IF NOT EXISTS FOR (n:Organization) ON (n.canonical_name)",
        "CREATE INDEX loc_canonical_name IF NOT EXISTS FOR (n:Location) ON (n.canonical_name)",
        "CREATE INDEX event_canonical_name IF NOT EXISTS FOR (n:Event) ON (n.canonical_name)",
        "CREATE INDEX topic_canonical_name IF NOT EXISTS FOR (n:Topic) ON (n.canonical_name)",
        "CREATE INDEX article_date IF NOT EXISTS FOR (n:Article) ON (n.datePublished)",
        "CREATE INDEX event_start_date IF NOT EXISTS FOR (n:Event) ON (n.startDate)",
    ]


def fulltext_index_statements() -> list[str]:
    opts = _fulltext_options()
    return [
        f"CREATE FULLTEXT INDEX person_search IF NOT EXISTS FOR (n:Person) ON EACH [n.canonical_name, n.aliases]{opts}",
        f"CREATE FULLTEXT INDEX org_search IF NOT EXISTS FOR (n:Organization) ON EACH [n.canonical_name, n.aliases]{opts}",
        f"CREATE FULLTEXT INDEX location_search IF NOT EXISTS FOR (n:Location) ON EACH [n.canonical_name, n.aliases]{opts}",
        f"CREATE FULLTEXT INDEX event_search IF NOT EXISTS FOR (n:Event) ON EACH [n.canonical_name, n.aliases]{opts}",
        f"CREATE FULLTEXT INDEX topic_search IF NOT EXISTS FOR (n:Topic) ON EACH [n.canonical_name, n.aliases]{opts}",
    ]


def vector_index_statements() -> list[str]:
    settings = get_settings()
    opts = _vector_options(settings.embedding_dim)
    return [
        f"CREATE VECTOR INDEX person_embedding IF NOT EXISTS FOR (n:Person) ON (n.embedding){opts}",
        f"CREATE VECTOR INDEX org_embedding IF NOT EXISTS FOR (n:Organization) ON (n.embedding){opts}",
        f"CREATE VECTOR INDEX location_embedding IF NOT EXISTS FOR (n:Location) ON (n.embedding){opts}",
        f"CREATE VECTOR INDEX event_embedding IF NOT EXISTS FOR (n:Event) ON (n.embedding){opts}",
        f"CREATE VECTOR INDEX topic_embedding IF NOT EXISTS FOR (n:Topic) ON (n.embedding){opts}",
    ]


def all_ddl_statements() -> list[str]:
    return [
        *constraint_statements(),
        *range_index_statements(),
        *fulltext_index_statements(),
        *vector_index_statements(),
    ]


# Map EntityKind -> (fulltext index name, vector index name, Neo4j label)
INDEX_MAP: dict[str, dict[str, str]] = {
    "Person": {
        "fulltext": "person_search",
        "vector": "person_embedding",
        "label": "Person",
        "id_prefix": "PER_",
    },
    "Organization": {
        "fulltext": "org_search",
        "vector": "org_embedding",
        "label": "Organization",
        "id_prefix": "ORG_",
    },
    "Location": {
        "fulltext": "location_search",
        "vector": "location_embedding",
        "label": "Location",
        "id_prefix": "LOC_",
    },
    "Event": {
        "fulltext": "event_search",
        "vector": "event_embedding",
        "label": "Event",
        "id_prefix": "EVT_",
    },
    "Topic": {
        "fulltext": "topic_search",
        "vector": "topic_embedding",
        "label": "Topic",
        "id_prefix": "TOP_",
    },
}
