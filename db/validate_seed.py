#!/usr/bin/env python3
"""Validate /data/seed/schemes.json against Contract v1 & DB-03 rules.

Usage:
    python3 db/validate_seed.py [path] [--allow-subset]

Prints one PASS/FAIL line per check, prints a category & SMS summary length report,
and exits non-zero if any check fails.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = REPO_ROOT / "db" / ".venv" / "bin" / "python"

# Auto-reexec into db/.venv if invoked via system python3 without jsonschema installed.
if VENV_PYTHON.is_file() and Path(sys.prefix).resolve() != (REPO_ROOT / "db" / ".venv").resolve():
    try:
        import jsonschema  # noqa: F401
    except ImportError:
        os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])

SCHEMA_PATH = REPO_ROOT / "db" / "seed.schema.json"
DEFAULT_SEED_PATH = REPO_ROOT / "data" / "seed" / "schemes.json"

EXPECTED_CODES = (
    "PMKISAN",
    "PMFBY",
    "KCC",
    "SHC",
    "PMJAY",
    "JSY",
    "PMMVY",
    "MGNREGA",
    "UJJWALA",
    "PMAY",
    "NSP",
    "PMYASASVI",
    "PRAGATI",
)
CATEGORIES = ("schemes", "agri", "health", "education")
ROLES = ("farmer", "asha", "panchayat", "student")
OCCUPATIONS = ("farmer", "agri_labourer", "daily_wage", "student", "homemaker", "other")
SOCIAL_CATEGORIES = ("general", "obc", "sc", "st")
GENDERS = ("male", "female", "other")
REQUIRED_SMS_LANGS = ("en-IN", "hi-IN", "mr-IN", "ta-IN")
OPTIONAL_SMS_LANGS = ("gu-IN",)
ALLOWED_SMS_LANGS = set(REQUIRED_SMS_LANGS + OPTIONAL_SMS_LANGS)
ALLOWED_RULE_KEYS = {
    "occupations",
    "max_land_hectares",
    "bpl_only",
    "gender",
    "pregnant_only",
    "min_age",
    "max_age",
    "max_annual_income",
    "social_categories",
}

DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
TAMIL_RE = re.compile(r"[\u0B80-\u0BFF]")


def extract_portal_domain(portal_url: str) -> str:
    """Return normalized lowercase domain with leading 'www.' stripped."""
    if not isinstance(portal_url, str):
        return ""
    parsed = urlparse(portal_url.strip())
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def digits_only(text: str) -> str:
    if not isinstance(text, str):
        return ""
    return re.sub(r"\D", "", text)


def is_strict_int(val: Any) -> bool:
    return isinstance(val, int) and not isinstance(val, bool)


def is_strict_number(val: Any) -> bool:
    return isinstance(val, (int, float)) and not isinstance(val, bool)


def validate_json_schema(cards: Any, schema: dict[str, Any], allow_subset: bool) -> list[str]:
    """Validate against db/seed.schema.json using jsonschema (with stdlib fallback)."""
    errors: list[str] = []
    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        if not isinstance(cards, list):
            return ["Root JSON value must be an array of scheme cards"]
        required_card_keys = set(schema["$defs"]["SchemeCard"]["required"])
        for idx, card in enumerate(cards):
            if not isinstance(card, dict):
                errors.append(f"[{idx}] card must be an object")
                continue
            missing = sorted(required_card_keys - set(card.keys()))
            extra = sorted(set(card.keys()) - required_card_keys)
            if missing:
                errors.append(f"[{idx}] missing keys: {missing}")
            if extra:
                errors.append(f"[{idx}] unexpected keys: {extra}")
        return errors

    target_schema = schema
    if allow_subset:
        target_schema = {
            **schema,
            "minItems": 1,
            "maxItems": len(EXPECTED_CODES),
        }

    validator = Draft202012Validator(target_schema)
    for err in sorted(validator.iter_errors(cards), key=lambda e: list(e.absolute_path)):
        loc = ".".join(str(p) for p in err.absolute_path) or "<root>"
        if err.validator in ("minItems", "maxItems") and isinstance(err.instance, list):
            msg = f"array has {len(err.instance)} item(s); schema requires {err.validator}={err.validator_value}"
        else:
            msg = err.message if len(err.message) <= 180 else f"{err.message[:177]}..."
        errors.append(f"{loc}: {msg}")
    return errors


def run_validation(cards: Any, schema: dict[str, Any], allow_subset: bool = False) -> list[tuple[str, bool, str]]:
    """Run all DB-03 checks and return [(check_name, passed, detail), ...]."""
    results: list[tuple[str, bool, str]] = []

    # 1. JSON Schema valid
    schema_errors = validate_json_schema(cards, schema, allow_subset=allow_subset)
    results.append((
        "1. JSON Schema valid (db/seed.schema.json)",
        len(schema_errors) == 0,
        "all cards conform to schema" if not schema_errors else "; ".join(schema_errors[:5]),
    ))

    if not isinstance(cards, list) or not all(isinstance(c, dict) for c in cards):
        results.append(("2. Root structure array of objects", False, "Seed JSON must be a list of card objects"))
        return results

    # 2. IDs and codes unique and equal
    id_code_issues: list[str] = []
    seen_ids: set[str] = set()
    seen_codes: set[str] = set()
    for idx, c in enumerate(cards):
        cid = c.get("id")
        code = c.get("code")
        label = code or cid or f"index {idx}"
        if not cid or not code:
            id_code_issues.append(f"{label}: missing id or code")
            continue
        if cid != code:
            id_code_issues.append(f"{label}: id ({cid!r}) != code ({code!r})")
        if cid in seen_ids:
            id_code_issues.append(f"duplicate id {cid!r}")
        if code in seen_codes:
            id_code_issues.append(f"duplicate code {code!r}")
        seen_ids.add(cid)
        seen_codes.add(code)
    results.append((
        "2. IDs and codes unique and equal",
        len(id_code_issues) == 0,
        f"{len(seen_codes)} unique id==code pairs" if not id_code_issues else "; ".join(id_code_issues),
    ))

    # 3. Exactly the 13 expected codes (or valid subset with --allow-subset)
    expected_set = set(EXPECTED_CODES)
    actual_codes = [c.get("code") for c in cards if isinstance(c.get("code"), str)]
    actual_set = set(actual_codes)
    if allow_subset:
        unknown = sorted(actual_set - expected_set)
        ok_codes = 1 <= len(cards) <= len(EXPECTED_CODES) and not unknown
        detail_codes = (
            f"subset mode: {len(cards)} valid contract codes"
            if ok_codes
            else f"count={len(cards)}, unknown codes={unknown}"
        )
        check_label = "3. Contract scheme codes (--allow-subset)"
    else:
        missing = [c for c in EXPECTED_CODES if c not in actual_set]
        extra = sorted(actual_set - expected_set)
        ok_codes = len(cards) == len(EXPECTED_CODES) and not missing and not extra
        parts = []
        if len(cards) != len(EXPECTED_CODES):
            parts.append(f"count={len(cards)} (expected {len(EXPECTED_CODES)})")
        if missing:
            parts.append(f"missing={missing}")
        if extra:
            parts.append(f"unexpected={extra}")
        detail_codes = "all 13 contract codes present" if ok_codes else ", ".join(parts)
        check_label = "3. Exactly the 13 expected scheme codes"
    results.append((check_label, ok_codes, detail_codes))

    # 4. Multilingual names present (name_en, name_hi, name_mr, name_ta)
    name_issues: list[str] = []
    for idx, c in enumerate(cards):
        label = c.get("code") or f"index {idx}"
        for field in ("name_en", "name_hi", "name_mr", "name_ta"):
            val = c.get(field)
            if not isinstance(val, str) or not val.strip():
                name_issues.append(f"{label}.{field} missing/empty")
    results.append((
        "4. Multilingual names present (en/hi/mr/ta)",
        len(name_issues) == 0,
        "all 4 name fields non-empty" if not name_issues else "; ".join(name_issues),
    ))

    # 5. Script verification (Devanagari in name_hi/name_mr, Tamil in name_ta)
    script_issues: list[str] = []
    for idx, c in enumerate(cards):
        label = c.get("code") or f"index {idx}"
        for dev_field in ("name_hi", "name_mr"):
            val = c.get(dev_field, "")
            if not isinstance(val, str) or not DEVANAGARI_RE.search(val):
                script_issues.append(f"{label}.{dev_field} lacks Devanagari characters")
        ta_val = c.get("name_ta", "")
        if not isinstance(ta_val, str) or not TAMIL_RE.search(ta_val):
            script_issues.append(f"{label}.name_ta lacks Tamil characters")
    results.append((
        "5. Script check (Devanagari in hi/mr, Tamil in ta)",
        len(script_issues) == 0,
        "Devanagari & Tamil scripts verified" if not script_issues else "; ".join(script_issues),
    ))

    # 6. Documents non-empty
    doc_issues: list[str] = []
    for idx, c in enumerate(cards):
        label = c.get("code") or f"index {idx}"
        docs = c.get("documents")
        if not isinstance(docs, list) or len(docs) == 0:
            doc_issues.append(f"{label}.documents empty or not a list")
        elif any(not isinstance(d, str) or not d.strip() for d in docs):
            doc_issues.append(f"{label}.documents contains blank/non-string item")
    results.append((
        "6. Documents list non-empty",
        len(doc_issues) == 0,
        "every card lists >=1 required document" if not doc_issues else "; ".join(doc_issues),
    ))

    # 7. Helpline present & portal_url starts with https://
    contact_issues: list[str] = []
    for idx, c in enumerate(cards):
        label = c.get("code") or f"index {idx}"
        helpline = c.get("helpline")
        if not isinstance(helpline, str) or not helpline.strip() or not digits_only(helpline):
            contact_issues.append(f"{label}.helpline missing or has no digits")
        portal = c.get("portal_url")
        domain = extract_portal_domain(portal) if isinstance(portal, str) else ""
        if not isinstance(portal, str) or not portal.startswith("https://") or "." not in domain:
            contact_issues.append(f"{label}.portal_url invalid ({portal!r}); must start with https://")
    results.append((
        "7. Helpline present and portal_url starts with https://",
        len(contact_issues) == 0,
        "all helplines and https:// portals valid" if not contact_issues else "; ".join(contact_issues),
    ))

    # 8. sms_summary locales & <=160 Unicode code points
    sms_len_issues: list[str] = []
    for idx, c in enumerate(cards):
        label = c.get("code") or f"index {idx}"
        sms = c.get("sms_summary")
        if not isinstance(sms, dict):
            sms_len_issues.append(f"{label}.sms_summary is not an object")
            continue
        missing_langs = [lg for lg in REQUIRED_SMS_LANGS if lg not in sms]
        extra_langs = sorted(set(sms.keys()) - ALLOWED_SMS_LANGS)
        if missing_langs:
            sms_len_issues.append(f"{label}.sms_summary missing locales {missing_langs}")
        if extra_langs:
            sms_len_issues.append(f"{label}.sms_summary unexpected locales {extra_langs}")
        for lg, txt in sms.items():
            if not isinstance(txt, str) or not txt.strip():
                sms_len_issues.append(f"{label}.sms_summary[{lg}] empty")
                continue
            code_points = len(txt)
            if code_points > 160:
                sms_len_issues.append(f"{label}.sms_summary[{lg}] length {code_points} > 160")
    results.append((
        "8. sms_summary locales (en/hi/mr/ta) and <=160 code points",
        len(sms_len_issues) == 0,
        "all required locales present and <=160 chars" if not sms_len_issues else "; ".join(sms_len_issues),
    ))

    # 9. sms_summary contains helpline digits and portal domain
    sms_content_issues: list[str] = []
    for idx, c in enumerate(cards):
        label = c.get("code") or f"index {idx}"
        sms = c.get("sms_summary")
        if not isinstance(sms, dict):
            continue
        help_digits = digits_only(c.get("helpline", ""))
        domain = extract_portal_domain(c.get("portal_url", ""))
        for lg, txt in sms.items():
            if not isinstance(txt, str):
                continue
            if help_digits and help_digits not in digits_only(txt):
                sms_content_issues.append(
                    f"{label}.sms_summary[{lg}] missing helpline digits {help_digits!r}"
                )
            if domain and domain not in txt.lower():
                sms_content_issues.append(
                    f"{label}.sms_summary[{lg}] missing portal domain {domain!r}"
                )
    results.append((
        "9. sms_summary contains helpline digits and portal domain",
        len(sms_content_issues) == 0,
        "every SMS contains verified portal domain + helpline digits"
        if not sms_content_issues
        else "; ".join(sms_content_issues),
    ))

    # 10. rules allowed keys and sensible ranges
    rule_issues: list[str] = []
    for idx, c in enumerate(cards):
        label = c.get("code") or f"index {idx}"
        rules = c.get("rules")
        if not isinstance(rules, dict):
            rule_issues.append(f"{label}.rules is not an object")
            continue
        missing_rk = sorted(ALLOWED_RULE_KEYS - set(rules.keys()))
        extra_rk = sorted(set(rules.keys()) - ALLOWED_RULE_KEYS)
        if missing_rk:
            rule_issues.append(f"{label}.rules missing keys {missing_rk}")
        if extra_rk:
            rule_issues.append(f"{label}.rules disallowed keys {extra_rk}")

        occ = rules.get("occupations")
        if occ is not None:
            if not isinstance(occ, list) or not occ or any(o not in OCCUPATIONS for o in occ):
                rule_issues.append(f"{label}.rules.occupations invalid: {occ!r}")

        land = rules.get("max_land_hectares")
        if land is not None and (not is_strict_number(land) or land <= 0 or land > 1000):
            rule_issues.append(f"{label}.rules.max_land_hectares out of range (0, 1000]: {land!r}")

        for bfield in ("bpl_only", "pregnant_only"):
            if bfield in rules and not isinstance(rules[bfield], bool):
                rule_issues.append(f"{label}.rules.{bfield} must be boolean, got {rules[bfield]!r}")

        gender = rules.get("gender")
        if gender is not None and gender not in GENDERS:
            rule_issues.append(f"{label}.rules.gender invalid: {gender!r}")
        if rules.get("pregnant_only") is True and gender not in (None, "female"):
            rule_issues.append(f"{label}.rules pregnant_only=true conflicts with gender={gender!r}")

        min_age = rules.get("min_age")
        max_age = rules.get("max_age")
        if min_age is not None and (not is_strict_int(min_age) or not (0 <= min_age <= 120)):
            rule_issues.append(f"{label}.rules.min_age out of range [0, 120]: {min_age!r}")
        if max_age is not None and (not is_strict_int(max_age) or not (0 <= max_age <= 120)):
            rule_issues.append(f"{label}.rules.max_age out of range [0, 120]: {max_age!r}")
        if is_strict_int(min_age) and is_strict_int(max_age) and min_age > max_age:
            rule_issues.append(f"{label}.rules min_age ({min_age}) > max_age ({max_age})")

        income = rules.get("max_annual_income")
        if income is not None and (not is_strict_int(income) or not (0 < income <= 1_000_000_000)):
            rule_issues.append(f"{label}.rules.max_annual_income out of range (0, 1e9]: {income!r}")

        scats = rules.get("social_categories")
        if scats is not None:
            if not isinstance(scats, list) or not scats or any(s not in SOCIAL_CATEGORIES for s in scats):
                rule_issues.append(f"{label}.rules.social_categories invalid: {scats!r}")

    results.append((
        "10. rules allowed keys and sensible value ranges",
        len(rule_issues) == 0,
        "all 9 rule keys and threshold ranges valid" if not rule_issues else "; ".join(rule_issues),
    ))

    return results


def format_seed_report(cards: list[dict[str, Any]]) -> str:
    """Build the DB-03 summary report: counts per category + shortest and longest sms_summary."""
    lines: list[str] = []
    counts = Counter(c.get("category", "unknown") for c in cards if isinstance(c, dict))
    cat_summary = ", ".join(f"{cat}={counts.get(cat, 0)}" for cat in CATEGORIES)
    other_cats = {k: v for k, v in counts.items() if k not in CATEGORIES}
    if other_cats:
        cat_summary += f", other={other_cats}"

    lines.append("--- Seed Summary Report ---")
    lines.append(f"Total cards: {len(cards)} | Counts per category: {cat_summary}")

    sms_entries: list[tuple[int, str, str]] = []
    for c in cards:
        if not isinstance(c, dict):
            continue
        code = str(c.get("code", "?"))
        sms = c.get("sms_summary")
        if isinstance(sms, dict):
            for lg, txt in sms.items():
                if isinstance(txt, str):
                    sms_entries.append((len(txt), code, lg))

    if sms_entries:
        min_len = min(e[0] for e in sms_entries)
        max_len = max(e[0] for e in sms_entries)
        shortest = sorted((code, lg, ln) for ln, code, lg in sms_entries if ln == min_len)
        longest = sorted((code, lg, ln) for ln, code, lg in sms_entries if ln == max_len)
        short_str = ", ".join(f"{code} [{lg}] ({ln}/160 chars)" for code, lg, ln in shortest)
        long_str = ", ".join(f"{code} [{lg}] ({ln}/160 chars)" for code, lg, ln in longest)
        lines.append(f"Shortest sms_summary ({min_len} chars): {short_str}")
        lines.append(f"Longest  sms_summary ({max_len} chars): {long_str}")

    return "\n".join(lines)


def load_json_file(path: Path) -> Any:
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate GramSahayak schemes.json seed corpus (DB-03).")
    parser.add_argument(
        "path",
        nargs="?",
        default=str(DEFAULT_SEED_PATH),
        help="Path to schemes.json (default: data/seed/schemes.json)",
    )
    parser.add_argument(
        "--allow-subset",
        action="store_true",
        help="Allow fewer than 13 cards (for validating db/fixtures/sample_schemes.json).",
    )
    args = parser.parse_args(argv)

    seed_path = Path(args.path)
    if not seed_path.is_absolute() and not seed_path.exists():
        candidate = REPO_ROOT / seed_path
        if candidate.exists():
            seed_path = candidate

    try:
        schema = load_json_file(SCHEMA_PATH)
        cards = load_json_file(seed_path)
    except Exception as exc:
        print(f"[FAIL] Load seed/schema JSON: {exc}")
        return 1

    checks = run_validation(cards, schema, allow_subset=args.allow_subset)
    failed = 0
    for name, ok, detail in checks:
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name} — {detail}")
        if not ok:
            failed += 1

    if isinstance(cards, list) and all(isinstance(c, dict) for c in cards):
        print(format_seed_report(cards))

    if failed:
        print(f"[RESULT] FAILED ({failed}/{len(checks)} checks failed) on {seed_path}")
        return 1

    print(f"[RESULT] PASSED ({len(checks)}/{len(checks)} checks passed) on {seed_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
