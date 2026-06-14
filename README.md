# NewsGraph Alpha

News article knowledge-graph tool: upload articles → a Python extractor service
(LLM extraction + hybrid entity linking) writes entities & relationships to Neo4j
→ visualize in an interactive graph.

Extraction and entity resolution run in the **`extractor/`** Python service (the
vendored PoC pipeline: spaCy preprocessing, OpenRouter LLM extraction, then
Lucene + vector + rapidfuzz entity linking). The Spring Boot backend talks to it
over **gRPC** and owns the Article lifecycle + graph reads for the UI.

## Quick start (Docker — recommended)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) and an [OpenRouter API key](https://openrouter.ai/keys).

```bash
cd news-graph-alpha
cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY

docker compose up --build
```

> First boot downloads ~1.3 GB of models (MMLW embeddings + spaCy `pl_core_news_lg`)
> into the `hf_cache` / `st_cache` volumes — subsequent starts are fast.

| Service   | URL |
|-----------|-----|
| **App**   | http://localhost:3000 |
| **API**   | http://localhost:8080/api/health |
| **Neo4j** | http://localhost:7474 (user `neo4j`, password from `.env` or `newsgraph`) |

Upload an article JSON (fields `title`, `body`, optionally `source`/`author`/`date`/`tags`) via the **+ Wgraj artykuł** button in the dashboard.

### Neo4j constraints (optional, once)

Open Neo4j Browser at http://localhost:7474 and run queries from `scripts/neo4j-init.cypher`.

---

## Local development (without Docker)

### Extractor (Python gRPC service)

```bash
cd extractor
export OPENROUTER_API_KEY=...    # plus NEO4J_* if not using defaults (or a local .env)
uv sync
bash scripts/gen_grpc.sh        # generate gRPC stubs from proto/extractor.proto
uv run newsgraph serve          # listens on :50051
```

### Backend

```powershell
cd backend
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
# Fill in Neo4j Aura credentials; extractor target defaults to localhost:50051

$env:SPRING_PROFILES_ACTIVE="local"
.\mvnw.cmd spring-boot:run
```

> The Maven build generates the gRPC Java stubs from `proto/extractor.proto`
> (copied into `backend/src/main/proto/` by `scripts/sync-proto.sh`).

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to the backend on port 8080.

---

## Project layout

```
news-graph-alpha/
├── extractor/        # Python gRPC service: LLM extraction + entity linking (vendored PoC)
├── backend/          # Spring Boot 4 API: Article lifecycle + graph reads, gRPC client
├── frontend/         # React + Reagraph UI
├── proto/            # extractor.proto (canonical gRPC contract)
├── scripts/          # Neo4j init Cypher + sync-proto.sh
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Environment variables

| Variable | Docker | Notes |
|----------|--------|-------|
| `OPENROUTER_API_KEY` | `.env` (extractor) | required — LLM extraction |
| `LLM_MODEL` | `.env` (default `anthropic/claude-haiku-4.5`) | extractor |
| `EXTRACTOR_TARGET` | auto (`extractor:50051`) | backend → extractor gRPC |
| `EXTRACTOR_DEADLINE_SECONDS` | `.env` (default `120`) | per-article gRPC deadline |
| `NEO4J_URI` | auto (`bolt://neo4j:7687`) | shared by backend + extractor |
| `NEO4J_USERNAME` / `NEO4J_PASSWORD` | `neo4j` / `.env` | |
| `NEO4J_DATABASE` | `neo4j` | |

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend + Neo4j + extractor status |
| GET | `/api/graph` | Full graph (nodes + relationships) |
| GET | `/api/articles` | List articles |
| POST | `/api/articles` | Upload & process article JSON |
| POST | `/api/articles/{id}/retry` | Retry failed article |
| DELETE | `/api/articles/{id}` | Delete article from graph |
