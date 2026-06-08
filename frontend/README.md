# NewsGraph Frontend

React + Reagraph UI connected to the Java backend.

## Run (local dev)

```powershell
# From news-graph-alpha/
cd backend
$env:SPRING_PROFILES_ACTIVE="local"
.\mvnw.cmd spring-boot:run

# Separate terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Run (Docker)

See root `README.md` — app at http://localhost:3000

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — analyses, articles, upload |
| `/analysis/global` | Full Neo4j graph |
| `/analysis/:id` | Filtered analysis graph |

## Config

Copy `.env.example` to `.env` and set `VITE_API_URL` for local dev without Vite proxy (default: empty = same-origin / proxy).
