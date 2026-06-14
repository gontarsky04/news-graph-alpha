# NewsGraph Backend

Java Spring Boot API for NewsGraph.

## Prerequisites

- JDK 21+
- Neo4j (Docker Compose includes one, or use Neo4j Aura)
- The Python **extractor** gRPC service running (see `../extractor/`); the
  backend calls it for extraction + entity linking

## Quick start (local)

1. Copy config:

   ```powershell
   cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
   ```

2. Fill in Neo4j Aura credentials. The extractor target defaults to
   `localhost:50051` (override with `newsgraph.extractor.target`).

3. Run:

   ```powershell
   $env:SPRING_PROFILES_ACTIVE="local"
   .\mvnw.cmd spring-boot:run
   ```

4. Health check:

   ```
   GET http://localhost:8080/api/health/live
   GET http://localhost:8080/api/health
   ```

## Neo4j setup

Run `../scripts/neo4j-init.cypher` once in Neo4j Browser (Aura or local).

## Uploading an article

Upload via the frontend, or post an article JSON directly:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/articles" `
  -ContentType "application/json" `
  -Body (Get-Content "article.json" -Raw)
```

The body needs `title` and `body`; `source`, `author`, `date`, `tags` are optional.

## Docker

Built via root `docker-compose.yml` — uses profile `docker` and `application-docker.yml`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEO4J_URI` | e.g. `bolt://neo4j:7687` or Aura `neo4j+s://...` |
| `NEO4J_USERNAME` | Neo4j username |
| `NEO4J_PASSWORD` | Neo4j password |
| `NEO4J_DATABASE` | Database name |
| `EXTRACTOR_TARGET` | extractor gRPC host:port (e.g. `extractor:50051`) |
| `EXTRACTOR_DEADLINE_SECONDS` | per-article gRPC deadline (default `120`) |
| `CORS_ALLOWED_ORIGINS` | Frontend URL(s) |
