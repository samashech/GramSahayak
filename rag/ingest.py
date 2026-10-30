"""Schema-first Chroma ingestion CLI entrypoint for GramSahayak RAG (implemented in RAG-02)."""

import argparse
import logging

from app.config import settings
from app.rag import rag_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("gramsahayak.ingest")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest seed scheme cards and domain guides into ChromaDB.")
    parser.add_argument("--reset", action="store_true", help="Recreate ChromaDB collection before ingesting")
    args = parser.parse_args()

    rag_engine.initialize()
    logger.info(
        "Ingest skeleton ready (reset=%s, seed_dir=%s, vector_count=%d). Full ingestion logic arrives in RAG-02.",
        args.reset,
        settings.SEED_DIR,
        rag_engine.get_vector_count(),
    )


if __name__ == "__main__":
    main()
