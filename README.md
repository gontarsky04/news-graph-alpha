# NewsGraph Alpha

News article knowledge-graph tool: upload articles → Gemini extracts entities & relationships → visualize in an interactive graph.

## Quick start (Docker — recommended)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
cd news-graph-alpha
cp .env.example .env
# Edit .env — set GEMINI_API_KEY

docker compose up --build
```

| Service   | URL |
|-----------|-----|
| **App**   | http://localhost:3000 |
| **API**   | http://localhost:8080/api/health |
| **Neo4j** | http://localhost:7474 (user `neo4j`, password from `.env` or `newsgraph`) |

Upload sample articles from `backend/samples/` via the **+ Wgraj artykuł** button in the dashboard.

### Neo4j constraints (optional, once)

Open Neo4j Browser at http://localhost:7474 and run queries from `scripts/neo4j-init.cypher`.

---

## Local development (without Docker)

### Backend

```powershell
cd backend
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
# Fill in Neo4j Aura credentials + GEMINI_API_KEY

$env:SPRING_PROFILES_ACTIVE="local"
.\mvnw.cmd spring-boot:run
```

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
├── backend/          # Spring Boot 4 API + Gemini extraction
├── frontend/         # React + Reagraph UI
├── scripts/          # Neo4j init Cypher
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Environment variables

| Variable | Docker | Local (`application-local.yml`) |
|----------|--------|----------------------------------|
| `GEMINI_API_KEY` | `.env` | `newsgraph.gemini.api-key` |
| `GEMINI_MODEL` | `.env` (default `gemini-2.5-flash-lite`) | same |
| `NEO4J_URI` | auto (`bolt://neo4j:7687`) | Aura URI |
| `NEO4J_USERNAME` | `neo4j` | Aura username |
| `NEO4J_PASSWORD` | `.env` | Aura password |
| `NEO4J_DATABASE` | `neo4j` | Aura database name |

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend + Neo4j status |
| GET | `/api/graph` | Full graph (nodes + relationships) |
| GET | `/api/articles` | List articles |
| POST | `/api/articles` | Upload & process article JSON |
| POST | `/api/articles/{id}/retry` | Retry failed article |
| DELETE | `/api/articles/{id}` | Delete article from graph |
