from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enums (names must be stable — they are stored as strings in Neo4j)
# ---------------------------------------------------------------------------


class EntityKind(str, Enum):
    PERSON = "Person"
    ORGANIZATION = "Organization"
    LOCATION = "Location"
    EVENT = "Event"
    TOPIC = "Topic"


class OrganizationType(str, Enum):
    partia_polityczna = "partia_polityczna"
    rzad = "rzad"
    parlament = "parlament"
    organizacja_miedzynarodowa = "organizacja_miedzynarodowa"
    instytucja_panstwowa = "instytucja_panstwowa"
    sluzba = "sluzba"
    media = "media"
    korporacja = "korporacja"
    think_tank = "think_tank"
    organizacja_zbrojna = "organizacja_zbrojna"
    inna = "inna"


class EventType(str, Enum):
    spotkanie = "spotkanie"
    szczyt = "szczyt"
    wybory = "wybory"
    konflikt_zbrojny = "konflikt_zbrojny"
    zamach = "zamach"
    protest = "protest"
    wizyta_dyplomatyczna = "wizyta_dyplomatyczna"
    umowa = "umowa"
    ogloszenie = "ogloszenie"
    konferencja_prasowa = "konferencja_prasowa"
    proces_sadowy = "proces_sadowy"
    katastrofa = "katastrofa"
    inne = "inne"


class TopicDomain(str, Enum):
    polityka_wewnetrzna = "polityka_wewnetrzna"
    polityka_zagraniczna = "polityka_zagraniczna"
    bezpieczenstwo = "bezpieczenstwo"
    konflikty_zbrojne = "konflikty_zbrojne"
    gospodarka = "gospodarka"
    energetyka = "energetyka"
    sankcje_handel = "sankcje_handel"
    wymiar_sprawiedliwosci = "wymiar_sprawiedliwosci"
    sluzby_wywiad = "sluzby_wywiad"
    migracje = "migracje"
    media_dezinformacja = "media_dezinformacja"
    inne = "inne"


class LocationLevel(str, Enum):
    continent = "continent"
    country = "country"
    region = "region"
    city = "city"
    facility = "facility"


class ParticipantRole(str, Enum):
    organizer = "organizer"
    participant = "participant"
    speaker = "speaker"
    victim = "victim"
    witness = "witness"
    target = "target"
    host = "host"
    guest = "guest"


class RelationType(str, Enum):
    # Article
    AUTHORED_BY = "AUTHORED_BY"
    PUBLISHED_BY = "PUBLISHED_BY"
    CITES_SOURCE = "CITES_SOURCE"
    MENTIONS = "MENTIONS"
    # Person <-> Person/Org
    MET_WITH = "MET_WITH"
    CRITICIZED = "CRITICIZED"
    SUPPORTED = "SUPPORTED"
    APPOINTED = "APPOINTED"
    # Role
    MEMBER_OF = "MEMBER_OF"
    LEADS = "LEADS"
    # Event participation
    PARTICIPATED_IN = "PARTICIPATED_IN"
    # Event
    TOOK_PLACE_IN = "TOOK_PLACE_IN"
    CAUSED = "CAUSED"
    PRECEDED_BY = "PRECEDED_BY"
    # Topic / geo
    ADDRESSED = "ADDRESSED"
    SUBTOPIC_OF = "SUBTOPIC_OF"
    IS_IN = "IS_IN"


# ---------------------------------------------------------------------------
# Input article
# ---------------------------------------------------------------------------


class InputArticle(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    url: str | None = None
    datePublished: str | None = None  # accept partial or ISO
    text: str


# ---------------------------------------------------------------------------
# Extraction output (what the LLM produces)
# ---------------------------------------------------------------------------


class ArticleMeta(BaseModel):
    title: str
    url: str | None = None
    datePublished: str | None = None  # ISO 8601; partial ok


class _ExtractedBase(BaseModel):
    surface_form: str = Field(..., description="Exact substring as it appears in the article")
    canonical_name: str = Field(..., description="Base/nominative/full form used for the graph node")


class ExtractedPerson(_ExtractedBase):
    nationality: str | None = Field(default=None, description="ISO 3166-1 alpha-2 if inferable, else null")
    role: str | None = Field(default=None, description="Role/title in the context of the article")


class ExtractedOrganization(_ExtractedBase):
    type: OrganizationType = OrganizationType.inna


class ExtractedLocation(_ExtractedBase):
    level: LocationLevel | None = None
    country: str | None = Field(default=None, description="ISO 3166-1 alpha-2 of parent country if applicable")


class ExtractedEvent(_ExtractedBase):
    eventType: EventType = EventType.inne
    startDate: str | None = None  # ISO 8601 or partial
    endDate: str | None = None


class ExtractedTopic(_ExtractedBase):
    domain: TopicDomain = TopicDomain.inne


class ExtractedRelationship(BaseModel):
    type: RelationType
    from_surface_form: str
    to_surface_form: str
    # free-form attributes; validated & filtered by pipeline according to relation type
    attributes: dict[str, Any] = Field(default_factory=dict)


class ExtractedEntities(BaseModel):
    article_metadata: ArticleMeta
    persons: list[ExtractedPerson] = Field(default_factory=list)
    organizations: list[ExtractedOrganization] = Field(default_factory=list)
    locations: list[ExtractedLocation] = Field(default_factory=list)
    events: list[ExtractedEvent] = Field(default_factory=list)
    topics: list[ExtractedTopic] = Field(default_factory=list)
    relationships: list[ExtractedRelationship] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Disambiguation mini-prompt response
# ---------------------------------------------------------------------------


class DisambiguationAnswer(BaseModel):
    """LLM disambiguation result. Either an existing node id or the sentinel 'NEW'."""

    choice: str = Field(..., description="Either an existing id (e.g. PER_abc123) or literal 'NEW'")


# ---------------------------------------------------------------------------
# Graph-side dataclasses (used internally by pipeline/storage)
# ---------------------------------------------------------------------------


class Candidate(BaseModel):
    """Candidate entity returned from fulltext/vector search."""

    id: str
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    role: str | None = None
    kind: EntityKind
    lucene_score: float | None = None
    vector_score: float | None = None


class LinkDecision(BaseModel):
    """Result of entity linking for a single extracted mention."""

    kind: EntityKind
    surface_form: str
    canonical_name: str
    decision: Literal["auto_merge", "llm_merge", "create_new"]
    target_id: str  # either existing id (merge) or freshly-minted id (create)
    score: float | None = None
    chosen_candidate: Candidate | None = None


class PipelineStats(BaseModel):
    articles_total: int = 0
    articles_skipped_duplicate: int = 0
    articles_processed: int = 0
    entities_created: int = 0
    entities_auto_merged: int = 0
    entities_llm_merged: int = 0
    relationships_written: int = 0
    mentions_written: int = 0
    elapsed_seconds: float = 0.0


def utcnow_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    # Accept partial ISO: 'YYYY', 'YYYY-MM', 'YYYY-MM-DD'
    parts = value.strip().split("-")
    try:
        if len(parts) == 1:
            return date(int(parts[0]), 1, 1)
        if len(parts) == 2:
            return date(int(parts[0]), int(parts[1]), 1)
        return date(int(parts[0]), int(parts[1]), int(parts[2][:2]))
    except (ValueError, IndexError):
        return None
