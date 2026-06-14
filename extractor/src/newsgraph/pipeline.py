"""End-to-end pipeline: article JSON -> Neo4j graph.

For each article we:

  1. Hash the text; skip if an Article with that hash already exists.
  2. Run spaCy preprocessing (sentence split + NER hints for the LLM).
  3. Call the Stage-1 LLM extractor -> ExtractedEntities.
  4. For each extracted entity, decide merge vs. create via entity_linker.
     Create: embed canonical_name, write new node with initial aliases.
     Merge:  grow aliases on the existing node.
  5. MERGE the Article node (idempotent via source_text_hash).
  6. For each relationship, resolve from/to ids by surface_form and MERGE.
  7. Add (:Article)-[:MENTIONS]->(:Entity) for every linked entity.

Structured logging reports counts + timing per stage (see logs/app.log).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from .config import get_settings
from .extraction import llm_extractor
from .extraction.preprocessing import pick_context_sentence, preprocess
from .linking import entity_linker
from .linking.embeddings import embed_passage
from .logging_setup import get_logger
from .models import (
    EntityKind,
    ExtractedEntities,
    ExtractedEvent,
    ExtractedLocation,
    ExtractedOrganization,
    ExtractedPerson,
    ExtractedRelationship,
    ExtractedTopic,
    InputArticle,
    LinkDecision,
    PipelineStats,
    RelationType,
)
from .schema import INDEX_MAP
from .storage.neo4j_client import (
    Neo4jClient,
    new_article_id,
    text_hash,
)

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Relationship validation
# ---------------------------------------------------------------------------

# Allowed (from_label, to_label) combos per relation type. `ANY_ENTITY` widens.
_ANY_ENTITY = {"Person", "Organization", "Location", "Event", "Topic"}

REL_DIRECTIONS: dict[RelationType, tuple[set[str], set[str]]] = {
    RelationType.AUTHORED_BY: ({"Article"}, {"Person"}),
    RelationType.PUBLISHED_BY: ({"Article"}, {"Organization"}),
    RelationType.CITES_SOURCE: ({"Article"}, {"Organization"}),
    RelationType.MENTIONS: ({"Article"}, _ANY_ENTITY),
    RelationType.MET_WITH: ({"Person"}, {"Person"}),
    RelationType.CRITICIZED: ({"Person"}, {"Person", "Organization"}),
    RelationType.SUPPORTED: ({"Person"}, {"Person", "Organization"}),
    RelationType.APPOINTED: ({"Person"}, {"Person"}),
    RelationType.MEMBER_OF: ({"Person", "Organization"}, {"Organization"}),
    RelationType.LEADS: ({"Person"}, {"Organization"}),
    RelationType.PARTICIPATED_IN: ({"Person", "Organization"}, {"Event"}),
    RelationType.TOOK_PLACE_IN: ({"Event"}, {"Location"}),
    RelationType.CAUSED: ({"Event"}, {"Event"}),
    RelationType.PRECEDED_BY: ({"Event"}, {"Event"}),
    RelationType.ADDRESSED: ({"Person", "Event"}, {"Topic"}),
    RelationType.SUBTOPIC_OF: ({"Topic"}, {"Topic"}),
    RelationType.IS_IN: ({"Location"}, {"Location"}),
}

# Allowed attribute keys per relation type. Unknown keys get dropped.
REL_ALLOWED_ATTRS: dict[RelationType, set[str]] = {
    RelationType.MENTIONS: {"salience"},
    RelationType.MET_WITH: {"date", "event_id"},
    RelationType.CRITICIZED: {"strength", "excerpt"},
    RelationType.SUPPORTED: {"strength", "excerpt"},
    RelationType.APPOINTED: {"to_role", "since"},
    RelationType.MEMBER_OF: {"since", "until", "role"},
    RelationType.LEADS: {"since", "until", "title"},
    RelationType.PARTICIPATED_IN: {"role"},
    RelationType.ADDRESSED: {"stance", "excerpt"},
    RelationType.SUBTOPIC_OF: set(),
    RelationType.IS_IN: set(),
    RelationType.TOOK_PLACE_IN: set(),
    RelationType.CAUSED: set(),
    RelationType.PRECEDED_BY: set(),
    RelationType.AUTHORED_BY: set(),
    RelationType.PUBLISHED_BY: set(),
    RelationType.CITES_SOURCE: set(),
}


def _filter_attrs(rt: RelationType, raw: dict[str, Any]) -> dict[str, Any]:
    allowed = REL_ALLOWED_ATTRS.get(rt, set())
    out: dict[str, Any] = {}
    for k, v in (raw or {}).items():
        if k not in allowed:
            continue
        if v is None:
            continue
        if k == "excerpt" and isinstance(v, str):
            out[k] = v[:500]
        else:
            out[k] = v
    return out


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


@dataclass
class _EntityResolution:
    """Map surface_form -> (kind, id) after linking, for relationship resolution."""

    by_surface: dict[str, tuple[EntityKind, str]] = field(default_factory=dict)
    # Also map normalized-canonical for robustness
    by_canonical: dict[str, tuple[EntityKind, str]] = field(default_factory=dict)

    def register(self, kind: EntityKind, surface: str, canonical: str, entity_id: str) -> None:
        self.by_surface[surface.strip().lower()] = (kind, entity_id)
        self.by_canonical[canonical.strip().lower()] = (kind, entity_id)

    def resolve(self, key: str) -> tuple[EntityKind, str] | None:
        if not key:
            return None
        k = key.strip().lower()
        return self.by_surface.get(k) or self.by_canonical.get(k)


def _make_disambiguator(article_title: str):
    def _d(_title, sentence, surface, cands):
        return llm_extractor.disambiguate(article_title, sentence, surface, cands)
    return _d


def _link_and_store(
    client: Neo4jClient,
    extracted: ExtractedEntities,
    sentences: list[str],
    resolution: _EntityResolution,
    stats: PipelineStats,
) -> list[tuple[EntityKind, str]]:
    """Link every extracted entity, create/update nodes, and return the list
    of (kind, id) that should get MENTIONS edges from the article.

    Returns distinct entities actually present in this article (for MENTIONS).
    """
    settings = get_settings()
    linked: list[tuple[EntityKind, str]] = []
    seen_ids: set[tuple[str, str]] = set()

    per_kind: list[tuple[EntityKind, list[Any], dict[str, Any]]] = [
        (EntityKind.PERSON, extracted.persons, {}),
        (EntityKind.ORGANIZATION, extracted.organizations, {}),
        (EntityKind.LOCATION, extracted.locations, {}),
        (EntityKind.EVENT, extracted.events, {}),
        (EntityKind.TOPIC, extracted.topics, {}),
    ]

    disambiguator = _make_disambiguator(extracted.article_metadata.title)

    for kind, items, _ in per_kind:
        label = INDEX_MAP[kind.value]["label"]
        for it in items:
            sentence = pick_context_sentence(sentences, it.surface_form)
            decision: LinkDecision = entity_linker.link_mention(
                client,
                kind,
                surface_form=it.surface_form,
                canonical_name=it.canonical_name,
                disambiguator=disambiguator,
                context_sentence=sentence,
                article_title=extracted.article_metadata.title,
            )
            extra_props = _extra_props_for(kind, it)
            if decision.decision == "create_new":
                emb = embed_passage(it.canonical_name)
                client.create_entity(
                    kind,
                    entity_id=decision.target_id,
                    canonical_name=it.canonical_name,
                    aliases=[it.surface_form] if it.surface_form != it.canonical_name else [],
                    embedding=emb,
                    extra_props=extra_props,
                )
                stats.entities_created += 1
                log.info(
                    "entity_create",
                    kind=kind.value,
                    id=decision.target_id,
                    canonical=it.canonical_name,
                    score=decision.score,
                )
            else:
                client.grow_alias(kind, decision.target_id, it.surface_form)
                if decision.decision == "auto_merge":
                    stats.entities_auto_merged += 1
                else:
                    stats.entities_llm_merged += 1
                log.info(
                    "entity_merge",
                    kind=kind.value,
                    id=decision.target_id,
                    surface=it.surface_form,
                    score=decision.score,
                    via=decision.decision,
                )

            resolution.register(
                kind, it.surface_form, it.canonical_name, decision.target_id
            )
            key = (label, decision.target_id)
            if key not in seen_ids:
                seen_ids.add(key)
                linked.append((kind, decision.target_id))

    _ = settings  # quiet the linter if unused
    return linked


def _extra_props_for(kind: EntityKind, item: Any) -> dict[str, Any]:
    """Per-kind attribute map. Embedding/canonical/aliases handled separately."""
    if isinstance(item, ExtractedPerson):
        return {
            "nationality": item.nationality,
            "role": item.role,
        }
    if isinstance(item, ExtractedOrganization):
        return {"type": item.type.value}
    if isinstance(item, ExtractedLocation):
        return {
            "level": item.level.value if item.level else None,
            "country": item.country,
        }
    if isinstance(item, ExtractedEvent):
        return {
            "eventType": item.eventType.value,
            "startDate": item.startDate,
            "endDate": item.endDate,
        }
    if isinstance(item, ExtractedTopic):
        return {"domain": item.domain.value}
    return {}


def _store_relationships(
    client: Neo4jClient,
    article_id: str,
    relationships: list[ExtractedRelationship],
    resolution: _EntityResolution,
    stats: PipelineStats,
) -> None:
    for rel in relationships:
        try:
            rt = RelationType(rel.type) if not isinstance(rel.type, RelationType) else rel.type
        except ValueError:
            log.warning("rel_unknown_type", type=str(rel.type))
            continue

        if rt in {
            RelationType.AUTHORED_BY,
            RelationType.PUBLISHED_BY,
            RelationType.CITES_SOURCE,
            RelationType.MENTIONS,
        }:
            # Article is implicit — from_surface_form is expected to be the *target* entity.
            target = resolution.resolve(rel.to_surface_form) or resolution.resolve(
                rel.from_surface_form
            )
            if target is None:
                log.warning("rel_unresolved_target", type=rt.value, to=rel.to_surface_form)
                continue
            _, to_id = target
            to_label = INDEX_MAP[target[0].value]["label"]
            allowed_from, allowed_to = REL_DIRECTIONS[rt]
            if "Article" not in allowed_from or to_label not in allowed_to:
                log.warning(
                    "rel_direction_invalid",
                    type=rt.value,
                    to_label=to_label,
                )
                continue
            attrs = _filter_attrs(rt, rel.attributes)
            client.merge_relationship(
                rel_type=rt.value,
                from_label="Article",
                from_id=article_id,
                to_label=to_label,
                to_id=to_id,
                source_article_id=article_id,
                attributes=attrs,
            )
            stats.relationships_written += 1
            continue

        src = resolution.resolve(rel.from_surface_form)
        dst = resolution.resolve(rel.to_surface_form)
        if src is None or dst is None:
            log.warning(
                "rel_unresolved",
                type=rt.value,
                from_=rel.from_surface_form,
                to=rel.to_surface_form,
            )
            continue
        (src_kind, src_id), (dst_kind, dst_id) = src, dst
        src_label = INDEX_MAP[src_kind.value]["label"]
        dst_label = INDEX_MAP[dst_kind.value]["label"]

        allowed_from, allowed_to = REL_DIRECTIONS[rt]
        if src_label not in allowed_from or dst_label not in allowed_to:
            # Try swapping — LLMs sometimes invert subject/object.
            if src_label in allowed_to and dst_label in allowed_from:
                src_label, dst_label = dst_label, src_label
                src_id, dst_id = dst_id, src_id
            else:
                log.warning(
                    "rel_direction_invalid",
                    type=rt.value,
                    from_label=src_label,
                    to_label=dst_label,
                )
                continue

        attrs = _filter_attrs(rt, rel.attributes)
        client.merge_relationship(
            rel_type=rt.value,
            from_label=src_label,
            from_id=src_id,
            to_label=dst_label,
            to_id=dst_id,
            source_article_id=article_id,
            attributes=attrs,
        )
        stats.relationships_written += 1


def extract_link_persist(
    client: Neo4jClient,
    article_id: str,
    article: InputArticle,
    stats: PipelineStats,
) -> ExtractedEntities:
    """Core pipeline for an *already-existing* Article node.

    Runs preprocess -> LLM extraction -> entity linking -> relationships ->
    MENTIONS, attaching everything to the Article identified by `article_id`.
    Does NOT create or mutate the Article node, and does NOT do hash dedup —
    both are the caller's responsibility. The CLI handles them in
    `process_article`; the gRPC server delegates them to the Spring backend,
    which owns the Article node (status/body/tags/counts).
    """
    start = time.monotonic()

    t0 = time.monotonic()
    pre = preprocess(article.text)
    t_preproc = time.monotonic() - t0

    ner_surfaces = [h.surface for h in pre.ner_hints]
    t0 = time.monotonic()
    extracted = llm_extractor.extract_entities(
        title=article.title,
        url=article.url,
        date_published=article.datePublished,
        text=article.text,
        ner_hints=ner_surfaces,
    )
    t_extract = time.monotonic() - t0

    resolution = _EntityResolution()
    t0 = time.monotonic()
    linked = _link_and_store(client, extracted, pre.sentences, resolution, stats)
    t_link = time.monotonic() - t0

    t0 = time.monotonic()
    _store_relationships(client, article_id, extracted.relationships, resolution, stats)
    t_rels = time.monotonic() - t0

    # Auto-MENTIONS for every distinct linked entity
    mentions = [
        (INDEX_MAP[k.value]["label"], nid, 0.5) for (k, nid) in linked
    ]
    written = client.merge_mentions(article_id=article_id, mentions=mentions)
    stats.mentions_written += written

    stats.articles_processed += 1
    stats.elapsed_seconds += time.monotonic() - start
    log.info(
        "article_done",
        title=article.title,
        id=article_id,
        preproc_s=round(t_preproc, 2),
        llm_s=round(t_extract, 2),
        link_s=round(t_link, 2),
        rel_s=round(t_rels, 2),
        persons=len(extracted.persons),
        orgs=len(extracted.organizations),
        locations=len(extracted.locations),
        events=len(extracted.events),
        topics=len(extracted.topics),
        rels=len(extracted.relationships),
    )
    return extracted


def process_article(client: Neo4jClient, article: InputArticle, stats: PipelineStats) -> None:
    """Standalone (CLI) path: owns hash dedup and Article-node creation."""
    stats.articles_total += 1
    t_hash = text_hash(article.text)

    existing_id = client.article_exists_by_hash(t_hash)
    if existing_id:
        stats.articles_skipped_duplicate += 1
        log.info("article_skipped_duplicate", hash=t_hash[:12], existing_id=existing_id)
        return

    article_id = new_article_id()
    client.merge_article(
        article_id=article_id,
        title=article.title,
        url=article.url,
        date_published=article.datePublished,
        source_text_hash=t_hash,
    )

    extract_link_persist(client, article_id, article, stats)


def run(articles: list[InputArticle]) -> PipelineStats:
    stats = PipelineStats()
    client = Neo4jClient()
    try:
        for art in articles:
            try:
                process_article(client, art, stats)
            except Exception as exc:  # noqa: BLE001
                log.exception("article_failed", title=art.title, error=str(exc))
    finally:
        client.close()
    log.info(
        "pipeline_done",
        articles_total=stats.articles_total,
        articles_processed=stats.articles_processed,
        articles_skipped_duplicate=stats.articles_skipped_duplicate,
        entities_created=stats.entities_created,
        entities_auto_merged=stats.entities_auto_merged,
        entities_llm_merged=stats.entities_llm_merged,
        relationships_written=stats.relationships_written,
        mentions_written=stats.mentions_written,
        elapsed_s=round(stats.elapsed_seconds, 2),
    )
    return stats
