FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:/root/.local/bin:${PATH}" \
    HF_HOME=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence-transformers

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# uv installer (no network needed at runtime after this)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

WORKDIR /app

# Install deps first to leverage docker layer cache
COPY pyproject.toml ./
COPY README.md ./
# uv.lock is generated on first run; allow absence
RUN uv sync --no-install-project --no-dev || uv sync --no-install-project

# Prefetch MMLW + spaCy models BEFORE copying source, so the ~1.3 GB download is
# cached and only re-runs when pyproject.toml changes — not on every code edit.
# Uses the venv python directly (on PATH) so uv doesn't try to install the
# not-yet-copied project. Best-effort: the container still builds if offline.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sdadas/mmlw-retrieval-roberta-large-v2')" || echo "[warn] MMLW prefetch skipped"
RUN python -c "import spacy; spacy.load('pl_core_news_lg')" || echo "[warn] spaCy model prefetch skipped"

# Copy source tree + proto
COPY src ./src
COPY scripts ./scripts
COPY proto ./proto

# Install the project itself
RUN uv sync --no-dev || uv sync

# Generate gRPC stubs from the proto into src/newsgraph/grpcgen/
RUN uv run bash scripts/gen_grpc.sh

RUN mkdir -p /app/logs

EXPOSE 50051

# Start the gRPC extractor server (ensures Neo4j indexes on boot, then serves).
CMD ["uv", "run", "newsgraph", "serve"]
