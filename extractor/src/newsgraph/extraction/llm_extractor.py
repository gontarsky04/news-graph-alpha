"""Stage-1 LLM extraction and Stage-2b disambiguation via OpenRouter + instructor.

OpenRouter is wire-compatible with the OpenAI Chat Completions API, so we use the
`openai` SDK pointed at OpenRouter and wrap it with `instructor` to enforce our
Pydantic schema on the response.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import instructor
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from ..config import get_settings
from ..logging_setup import get_logger
from ..models import Candidate, DisambiguationAnswer, ExtractedEntities
from .prompts import (
    DISAMBIGUATION_SYSTEM_PROMPT,
    FEWSHOT_EXAMPLES,
    SYSTEM_PROMPT_EXTRACTION,
    build_disambiguation_user_prompt,
    build_extraction_user_prompt,
)

log = get_logger(__name__)


@lru_cache(maxsize=1)
def _client() -> Any:
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Add it to .env before running extraction."
        )
    raw = OpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        default_headers={
            "HTTP-Referer": "https://github.com/newsgraph-poc",
            "X-Title": "NewsGraph PoC",
        },
    )
    # instructor.from_openai with JSON mode works across providers reachable via
    # OpenRouter; keep it simple.
    return instructor.from_openai(raw, mode=instructor.Mode.JSON)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=2, max=20),
    reraise=True,
)
def extract_entities(
    *,
    title: str,
    url: str | None,
    date_published: str | None,
    text: str,
    ner_hints: list[str] | None = None,
) -> ExtractedEntities:
    settings = get_settings()
    client = _client()
    user_prompt = build_extraction_user_prompt(
        title=title,
        url=url,
        date_published=date_published,
        text=text,
        ner_hints=ner_hints,
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_EXTRACTION + "\n\n" + FEWSHOT_EXAMPLES},
        {"role": "user", "content": user_prompt},
    ]
    log.info("llm_extract_start", model=settings.llm_model, chars=len(text))
    result = client.chat.completions.create(
        model=settings.llm_model,
        response_model=ExtractedEntities,
        messages=messages,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
    )
    log.info(
        "llm_extract_done",
        persons=len(result.persons),
        orgs=len(result.organizations),
        locations=len(result.locations),
        events=len(result.events),
        topics=len(result.topics),
        relationships=len(result.relationships),
    )
    return result


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential_jitter(initial=1, max=10),
    reraise=True,
)
def disambiguate(
    article_title: str,
    sentence_context: str,
    surface_form: str,
    candidates: list[Candidate],
) -> str:
    """Ask the LLM which candidate the mention refers to, or 'NEW' for a novel entity."""
    settings = get_settings()
    client = _client()
    cand_payload = [
        {
            "id": c.id,
            "canonical_name": c.canonical_name,
            "aliases": c.aliases,
            "role": c.role,
        }
        for c in candidates
    ]
    user_prompt = build_disambiguation_user_prompt(
        article_title=article_title,
        sentence_context=sentence_context,
        surface_form=surface_form,
        candidates=cand_payload,
    )
    result: DisambiguationAnswer = client.chat.completions.create(
        model=settings.llm_model,
        response_model=DisambiguationAnswer,
        messages=[
            {"role": "system", "content": DISAMBIGUATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.0,
        max_tokens=1000,
    )
    log.info(
        "llm_disambiguate",
        mention=surface_form,
        choice=result.choice,
        candidates=len(candidates),
    )
    return result.choice.strip()
