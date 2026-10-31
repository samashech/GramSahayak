# GramSahayak backend container (DEC-19): Node gateway (public, $PORT) + Python RAG (127.0.0.1:8000 only).
# The frontend is deployed separately (Vercel). Secrets come from the host's environment, never the image.
#   docker build -t gramsahayak .
#   docker run --env-file .env -e DB_DRIVER=postgres -p 8080:8080 gramsahayak

FROM node:22-bookworm-slim AS node
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/hf ANONYMIZED_TELEMETRY=False TOKENIZERS_PARALLELISM=false \
    APP_ENV=production PORT=8080 AI_RAG_URL=http://127.0.0.1:8000 CHROMA_DIR=/app/rag/chroma_db
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app

# CPU-only torch first (no CUDA download), then the RAG requirements.
COPY rag/requirements.txt rag/requirements.txt
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r rag/requirements.txt
# Bake the embedding model into the image so a cold start does not download it.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-small')"

COPY --from=node /app/backend/node_modules backend/node_modules
COPY backend backend
COPY rag rag
COPY data/seed data/seed
COPY db/schema.sqlite.sql db/schema.sqlite.sql
COPY deploy/start.sh deploy/start.sh

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD curl -fs "http://127.0.0.1:${PORT}/api/health" || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash", "deploy/start.sh"]
