#!/usr/bin/env python3
"""
Golden Evaluation Harness for GramSahayak RAG Service (RAG-06).

Runs:
1. Golden Set Evaluation (9 rows: G1-G5, G7, S1-S3 from rag/eval/golden.json)
   - matched_scheme_id check
   - must_contain_any (helpline / key term) check
   - must_not_contain (URLs when for_voice, pesticide dose words) check
   - Unicode script check (>= 50% of letters in expected Unicode block: devanagari | tamil | latin)
   - max_sentences check
   - max_latency_ms check
   - verbatim sms_summary check (<= 160 chars, exact match to schemes.json)
   - "no hallucinated numbers" check (every number of >= 3 digits in a scheme answer must appear in the matched scheme card)
2. Cross-Lingual Consistency Test (PMKISAN and JSY across hi-IN, mr-IN, ta-IN, en-IN)
3. 20-Query Sequential Latency Benchmark (prints p50 and p95)

Exits non-zero if any check fails.
"""

import argparse
import json
import logging
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

EVAL_DIR = Path(__file__).resolve().parent
RAG_ROOT = EVAL_DIR.parent
REPO_ROOT = RAG_ROOT.parent
GOLDEN_PATH = EVAL_DIR / "golden.json"
SCHEMES_PATH = REPO_ROOT / "data" / "seed" / "schemes.json"

if str(RAG_ROOT) not in sys.path:
    sys.path.insert(0, str(RAG_ROOT))


# Cross-lingual test queries (Requirement 3: same intent in hi, mr, ta, en for PMKISAN and JSY)
CROSS_LINGUAL_CASES: List[Dict[str, Any]] = [
    # PMKISAN in 4 languages
    {
        "scheme": "PMKISAN",
        "language": "hi-IN",
        "category": "schemes",
        "role": "farmer",
        "query": "पीएम किसान योजना के लिए कौन पात्र है?",
    },
    {
        "scheme": "PMKISAN",
        "language": "mr-IN",
        "category": "schemes",
        "role": "farmer",
        "query": "पीएम किसान सन्मान निधी योजनेसाठी कोण पात्र आहे?",
    },
    {
        "scheme": "PMKISAN",
        "language": "ta-IN",
        "category": "schemes",
        "role": "farmer",
        "query": "பிஎம் கிசான் திட்டத்திற்கு யார் தகுதியானவர்கள்?",
    },
    {
        "scheme": "PMKISAN",
        "language": "en-IN",
        "category": "schemes",
        "role": "farmer",
        "query": "Who is eligible for the PM Kisan Samman Nidhi scheme?",
    },
    # JSY in 4 languages
    {
        "scheme": "JSY",
        "language": "hi-IN",
        "category": "health",
        "role": "asha",
        "query": "जननी सुरक्षा योजना में प्रसव पर कितनी राशि मिलती है?",
    },
    {
        "scheme": "JSY",
        "language": "mr-IN",
        "category": "health",
        "role": "asha",
        "query": "जननी सुरक्षा योजनेत प्रसूतीसाठी किती पैसे मिळतात?",
    },
    {
        "scheme": "JSY",
        "language": "ta-IN",
        "category": "health",
        "role": "asha",
        "query": "ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?",
    },
    {
        "scheme": "JSY",
        "language": "en-IN",
        "category": "health",
        "role": "asha",
        "query": "How much cash assistance is given under Janani Suraksha Yojana (JSY)?",
    },
]


def load_scheme_cards() -> Dict[str, Dict[str, Any]]:
    """Load canonical scheme cards from /data/seed/schemes.json keyed by scheme code."""
    with open(SCHEMES_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    schemes_list = raw.get("schemes", []) if isinstance(raw, dict) else raw
    cards: Dict[str, Dict[str, Any]] = {}
    for card in schemes_list:
        code = str(card.get("code") or card.get("id") or "").strip()
        if code:
            cards[code] = card
    return cards


def normalize_digits(text: str) -> str:
    """Convert Devanagari and Tamil digits to ASCII digits and strip numeric grouping commas."""
    trans = str.maketrans(
        "०१२३४५६७८९௦௧௨௩௪௫௬௭௮௯",
        "01234567890123456789",
    )
    translated = text.translate(trans)
    # Remove commas inside numbers like 6,000 or 1,50,000
    return re.sub(r"(?<=\d),(?=\d)", "", translated)


def extract_numbers_3plus(text: str) -> List[str]:
    """Return all numbers of 3 or more digits in text after normalizing digits and commas."""
    norm = normalize_digits(text)
    return re.findall(r"\d{3,}", norm)


def build_card_number_corpus(card: Dict[str, Any]) -> str:
    """Flatten all fields of a scheme card into a normalized string for number grounding checks."""
    serialized = json.dumps(card, ensure_ascii=False)
    return normalize_digits(serialized)


def check_script_ratio(text: str, expected_script: str) -> Tuple[bool, float]:
    """
    Verify that at least 50% of letters (c.isalpha()) in text belong to the expected Unicode block:
    - devanagari: U+0900..U+097F
    - tamil:      U+0B80..U+0BFF
    - latin:      U+0041..U+007A
    """
    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return False, 0.0

    matching = 0
    for ch in letters:
        cp = ord(ch)
        if expected_script == "devanagari" and 0x0900 <= cp <= 0x097F:
            matching += 1
        elif expected_script == "tamil" and 0x0B80 <= cp <= 0x0BFF:
            matching += 1
        elif expected_script == "latin" and ((0x0041 <= cp <= 0x005A) or (0x0061 <= cp <= 0x007A)):
            matching += 1

    ratio = matching / len(letters)
    return ratio >= 0.50, ratio


def count_sentences(text: str) -> int:
    """Count sentences split by sentence-ending punctuation (. । ! ?)."""
    parts = [
        s.strip()
        for s in re.split(r"(?<=[.।!?])\s+", text.strip())
        if s.strip()
    ]
    return max(1, len(parts)) if text.strip() else 0


def build_caller(
    base_url: str,
    verbose: bool = False,
) -> Tuple[Callable[[Dict[str, Any]], Dict[str, Any]], str]:
    """
    Return a callable that posts payloads to /rag/query against either the live HTTP server
    at base_url or an in-process FastAPI TestClient if base_url is not reachable.
    """
    health_url = f"{base_url.rstrip('/')}/health"
    try:
        with urllib.request.urlopen(health_url, timeout=2.0) as resp:
            if resp.status == 200:
                query_url = f"{base_url.rstrip('/')}/rag/query"

                def _http_call(payload: Dict[str, Any]) -> Dict[str, Any]:
                    req = urllib.request.Request(
                        query_url,
                        data=json.dumps(payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST",
                    )
                    t0 = time.perf_counter()
                    with urllib.request.urlopen(req, timeout=10.0) as r:
                        body = json.loads(r.read().decode("utf-8"))
                    wall_ms = int((time.perf_counter() - t0) * 1000)
                    body.setdefault("latency_ms", wall_ms)
                    return body

                return _http_call, f"HTTP ({base_url})"
    except Exception:
        pass

    from fastapi.testclient import TestClient
    from app.main import app
    from app.rag import rag_engine

    if not verbose:
        for logger_name in (
            "httpx",
            "gramsahayak.api",
            "gramsahayak.rag",
            "sentence_transformers",
        ):
            logging.getLogger(logger_name).setLevel(logging.WARNING)

    rag_engine.ensure_initialized_sync()
    client = TestClient(app)

    def _inproc_call(payload: Dict[str, Any]) -> Dict[str, Any]:
        t0 = time.perf_counter()
        resp = client.post("/rag/query", json=payload)
        wall_ms = int((time.perf_counter() - t0) * 1000)
        if resp.status_code != 200:
            raise RuntimeError(f"POST /rag/query failed with HTTP {resp.status_code}: {resp.text}")
        body = resp.json()
        body.setdefault("latency_ms", wall_ms)
        return body

    return _inproc_call, "In-Process TestClient (app.main:app)"


def evaluate_golden_row(
    row: Dict[str, Any],
    resp: Dict[str, Any],
    cards: Dict[str, Dict[str, Any]],
) -> Tuple[bool, str]:
    """Validate a single golden row response against all RAG-06 rules."""
    reasons: List[str] = []

    answer = str(resp.get("answer") or "").strip()
    matched = resp.get("matched_scheme_id")
    sms_summary = resp.get("sms_summary")
    latency_ms = int(resp.get("latency_ms") or 0)

    # 1. matched_scheme_id check
    expected_scheme = row.get("expect_matched_scheme_id")
    if matched != expected_scheme:
        reasons.append(f"scheme={matched!r} (expected {expected_scheme!r})")

    # 2. must_contain_any check
    must_any: List[str] = row.get("must_contain_any") or []
    if must_any:
        if not any(token.lower() in answer.lower() for token in must_any):
            reasons.append(f"missing any of {must_any}")

    # 3. must_not_contain check
    must_not: List[str] = row.get("must_not_contain") or []
    for forbidden in must_not:
        if forbidden.lower() in answer.lower():
            reasons.append(f"contains forbidden {forbidden!r}")

    # 4. Script check (>= 50% of letters belong to expected_script)
    expect_script = row.get("expect_script")
    if expect_script:
        script_ok, ratio = check_script_ratio(answer, expect_script)
        if not script_ok:
            reasons.append(f"script {expect_script} ratio={ratio:.2f} (<0.50)")

    # 5. Sentence count check
    max_sentences = int(row.get("max_sentences") or 5)
    sent_count = count_sentences(answer)
    if sent_count > max_sentences:
        reasons.append(f"sentences={sent_count} (max {max_sentences})")

    # 6. Latency check
    max_latency_ms = int(row.get("max_latency_ms") or 1500)
    if latency_ms > max_latency_ms:
        reasons.append(f"latency={latency_ms}ms (max {max_latency_ms}ms)")

    # 7. Verbatim sms_summary & "no hallucinated numbers" check for scheme answers
    if expected_scheme:
        card = cards.get(expected_scheme)
        if card is None:
            reasons.append(f"unknown scheme card {expected_scheme}")
        else:
            expected_sms = (card.get("sms_summary") or {}).get(row["language"]) or (
                card.get("sms_summary") or {}
            ).get("en-IN")
            if sms_summary != expected_sms:
                reasons.append("sms_summary mismatch vs schemes.json")
            elif sms_summary and len(sms_summary) > 160:
                reasons.append(f"sms_summary len={len(sms_summary)} (>160)")

            card_corpus = build_card_number_corpus(card)
            nums_in_answer = extract_numbers_3plus(answer)
            hallucinated = [num for num in nums_in_answer if num not in card_corpus]
            if hallucinated:
                reasons.append(f"hallucinated numbers={hallucinated}")

    if reasons:
        return False, "; ".join(reasons)
    return True, "ok"


def percentile(sorted_vals: List[float], pct: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = max(0, min(len(sorted_vals) - 1, math.ceil((pct / 100.0) * len(sorted_vals)) - 1))
    return sorted_vals[idx]


def main() -> int:
    parser = argparse.ArgumentParser(description="GramSahayak RAG Golden Eval Harness (RAG-06)")
    parser.add_argument(
        "--url",
        default=os.getenv("RAG_URL", "http://localhost:8000"),
        help="Base URL of the running RAG service (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--simulate-broken-prompt",
        action="store_true",
        help="Simulate a broken prompt (hallucinated number + wrong script + URL in voice) to verify loud failure.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show per-request server/client INFO logs during in-process runs.",
    )
    args = parser.parse_args()

    if not args.verbose:
        for logger_name in (
            "httpx",
            "gramsahayak.api",
            "gramsahayak.rag",
            "sentence_transformers",
        ):
            logging.getLogger(logger_name).setLevel(logging.WARNING)

    t_start = time.perf_counter()
    cards = load_scheme_cards()
    with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
        golden_rows: List[Dict[str, Any]] = json.load(f)

    call_rag, transport_label = build_caller(args.url, verbose=args.verbose)
    print(f"=== GramSahayak RAG Golden Eval Harness ({transport_label}) ===")

    # 1. Golden queries table
    print("\n[1/3] Golden Queries (9 rows: G1-G5, G7, S1-S3)")
    header = f"{'ID':<4} | {'STATUS':<6} | {'LATENCY':>8} | {'MODE':<10} | {'REASON'}"
    print(header)
    print("-" * len(header) + "-" * 35)

    all_passed = True
    for row in golden_rows:
        payload = {
            "query": row["query"],
            "language": row["language"],
            "category": row["category"],
            "role": row["role"],
            "for_voice": row["for_voice"],
            "history": [],
        }
        resp = call_rag(payload)
        if args.simulate_broken_prompt and row["id"] == "G1":
            resp["answer"] = "PM-KISAN gives Rs 99999 per year at https://pmkisan.gov.in in English only."

        passed, reason = evaluate_golden_row(row, resp, cards)
        if not passed:
            all_passed = False
        status_str = "PASS" if passed else "FAIL"
        lat_str = f"{int(resp.get('latency_ms', 0))} ms"
        mode_str = str(resp.get("mode", "unknown"))
        print(f"{row['id']:<4} | {status_str:<6} | {lat_str:>8} | {mode_str:<10} | {reason}")

    # 2. Cross-lingual test (PMKISAN and JSY in hi-IN, mr-IN, ta-IN, en-IN)
    print("\n[2/3] Cross-Lingual Consistency Test (PMKISAN & JSY across hi, mr, ta, en)")
    cl_header = f"{'SCHEME':<8} | {'LANG':<6} | {'STATUS':<6} | {'MATCHED':<8} | {'LATENCY':>8}"
    print(cl_header)
    print("-" * len(cl_header))

    for case in CROSS_LINGUAL_CASES:
        resp = call_rag(
            {
                "query": case["query"],
                "language": case["language"],
                "category": case["category"],
                "role": case["role"],
                "for_voice": False,
                "history": [],
            }
        )
        matched = resp.get("matched_scheme_id")
        ok = matched == case["scheme"]
        if not ok:
            all_passed = False
        print(
            f"{case['scheme']:<8} | {case['language']:<6} | {('PASS' if ok else 'FAIL'):<6} | "
            f"{str(matched):<8} | {int(resp.get('latency_ms', 0)):>5} ms"
        )

    # 3. 20 sequential queries latency benchmark
    print("\n[3/3] Latency Benchmark (20 sequential queries)")
    latencies: List[float] = []
    for i in range(20):
        row = golden_rows[i % len(golden_rows)]
        t_q0 = time.perf_counter()
        resp = call_rag(
            {
                "query": row["query"],
                "language": row["language"],
                "category": row["category"],
                "role": row["role"],
                "for_voice": row["for_voice"],
                "history": [{"role": "user", "content": f"turn_{i}"}],
            }
        )
        wall_ms = (time.perf_counter() - t_q0) * 1000.0
        reported_ms = float(resp.get("latency_ms") or wall_ms)
        latencies.append(max(wall_ms, reported_ms))

    sorted_lat = sorted(latencies)
    p50_ms = percentile(sorted_lat, 50)
    p95_ms = percentile(sorted_lat, 95)
    mean_ms = sum(sorted_lat) / len(sorted_lat)
    lat_ok = p95_ms <= 1500.0
    if not lat_ok:
        all_passed = False

    print(
        f"20 queries completed: p50={p50_ms:.1f} ms | p95={p95_ms:.1f} ms | "
        f"min={sorted_lat[0]:.1f} ms | max={sorted_lat[-1]:.1f} ms | mean={mean_ms:.1f} ms "
        f"(budget p95 <= 1500 ms: {'PASS' if lat_ok else 'FAIL'})"
    )

    total_sec = time.perf_counter() - t_start
    print(f"\nTotal eval runtime: {total_sec:.2f}s | Overall: {'PASS' if all_passed else 'FAIL'}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
