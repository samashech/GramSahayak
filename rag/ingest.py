"""Schema-first Chroma ingestion module and CLI for GramSahayak RAG (RAG-02)."""

import argparse
import json
import logging
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any, List, Optional, Tuple

from langchain_core.documents import Document
from pypdf import PdfReader

from app.config import settings

logger = logging.getLogger("gramsahayak.ingest")

GUIDE_CATEGORY_MAP: dict[str, str] = {
    "agri.md": "agri",
    "health.md": "health",
    "education.md": "education",
}

GUIDE_DEFAULTS: dict[str, dict[str, str]] = {
    "agri": {
        "helpline": "1800-180-1551",
        "portal_url": "https://soilhealth.dac.gov.in",
    },
    "health": {
        "helpline": "108 / 102 / 104",
        "portal_url": "https://nhm.gov.in",
    },
    "education": {
        "helpline": "0120-6619540",
        "portal_url": "https://scholarships.gov.in",
    },
    "schemes": {
        "helpline": "155261",
        "portal_url": "https://pmkisan.gov.in",
    },
}


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return slug or "section"


def _split_long_text(text: str, min_chars: int, max_chars: int, overlap: int) -> List[str]:
    """Split text exceeding max_chars into chunks between min_chars and max_chars with overlap."""
    cleaned = text.strip()
    if len(cleaned) <= max_chars:
        return [cleaned] if cleaned else []

    chunks: List[str] = []
    start = 0
    length = len(cleaned)
    while start < length:
        end = min(start + max_chars, length)
        if end < length:
            # Prefer breaking at newline, sentence boundary, or space above min_chars
            window = cleaned[start:end]
            split_pos = -1
            for sep in ["\n\n", "\n", ". ", "। ", "; ", " "]:
                pos = window.rfind(sep)
                if pos >= min_chars:
                    split_pos = pos + len(sep)
                    break
            if split_pos > 0:
                end = start + split_pos

        piece = cleaned[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= length:
            break
        start = max(end - overlap, start + 1)
    return chunks


def build_scheme_card_document(card: dict[str, Any], source_name: str = "schemes.json") -> Tuple[str, Document]:
    """Build ONE self-contained schema-first chunk per scheme card with 'passage: ' prefix."""
    code = str(card["code"]).strip()
    card_id = str(card.get("id", code)).strip()
    category = str(card["category"]).strip()
    target_role = str(card.get("target_role", "farmer")).strip()
    name_en = str(card.get("name_en", code)).strip()
    name_hi = str(card.get("name_hi", "")).strip()
    name_mr = str(card.get("name_mr", "")).strip()
    name_ta = str(card.get("name_ta", "")).strip()
    benefits = str(card.get("benefits", "")).strip()
    eligibility = str(card.get("eligibility", "")).strip()
    exclusions = str(card.get("exclusions", "")).strip()
    documents_list = card.get("documents") or []
    documents_str = ", ".join(str(d) for d in documents_list)
    how_to_apply = str(card.get("how_to_apply", "")).strip()
    helpline = str(card.get("helpline", "")).strip()
    portal_url = str(card.get("portal_url", "")).strip()
    sms_summary_obj = card.get("sms_summary") or {}
    sms_summary_json = json.dumps(sms_summary_obj, ensure_ascii=False)

    # Include multilingual summaries in the passage body so regional queries (hi/mr/ta/en) retrieve with high cosine similarity
    multilingual_summaries = " | ".join(
        f"{lang}: {txt}" for lang, txt in sms_summary_obj.items() if txt
    )

    page_content = (
        f"passage: Scheme {code} ({card_id}): "
        f"{name_en} | {name_hi} | {name_mr} | {name_ta}\n"
        f"Category: {category} | Target Role: {target_role}\n"
        f"Benefits: {benefits}\n"
        f"Eligibility: {eligibility}\n"
        f"Exclusions: {exclusions}\n"
        f"Documents Required: {documents_str}\n"
        f"How to Apply: {how_to_apply}\n"
        f"Helpline: {helpline} | Official Portal: {portal_url}\n"
        f"Multilingual Summary: {multilingual_summaries}"
    )

    metadata = {
        "id": card_id,
        "code": code,
        "category": category,
        "target_role": target_role,
        "helpline": helpline,
        "portal_url": portal_url,
        "title": name_en,
        "name_en": name_en,
        "name_hi": name_hi,
        "name_mr": name_mr,
        "name_ta": name_ta,
        "source": source_name,
        "kind": "scheme",
        "sms_summary": sms_summary_json,
    }
    doc_id = f"{source_name}::{code}::0"
    return doc_id, Document(page_content=page_content, metadata=metadata)


def load_scheme_documents(schemes_path: Path) -> List[Tuple[str, Document]]:
    """Read /data/seed/schemes.json and create one Document per scheme card."""
    raw = json.loads(schemes_path.read_text(encoding="utf-8"))
    if isinstance(raw, dict):
        cards = [raw]
    else:
        cards = list(raw)

    results: List[Tuple[str, Document]] = []
    for card in cards:
        doc_id, doc = build_scheme_card_document(card, source_name=schemes_path.name)
        results.append((doc_id, doc))
    return results


def load_guide_documents(guide_path: Path, category: str) -> List[Tuple[str, Document]]:
    """
    Split a markdown guide on ## and ### headings.
    Every chunk starts with 'passage: ', the file title, and its heading hierarchy;
    target 500-900 characters, with overlap only when a section is longer.
    """
    text = guide_path.read_text(encoding="utf-8")
    lines = text.splitlines()

    doc_title = guide_path.stem.capitalize()
    intro_lines: List[str] = []
    current_h2: Optional[str] = None
    current_h3: Optional[str] = None
    section_lines: List[str] = []
    raw_sections: List[Tuple[str, str]] = []

    def flush_section() -> None:
        nonlocal section_lines
        body = "\n".join(section_lines).strip()
        section_lines = []
        if not body:
            return
        if current_h2 and current_h3:
            heading = f"## {current_h2} - ### {current_h3}"
        elif current_h2:
            heading = f"## {current_h2}"
        elif current_h3:
            heading = f"### {current_h3}"
        else:
            heading = "## Overview"
        raw_sections.append((heading, body))

    for line in lines:
        if line.startswith("# ") and not line.startswith("## "):
            doc_title = line.lstrip("#").strip()
        elif line.startswith("## ") and not line.startswith("### "):
            flush_section()
            current_h2 = line[3:].strip()
            current_h3 = None
        elif line.startswith("### "):
            flush_section()
            current_h3 = line[4:].strip()
        else:
            if current_h2 is None and current_h3 is None:
                if line.strip():
                    intro_lines.append(line.strip())
            else:
                section_lines.append(line)

    flush_section()

    # Merge tiny sibling ### subsections under the same ## heading so chunks stay self-contained around 500-900 chars
    merged_sections: List[Tuple[str, str]] = []
    for heading, body in raw_sections:
        full_candidate = f"{heading}\n{body}"
        if (
            merged_sections
            and " - ### " in heading
            and merged_sections[-1][0].split(" - ### ")[0] == heading.split(" - ### ")[0]
            and len(merged_sections[-1][1]) + len(full_candidate) + 2 <= 860
        ):
            prev_h, prev_b = merged_sections[-1]
            parent_h2 = heading.split(" - ### ")[0]
            sub_h3 = heading.split(" - ### ")[1]
            merged_sections[-1] = (prev_h, f"{prev_b}\n\n{sub_h3}\n{body}")
        else:
            merged_sections.append((heading, body))

    defaults = GUIDE_DEFAULTS.get(category, GUIDE_DEFAULTS["schemes"])
    results: List[Tuple[str, Document]] = []
    intro_context = " ".join(intro_lines).strip()

    for sec_idx, (heading, body) in enumerate(merged_sections):
        clean_heading = heading.replace("## ", "").replace("### ", "").strip()
        prefix = f"{doc_title} | {heading}\n"
        max_body_chars = max(350, 880 - len(prefix) - len("passage: "))
        body_with_intro = body
        if len(prefix) + len(body) < 500 and intro_context:
            body_with_intro = f"{body}\n\nContext: {intro_context}"

        pieces = _split_long_text(
            body_with_intro,
            min_chars=350,
            max_chars=max_body_chars,
            overlap=100,
        )

        for chunk_idx, piece in enumerate(pieces):
            chunk_id = f"{guide_path.name}::{_slugify(clean_heading)}::{sec_idx}_{chunk_idx}"
            page_content = f"passage: {prefix}{piece}".strip()
            metadata = {
                "id": f"GUIDE_{category.upper()}_{sec_idx + 1}",
                "code": f"GUIDE_{category.upper()}",
                "category": category,
                "kind": "guide",
                "title": f"{doc_title} — {clean_heading}",
                "source": guide_path.name,
                "helpline": defaults["helpline"],
                "portal_url": defaults["portal_url"],
            }
            results.append((chunk_id, Document(page_content=page_content, metadata=metadata)))

    return results


def load_raw_file_documents(file_path: Path, category: str) -> List[Tuple[str, Document]]:
    """
    Ingest a raw file (.pdf with pypdf, .txt, .md, or .json scheme card).
    Chunks 600-900 characters with 100 overlap, prefixed with 'passage: ' + document title.
    """
    suffix = file_path.suffix.lower()
    if suffix == ".json":
        return load_scheme_documents(file_path)

    # Check if this is one of the seed guide markdown files
    if suffix == ".md" and file_path.parent.resolve() == settings.SEED_DIR.resolve():
        return load_guide_documents(file_path, category=category)

    if suffix == ".pdf":
        reader = PdfReader(str(file_path))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        raw_text = "\n\n".join(p.strip() for p in pages_text if p.strip())
    elif suffix in {".md", ".txt"}:
        raw_text = file_path.read_text(encoding="utf-8")
    else:
        raise ValueError(f"Unsupported file extension '{suffix}'. Allowed: .pdf, .md, .txt, .json")

    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    doc_title = file_path.stem.replace("_", " ").replace("-", " ").title()
    if lines and lines[0].startswith("#"):
        doc_title = lines[0].lstrip("#").strip()

    prefix = f"{doc_title}\n"
    max_body = max(400, 880 - len(prefix) - len("passage: "))
    pieces = _split_long_text(raw_text, min_chars=500, max_chars=max_body, overlap=100)

    defaults = GUIDE_DEFAULTS.get(category, GUIDE_DEFAULTS["schemes"])
    results: List[Tuple[str, Document]] = []
    for idx, piece in enumerate(pieces):
        chunk_id = f"{file_path.name}::{_slugify(doc_title)}::{idx}"
        page_content = f"passage: {prefix}{piece}".strip()
        metadata = {
            "id": f"RAW_{_slugify(file_path.stem).upper()}_{idx + 1}",
            "code": f"RAW_{_slugify(file_path.stem).upper()}",
            "category": category,
            "kind": "guide",
            "title": doc_title,
            "source": file_path.name,
            "helpline": defaults["helpline"],
            "portal_url": defaults["portal_url"],
        }
        results.append((chunk_id, Document(page_content=page_content, metadata=metadata)))

    return results


def collect_all_seed_documents() -> List[Tuple[str, Document]]:
    """Collect all seed scheme chunks and guide chunks (plus any files in /data/raw)."""
    all_items: List[Tuple[str, Document]] = []

    schemes_file = settings.SEED_DIR / "schemes.json"
    if schemes_file.exists():
        all_items.extend(load_scheme_documents(schemes_file))

    for guide_name, category in GUIDE_CATEGORY_MAP.items():
        guide_file = settings.SEED_DIR / guide_name
        if guide_file.exists():
            all_items.extend(load_guide_documents(guide_file, category=category))

    if settings.RAW_DIR.exists():
        for raw_file in sorted(settings.RAW_DIR.iterdir()):
            if raw_file.is_file() and raw_file.suffix.lower() in {".pdf", ".txt", ".md", ".json"}:
                all_items.extend(load_raw_file_documents(raw_file, category="schemes"))

    return all_items


def run_seed_ingest(reset: bool = False) -> dict[str, Any]:
    """Ingest all seed documents into Chroma idempotently and print summary statistics."""
    from app.rag import rag_engine

    t0 = time.perf_counter()
    rag_engine.ensure_initialized_sync()

    if reset:
        rag_engine.reset_collection()

    items = collect_all_seed_documents()
    ingested_count = rag_engine.upsert_documents(items)
    total_vectors = rag_engine.get_vector_count()
    elapsed_sec = time.perf_counter() - t0

    by_category: Counter[str] = Counter()
    by_kind: Counter[str] = Counter()
    for _doc_id, doc in items:
        by_category[str(doc.metadata.get("category", "unknown"))] += 1
        by_kind[str(doc.metadata.get("kind", "unknown"))] += 1

    summary = {
        "ingested_chunks": ingested_count,
        "by_kind": dict(by_kind),
        "by_category": dict(by_category),
        "vector_count": total_vectors,
        "elapsed_sec": round(elapsed_sec, 2),
    }

    print(
        f"Ingest complete in {elapsed_sec:.2f}s | "
        f"By kind: {dict(by_kind)} | "
        f"By category: {dict(by_category)} | "
        f"Total vectors: {total_vectors}"
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest seed scheme cards and domain guides into ChromaDB.")
    parser.add_argument("--reset", action="store_true", help="Recreate ChromaDB collection before ingesting")
    args = parser.parse_args()
    run_seed_ingest(reset=args.reset)


if __name__ == "__main__":
    main()
