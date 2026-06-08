# NewsGraph Backend

Java Spring Boot API for NewsGraph.

## Prerequisites

- JDK 21+
- Neo4j (Docker Compose includes one, or use Neo4j Aura)
- Gemini API key

## Quick start (local)

1. Copy config:

   ```powershell
   cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
   ```

2. Fill in Neo4j Aura + Gemini credentials.

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

## Sample articles

JSON files in `samples/` — upload via the frontend or:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/articles" `
  -ContentType "application/json" `
  -Body (Get-Content "samples/article-upload.example.json" -Raw)
```

## Docker

Built via root `docker-compose.yml` — uses profile `docker` and `application-docker.yml`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEO4J_URI` | e.g. `bolt://neo4j:7687` or Aura `neo4j+s://...` |
| `NEO4J_USERNAME` | Neo4j username |
| `NEO4J_PASSWORD` | Neo4j password |
| `NEO4J_DATABASE` | Database name |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Default `gemini-2.5-flash-lite` |
| `CORS_ALLOWED_ORIGINS` | Frontend URL(s) |
