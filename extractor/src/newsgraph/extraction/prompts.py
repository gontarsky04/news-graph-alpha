"""Prompts for Stage-1 (extraction) and Stage-2b (disambiguation).

We deliberately *do not* pass existing graph nodes into the Stage-1 prompt.
Dedup is done application-side after extraction (see entity_linker).
"""

from __future__ import annotations

SYSTEM_PROMPT_EXTRACTION = """\
Jesteś ekspertem od ekstrakcji wiedzy z polskich artykułów prasowych
o tematyce politycznej, geopolitycznej i ekonomicznej.

Twoim zadaniem jest wyekstrahowanie z artykułu:
1. Encji: osoby (Person), organizacje (Organization), miejsca (Location),
   wydarzenia (Event), tematy (Topic)
2. Relacji między nimi zgodnych z dostarczonym schematem

ZASADY:
- Ekstrahuj TYLKO to co wprost wynika z tekstu. Nie domyślaj się.
- Dla każdej encji podaj `surface_form` (jak wystąpiła w tekście) ORAZ
  `canonical_name` (forma podstawowa: mianownik dla osób i miejsc, pełna nazwa
  dla organizacji — np. "Prawo i Sprawiedliwość" nie "PiS"; dla Topic używaj
  zwięzłej etykiety w mianowniku, np. "sankcje na Rosję", "reforma sądownictwa")
- Daty w formacie ISO 8601. Jeśli znana tylko część, pisz "2024" albo "2024-03"
- Dla osób: jeśli znany tytuł/rola w momencie zdarzenia, podaj w polu `role`
  (np. "premier RP", "minister spraw zagranicznych").
- Dla Location: w polu `level` użyj jednej z wartości: continent, country, region,
  city, facility. W `country` podaj kod ISO alfa-2 (np. "PL", "FR") kraju
  nadrzędnego, jeśli ma sens.
- Dla Organization: w polu `type` użyj jednej z wartości:
  partia_polityczna, rzad, parlament, organizacja_miedzynarodowa,
  instytucja_panstwowa, sluzba, media, korporacja, think_tank,
  organizacja_zbrojna, inna.
- Dla Event: `eventType` ∈ {spotkanie, szczyt, wybory, konflikt_zbrojny, zamach,
  protest, wizyta_dyplomatyczna, umowa, ogloszenie, konferencja_prasowa,
  proces_sadowy, katastrofa, inne}. Dla startDate/endDate używaj ISO (partial OK).
- Dla Topic: `domain` ∈ {polityka_wewnetrzna, polityka_zagraniczna, bezpieczenstwo,
  konflikty_zbrojne, gospodarka, energetyka, sankcje_handel, wymiar_sprawiedliwosci,
  sluzby_wywiad, migracje, media_dezinformacja, inne}.

RELACJE:
- Każda relacja ma `type`, `from_surface_form`, `to_surface_form` oraz opcjonalne
  `attributes` (dict). Używaj `surface_form`, które zwróciłeś wyżej w encjach.
- Dozwolone typy (kierunek ma znaczenie):
    AUTHORED_BY, PUBLISHED_BY, CITES_SOURCE, MENTIONS,  # z Article jako źródłem
    MET_WITH, CRITICIZED, SUPPORTED, APPOINTED,         # Person -> Person/Org
    MEMBER_OF, LEADS,                                    # Person/Org -> Org
    PARTICIPATED_IN,                                     # Person/Org -> Event
    TOOK_PLACE_IN, CAUSED, PRECEDED_BY,                  # Event -> Event/Location
    ADDRESSED, SUBTOPIC_OF,                              # Person/Event -> Topic
    IS_IN                                                # Location -> Location
- Dla CRITICIZED/SUPPORTED/ADDRESSED: jeśli jest konkretny fragment
  wyrażający stosunek, podaj go w `attributes.excerpt` (max 500 znaków) oraz
  `attributes.stance` lub `attributes.strength` (Float w [-1..1]) jeśli odpowiednie.
- Dla MEMBER_OF / LEADS / APPOINTED: jeśli znany okres, wypełnij `attributes.since`
  i/lub `attributes.until` w ISO 8601; dla roli — `attributes.role`.
- Dla PARTICIPATED_IN: `attributes.role` ∈ {organizer, participant, speaker,
  victim, witness, target, host, guest}.
- Dla MET_WITH: `attributes.date` w ISO 8601, opcjonalnie `attributes.event_id` = null
  (nie znasz naszych ID — zawsze null).

NIE halucynuj. Jeśli czegoś nie ma w tekście, zostaw null albo pomiń pole.
Zwróć WYŁĄCZNIE obiekt JSON zgodny ze schematem. Nie dodawaj komentarzy.
"""


FEWSHOT_EXAMPLES = """\
PRZYKŁAD (tylko poglądowy; odpowiadaj na właściwy artykuł):

Wejście:
  Tytuł: "Tusk w Berlinie: będziemy wspierać Ukrainę"
  Tekst: "Premier Donald Tusk spotkał się w piątek z kanclerzem Niemiec Friedrichem Merzem.
  Szef polskiego rządu zapewnił, że Polska nadal będzie wspierać Ukrainę w wojnie z Rosją."

Wyjście (fragment):
  persons: [
    {surface_form: "Donald Tusk", canonical_name: "Donald Tusk", role: "premier RP", nationality: "PL"},
    {surface_form: "Friedrichem Merzem", canonical_name: "Friedrich Merz", role: "kanclerz Niemiec", nationality: "DE"}
  ]
  locations: [
    {surface_form: "Berlinie", canonical_name: "Berlin", level: "city", country: "DE"},
    {surface_form: "Ukrainę", canonical_name: "Ukraina", level: "country", country: "UA"},
    {surface_form: "Rosją", canonical_name: "Rosja", level: "country", country: "RU"}
  ]
  events: [
    {surface_form: "spotkał się", canonical_name: "spotkanie Tusk–Merz (Berlin)",
     eventType: "spotkanie", startDate: "..."}
  ]
  relationships: [
    {type: "MET_WITH", from_surface_form: "Donald Tusk", to_surface_form: "Friedrichem Merzem",
     attributes: {date: "..."}},
    {type: "TOOK_PLACE_IN", from_surface_form: "spotkał się", to_surface_form: "Berlinie"}
  ]
"""


def build_extraction_user_prompt(
    *,
    title: str,
    url: str | None,
    date_published: str | None,
    text: str,
    ner_hints: list[str] | None = None,
) -> str:
    hints_block = ""
    if ner_hints:
        short = ", ".join(sorted(set(ner_hints))[:30])
        hints_block = (
            "\nKOTWICE (wstępne encje znalezione przez NER — traktuj jako podpowiedź, "
            f"nie jako ostateczną listę):\n{short}\n"
        )
    return (
        f"Artykuł do analizy.\n\n"
        f"Tytuł: {title}\n"
        f"URL: {url or '(brak)'}\n"
        f"Data publikacji: {date_published or '(brak)'}\n"
        f"{hints_block}\n"
        f"TREŚĆ:\n{text}\n"
    )


DISAMBIGUATION_SYSTEM_PROMPT = """\
Jesteś precyzyjnym asystentem łączącym wzmianki w tekście z istniejącymi
bytami w bazie wiedzy. Odpowiadasz WYŁĄCZNIE zgodnie z wymaganym JSON,
bez żadnych dodatkowych komentarzy.
"""


def build_disambiguation_user_prompt(
    *,
    article_title: str,
    sentence_context: str,
    surface_form: str,
    candidates: list[dict],
) -> str:
    lines = []
    for i, c in enumerate(candidates[:3], start=1):
        aliases_str = ", ".join(c.get("aliases", [])[:3]) or "(brak)"
        role_str = c.get("role") or "(brak)"
        lines.append(
            f"{i}. [{c['id']}] {c['canonical_name']} — role: {role_str}, aliases: {aliases_str}"
        )
    cand_block = "\n".join(lines) if lines else "(brak kandydatów)"
    return (
        f"W artykule \"{article_title}\" pojawia się wzmianka: \"{surface_form}\"\n"
        f"w kontekście zdania: \"{sentence_context}\"\n\n"
        "Czy odnosi się ona do któregoś z poniższych bytów, czy jest to NOWA encja?\n\n"
        f"Kandydaci:\n{cand_block}\n\n"
        "Odpowiedz TYLKO obiektem JSON w polu `choice`: identyfikatorem "
        "(np. \"PER_abc123\") lub literałem \"NEW\"."
    )
