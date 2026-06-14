from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Neo4j
    neo4j_uri: str = Field(default="bolt://localhost:7687")
    neo4j_user: str = Field(default="neo4j")
    neo4j_password: str = Field(default="newsgraph_dev_password")
    neo4j_database: str = Field(default="neo4j")

    # OpenRouter / LLM
    openrouter_api_key: str = Field(default="")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1")
    llm_model: str = Field(default="anthropic/claude-haiku-4.5")
    llm_temperature: float = Field(default=0.1)
    llm_max_tokens: int = Field(default=8000)

    # Embeddings
    embedding_model: str = Field(default="sdadas/mmlw-retrieval-roberta-large-v2")
    embedding_dim: int = Field(default=1024)
    embedding_query_prefix: str = Field(default="zapytanie: ")
    embedding_passage_prefix: str = Field(default="")

    # Entity linking thresholds
    auto_merge_threshold: float = Field(default=0.88)
    disambiguate_threshold: float = Field(default=0.70)
    # Minimum surname similarity (rapidfuzz.ratio, 0..100) for two PERSON
    # mentions to be considered the same person. Below this the surnames are
    # treated as distinct (e.g. "Trump" vs "Tusk") and the name score is capped,
    # so a shared given name alone can no longer trigger a merge. Tuned to allow
    # Polish inflection ("Tuska" vs "Tusk" ~= 89) while rejecting real mismatches.
    surname_match_min: float = Field(default=85.0)
    # Lucene fuzzy term factor (0..1), appended as `~FACTOR` per term
    lucene_fuzzy_factor: float = Field(default=0.75)
    top_k_candidates: int = Field(default=5)
    rerank_top_n: int = Field(default=3)
    # RRF constant k (60 is the canonical value)
    rrf_k: int = Field(default=60)

    # Polish analyzer plugin availability (false -> standard analyzer)
    polish_analyzer_available: bool = Field(default=False)

    # Logging
    log_level: str = Field(default="INFO")
    log_file: str = Field(default="logs/app.log")

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[2]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
