# NewsGraph Extractor

Python gRPC service that performs **knowledge-graph extraction + entity linking**
for the NewsGraph backend. Given an article (whose `Article` node the Spring
backend has already created), it:

1. **Preprocesses** the text — spaCy sentence split + NER hints (`pl_core_news_lg`).
2. **Extracts** entities & relationships with an LLM (OpenRouter, structured output).
3. **Links** each mention against the existing graph — Neo4j Lucene fulltext (fuzzy)
   + HNSW vector similarity on **MMLW** Polish embeddings + `rapidfuzz` rerank,
   routing to auto-merge / LLM-disambiguate / create-new by score.
4. **Writes** entities, relationships and `(:Article)-[:MENTIONS]->(:Entity)` edges
   to the shared Neo4j.

The Spring backend owns the `Article` node (status/body/tags/counts) and article
dedup; this service owns everything else above. They talk over gRPC
(`proto/extractor.proto`, `Extractor.ProcessArticle`).

## Layout

```
src/newsgraph/
├── grpc_server.py     # gRPC servicer + serve(); the service entrypoint
├── pipeline.py        # extract_link_persist() — the per-article pipeline
├── extraction/        # LLM extraction, prompts, spaCy preprocessing
├── linking/           # candidate search (lucene/vector), embeddings, entity linker
├── storage/           # Neo4j client (MERGE patterns, candidate queries)
├── schema.py          # Cypher DDL (constraints + fulltext/vector indexes)
├── models.py          # Pydantic models + enums (the extraction contract)
├── config.py          # settings (env-driven)
└── cli.py             # newsgraph {serve,init,import,reset,stats,debug-link}
```

## Run

```bash
export OPENROUTER_API_KEY=...   # plus NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD if not default
uv sync
bash scripts/gen_grpc.sh        # generate gRPC stubs into src/newsgraph/grpcgen/
uv run newsgraph serve          # ensures indexes, then serves on :50051
```

Settings are read from the environment (or a local `.env`) by `config.py`.

In Docker it's built and wired by the repo-root `docker-compose.yml` (the
`extractor` service); `newsgraph serve` runs the index DDL on boot.

## CLI (dev tools, no server needed)

| Command | Purpose |
|---------|---------|
| `newsgraph serve` | start the gRPC server (used in production) |
| `newsgraph init` | create constraints + indexes |
| `newsgraph import FILE.json` | run the full pipeline over a JSON file locally |
| `newsgraph stats` | node/relationship counts |
| `newsgraph debug-link Person "Donald Tusk"` | inspect linker candidate scores |
| `newsgraph reset [--yes]` | wipe the DB and recreate indexes |

## Key env vars

`OPENROUTER_API_KEY` (required), `LLM_MODEL`, `NEO4J_URI` / `NEO4J_USER` /
`NEO4J_PASSWORD` / `NEO4J_DATABASE`, `GRPC_PORT` (default `50051`),
`GRPC_MAX_WORKERS` (default `4`). See `config.py` for the full list and defaults.
