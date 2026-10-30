#!/usr/bin/env python3
"""Validate /data/seed/demo_personas.json and reset/verify demo persona sessions & profiles (DB-05).

Usage:
    python3 db/demo_reset.py                 # upsert 5 personas + 2 starter turns, prune old logs
    python3 db/demo_reset.py --check         # compare DB rows against demo_personas.json (0 diffs = exit 0)
    python3 db/demo_reset.py --validate-only # validate demo_personas.json against JSON Schema only
    python3 db/demo_reset.py --driver sqlite|postgres

Safety:
    Destructive reset refuses to run when APP_ENV=production.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = REPO_ROOT / "db" / ".venv" / "bin" / "python"

# Auto-reexec into db/.venv if invoked via system python3 so jsonschema & psycopg2 are available.
if VENV_PYTHON.is_file() and Path(sys.prefix).resolve() != (REPO_ROOT / "db" / ".venv").resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])

if str(REPO_ROOT / "db") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "db"))

from init_sqlite import init_sqlite, resolve_sqlite_path  # noqa: E402
from seed_db import load_env, open_postgres_conn, resolve_driver  # noqa: E402
from validate_seed import load_json_file  # noqa: E402

PERSONAS_PATH = REPO_ROOT / "data" / "seed" / "demo_personas.json"
PERSONAS_SCHEMA_PATH = REPO_ROOT / "db" / "demo_personas.schema.json"

EXPECTED_PERSONA_IDS = (
    "farmer-hi",
    "farmer-mr",
    "asha-ta",
    "student-hi",
    "panchayat-hi",
)

PROFILE_COMPARE_FIELDS = (
    "phone",
    "role",
    "language",
    "occupation",
    "land_hectares",
    "bpl",
    "age",
    "gender",
    "pregnant",
    "annual_income",
    "social_category",
    "state",
    "district",
)

# Deterministic starter Turn timestamps so running demo_reset.py twice changes zero bytes in DB.
STARTER_TS_USER = "2026-10-31T00:00:00.000Z"
STARTER_TS_ASSISTANT = "2026-10-31T00:00:02.000Z"

# Realistic grounded starter conversations per persona (Contract §5 Turn shape, §12 notes, Appendix G1/G2/G5/G7).
PERSONA_STARTER_TURNS: dict[str, list[dict[str, Any]]] = {
    "farmer-hi": [
        {
            "ts": STARTER_TS_USER,
            "channel": "web",
            "speaker": "user",
            "text": "पीएम किसान योजना के लिए कौन पात्र है?",
            "category": "schemes",
            "language": "hi-IN",
        },
        {
            "ts": STARTER_TS_ASSISTANT,
            "channel": "web",
            "speaker": "assistant",
            "text": (
                "सभी भूमिधारक किसान परिवार पीएम-किसान सम्मान निधि के पात्र हैं। इसमें हर वर्ष ₹6,000 "
                "तीन किस्तों (₹2,000 प्रति किस्त) में आधार से जुड़े बैंक खाते में मिलते हैं। "
                "पोर्टल: pmkisan.gov.in, हेल्पलाइन: 155261।"
            ),
            "category": "schemes",
            "language": "hi-IN",
        },
    ],
    "farmer-mr": [
        {
            "ts": STARTER_TS_USER,
            "channel": "web",
            "speaker": "user",
            "text": "कापसावर गुलाबी बोंडअळी आली आहे, काय करावे?",
            "category": "agri",
            "language": "mr-IN",
        },
        {
            "ts": STARTER_TS_ASSISTANT,
            "channel": "web",
            "speaker": "assistant",
            "text": (
                "कापसावरील गुलाबी बोंडअळीसाठी एकात्मिक कीड व्यवस्थापन (IPM) वापरा: फेरोमोन सापळे लावा "
                "आणि प्रादुर्भावग्रस्त फुले व बोंडे गोळा करून नष्ट करा. तज्ज्ञ सल्ल्यासाठी कृषी विज्ञान केंद्र "
                "(KVK) किंवा किसान कॉल सेंटर 1800-180-1551 वर संपर्क साधा."
            ),
            "category": "agri",
            "language": "mr-IN",
        },
    ],
    "asha-ta": [
        {
            "ts": STARTER_TS_USER,
            "channel": "web",
            "speaker": "user",
            "text": "24 வயது கர்ப்பிணிப் பெண்ணுக்கு ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?",
            "category": "health",
            "language": "ta-IN",
        },
        {
            "ts": STARTER_TS_ASSISTANT,
            "channel": "web",
            "speaker": "assistant",
            "text": (
                "ஜனனி சுரக்ஷா யோஜனா (JSY) திட்டத்தில் அரசு மருத்துவமனை பிரசவத்துக்கு கிராமப்புற தாய்க்கு "
                "₹700 (HPS மாநிலம்) அல்லது ₹1,400 (LPS மாநிலம்) வங்கி கணக்கில் வழங்கப்படும். "
                "MCP அட்டை மற்றும் ஆதார் தேவை; nhm.gov.in அல்லது உதவி எண் 104."
            ),
            "category": "health",
            "language": "ta-IN",
        },
    ],
    "student-hi": [
        {
            "ts": STARTER_TS_USER,
            "channel": "web",
            "speaker": "user",
            "text": "नेशनल स्कॉलरशिप पोर्टल पर आवेदन कैसे करें?",
            "category": "education",
            "language": "hi-IN",
        },
        {
            "ts": STARTER_TS_ASSISTANT,
            "channel": "web",
            "speaker": "assistant",
            "text": (
                "scholarships.gov.in या NSP OTR ऐप पर आधार और मोबाइल OTP से One Time Registration (OTR) "
                "करें, फिर लॉगिन करके छात्रवृत्ति आवेदन भरें। आवश्यक दस्तावेज़: आधार, आय व जाति प्रमाणपत्र, "
                "पिछली मार्कशीट और बैंक खाता। हेल्पलाइन: 0120-6619540।"
            ),
            "category": "education",
            "language": "hi-IN",
        },
    ],
    "panchayat-hi": [
        {
            "ts": STARTER_TS_USER,
            "channel": "web",
            "speaker": "user",
            "text": "ग्राम पंचायत में मनरेगा जॉब कार्ड और 100 दिन के काम के लिए कैसे आवेदन करें?",
            "category": "schemes",
            "language": "hi-IN",
        },
        {
            "ts": STARTER_TS_ASSISTANT,
            "channel": "web",
            "speaker": "assistant",
            "text": (
                "ग्रामीण परिवार के 18 वर्ष या अधिक आयु के सदस्य ग्राम पंचायत में आधार, बैंक खाता और फोटो देकर "
                "निःशुल्क मनरेगा जॉब कार्ड बनवा सकते हैं। काम मांगने के 15 दिन में साल में 100 दिन तक रोजगार "
                "मिलता है। पोर्टल: nrega.nic.in, हेल्पलाइन: 1800-111-555।"
            ),
            "category": "schemes",
            "language": "hi-IN",
        },
    ],
}


def validate_personas(personas: Any, schema: dict[str, Any]) -> list[str]:
    """Validate /data/seed/demo_personas.json against db/demo_personas.schema.json + uniqueness."""
    errors: list[str] = []
    try:
        from jsonschema import Draft202012Validator

        validator = Draft202012Validator(schema)
        for err in sorted(validator.iter_errors(personas), key=lambda e: list(e.absolute_path)):
            loc = ".".join(str(p) for p in err.absolute_path) or "<root>"
            errors.append(f"{loc}: {err.message}")
    except ImportError:
        if not isinstance(personas, list) or len(personas) != 5:
            return ["demo_personas.json must be an array of 5 persona objects"]

    if not isinstance(personas, list) or not all(isinstance(p, dict) for p in personas):
        errors.append("Root value must be a JSON array of persona objects")
        return errors

    ids = [p.get("id") for p in personas]
    phones = [p.get("phone") for p in personas]
    if len(set(ids)) != len(ids):
        errors.append(f"Duplicate persona ids found: {ids}")
    if len(set(phones)) != len(phones):
        errors.append(f"Duplicate persona phones found: {phones}")
    if set(ids) != set(EXPECTED_PERSONA_IDS):
        missing = sorted(set(EXPECTED_PERSONA_IDS) - set(ids))
        extra = sorted(set(ids) - set(EXPECTED_PERSONA_IDS))
        errors.append(f"Persona IDs mismatch: missing={missing}, unexpected={extra}")

    for p in personas:
        pid = p.get("id", "?")
        turns = PERSONA_STARTER_TURNS.get(pid)
        if not turns or len(turns) != 2:
            errors.append(f"Missing 2 starter Turn objects in demo_reset.py for {pid!r}")
        else:
            for t in turns:
                if t.get("language") != p.get("language"):
                    errors.append(
                        f"Starter turn language {t.get('language')!r} != persona {pid} language {p.get('language')!r}"
                    )

    return errors


def expected_profile_dict(persona: dict[str, Any]) -> dict[str, Any]:
    return {
        "session_key": persona["phone"],
        "phone": persona["phone"],
        "role": persona["role"],
        "language": persona["language"],
        "occupation": persona["occupation"],
        "land_hectares": float(persona["land_hectares"]),
        "bpl": bool(persona["bpl"]),
        "age": int(persona["age"]),
        "gender": persona["gender"],
        "pregnant": bool(persona["pregnant"]),
        "annual_income": int(persona["annual_income"]),
        "social_category": persona["social_category"],
        "state": None,
        "district": None,
    }


def normalize_db_profile(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    if out.get("land_hectares") is not None:
        out["land_hectares"] = float(out["land_hectares"])
    for bfield in ("bpl", "pregnant"):
        if out.get(bfield) is not None:
            out[bfield] = bool(out[bfield])
    for ifield in ("age", "annual_income"):
        if out.get(ifield) is not None:
            out[ifield] = int(out[ifield])
    return out


def parse_history(raw: Any) -> Any:
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    return raw


def profiles_equal(expected: dict[str, Any], actual: dict[str, Any]) -> list[str]:
    diffs: list[str] = []
    norm_actual = normalize_db_profile(actual)
    for field in PROFILE_COMPARE_FIELDS:
        exp_val = expected[field]
        act_val = norm_actual.get(field)
        if field == "land_hectares" and exp_val is not None and act_val is not None:
            if not math.isclose(float(exp_val), float(act_val), rel_tol=0.0, abs_tol=1e-6):
                diffs.append(f"{field}: expected {exp_val!r}, got {act_val!r}")
        elif exp_val != act_val:
            diffs.append(f"{field}: expected {exp_val!r}, got {act_val!r}")
    return diffs


def check_personas_in_db(
    personas: list[dict[str, Any]],
    sessions_by_key: dict[str, dict[str, Any]],
    profiles_by_key: dict[str, dict[str, Any]],
) -> list[str]:
    """Compare DB sessions & user_profiles rows against demo_personas.json + starter turns."""
    diffs: list[str] = []
    for p in personas:
        pid = p["id"]
        key = p["phone"]
        expected_turns = PERSONA_STARTER_TURNS[pid]

        sess = sessions_by_key.get(key)
        if not sess:
            diffs.append(f"[{pid}] MISSING session row for session_key={key!r}")
        else:
            if sess.get("phone") != key:
                diffs.append(f"[{pid}] sessions.phone: expected {key!r}, got {sess.get('phone')!r}")
            if sess.get("last_channel") != "web":
                diffs.append(
                    f"[{pid}] sessions.last_channel: expected 'web', got {sess.get('last_channel')!r}"
                )
            hist = parse_history(sess.get("history"))
            if not isinstance(hist, list):
                diffs.append(f"[{pid}] sessions.history is not a valid JSON array")
            elif hist != expected_turns:
                diffs.append(
                    f"[{pid}] sessions.history differs (expected 2 starter web turns in {p['language']}, "
                    f"got {len(hist)} turn(s))"
                )

        prof = profiles_by_key.get(key)
        if not prof:
            diffs.append(f"[{pid}] MISSING user_profiles row for session_key={key!r}")
        else:
            exp_prof = expected_profile_dict(p)
            for field_diff in profiles_equal(exp_prof, prof):
                diffs.append(f"[{pid}] user_profiles.{field_diff}")

    return diffs


# ---------------------------------------------------------------------------
# SQLite driver implementation
# ---------------------------------------------------------------------------


def fetch_sqlite_persona_state(
    db_path: Path,
    keys: list[str],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    if not db_path.is_file():
        return {}, {}
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        placeholders = ", ".join("?" for _ in keys)
        has_sessions = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions';"
        ).fetchone()
        has_profiles = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_profiles';"
        ).fetchone()
        sessions = (
            {
                r["session_key"]: dict(r)
                for r in conn.execute(
                    f"SELECT * FROM sessions WHERE session_key IN ({placeholders});", keys
                ).fetchall()
            }
            if has_sessions
            else {}
        )
        profiles = (
            {
                r["session_key"]: dict(r)
                for r in conn.execute(
                    f"SELECT * FROM user_profiles WHERE session_key IN ({placeholders});", keys
                ).fetchall()
            }
            if has_profiles
            else {}
        )
        return sessions, profiles
    finally:
        conn.close()


def reset_sqlite_personas(
    db_path: Path,
    personas: list[dict[str, Any]],
) -> tuple[int, int, int]:
    """Idempotently reset 5 demo personas in SQLite. Returns (sessions_changed, profiles_changed, logs_deleted)."""
    init_sqlite(db_path, reset=False)
    keys = [p["phone"] for p in personas]
    existing_sessions, existing_profiles = fetch_sqlite_persona_state(db_path, keys)
    reset_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    sessions_changed = 0
    profiles_changed = 0

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        with conn:
            for p in personas:
                pid = p["id"]
                key = p["phone"]
                turns = PERSONA_STARTER_TURNS[pid]
                turns_json = json.dumps(turns, ensure_ascii=False)

                cur_sess = existing_sessions.get(key)
                sess_matches = (
                    cur_sess is not None
                    and cur_sess.get("phone") == key
                    and cur_sess.get("last_channel") == "web"
                    and parse_history(cur_sess.get("history")) == turns
                )
                if not sess_matches:
                    conn.execute(
                        """
                        INSERT INTO sessions (session_key, phone, history, last_channel, created_at, updated_at)
                        VALUES (?, ?, ?, 'web', ?, ?)
                        ON CONFLICT(session_key) DO UPDATE SET
                            phone        = excluded.phone,
                            history      = excluded.history,
                            last_channel = excluded.last_channel,
                            updated_at   = excluded.updated_at;
                        """,
                        (key, key, turns_json, reset_ts, reset_ts),
                    )
                    sessions_changed += 1

                exp_prof = expected_profile_dict(p)
                cur_prof = existing_profiles.get(key)
                prof_matches = cur_prof is not None and len(profiles_equal(exp_prof, cur_prof)) == 0
                if not prof_matches:
                    conn.execute(
                        """
                        INSERT INTO user_profiles (
                            session_key, phone, role, language, occupation,
                            land_hectares, bpl, age, gender, pregnant,
                            annual_income, social_category, state, district, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
                        ON CONFLICT(session_key) DO UPDATE SET
                            phone           = excluded.phone,
                            role            = excluded.role,
                            language        = excluded.language,
                            occupation      = excluded.occupation,
                            land_hectares   = excluded.land_hectares,
                            bpl             = excluded.bpl,
                            age             = excluded.age,
                            gender          = excluded.gender,
                            pregnant        = excluded.pregnant,
                            annual_income   = excluded.annual_income,
                            social_category = excluded.social_category,
                            state           = NULL,
                            district        = NULL,
                            updated_at      = excluded.updated_at;
                        """,
                        (
                            key,
                            key,
                            exp_prof["role"],
                            exp_prof["language"],
                            exp_prof["occupation"],
                            exp_prof["land_hectares"],
                            1 if exp_prof["bpl"] else 0,
                            exp_prof["age"],
                            exp_prof["gender"],
                            1 if exp_prof["pregnant"] else 0,
                            exp_prof["annual_income"],
                            exp_prof["social_category"],
                            reset_ts,
                        ),
                    )
                    profiles_changed += 1

            # Delete interaction_logs older than (or up to) this reset timestamp.
            cur = conn.execute("DELETE FROM interaction_logs WHERE ts <= ?;", (reset_ts,))
            logs_deleted = cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0

        return sessions_changed, profiles_changed, logs_deleted
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# PostgreSQL / Supabase driver implementation
# ---------------------------------------------------------------------------


def fetch_postgres_persona_state(
    database_url: str,
    keys: list[str],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    import psycopg2.extras

    conn = open_postgres_conn(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM sessions WHERE session_key = ANY(%s);", (keys,))
            sessions = {r["session_key"]: dict(r) for r in cur.fetchall()}
            cur.execute("SELECT * FROM user_profiles WHERE session_key = ANY(%s);", (keys,))
            profiles = {r["session_key"]: dict(r) for r in cur.fetchall()}
            return sessions, profiles
    finally:
        conn.close()


def reset_postgres_personas(
    database_url: str,
    personas: list[dict[str, Any]],
) -> tuple[int, int, int]:
    """Idempotently reset 5 demo personas in Postgres. Returns (sessions_changed, profiles_changed, logs_deleted)."""
    import psycopg2.extras

    keys = [p["phone"] for p in personas]
    existing_sessions, existing_profiles = fetch_postgres_persona_state(database_url, keys)
    reset_ts = datetime.now(timezone.utc)

    sessions_changed = 0
    profiles_changed = 0

    conn = open_postgres_conn(database_url)
    try:
        with conn:
            with conn.cursor() as cur:
                for p in personas:
                    pid = p["id"]
                    key = p["phone"]
                    turns = PERSONA_STARTER_TURNS[pid]

                    cur_sess = existing_sessions.get(key)
                    sess_matches = (
                        cur_sess is not None
                        and cur_sess.get("phone") == key
                        and cur_sess.get("last_channel") == "web"
                        and parse_history(cur_sess.get("history")) == turns
                    )
                    if not sess_matches:
                        cur.execute(
                            """
                            INSERT INTO sessions (session_key, phone, history, last_channel, created_at, updated_at)
                            VALUES (%s, %s, %s, 'web', %s, %s)
                            ON CONFLICT (session_key) DO UPDATE SET
                                phone        = EXCLUDED.phone,
                                history      = EXCLUDED.history,
                                last_channel = EXCLUDED.last_channel,
                                updated_at   = EXCLUDED.updated_at;
                            """,
                            (key, key, psycopg2.extras.Json(turns), reset_ts, reset_ts),
                        )
                        sessions_changed += 1

                    exp_prof = expected_profile_dict(p)
                    cur_prof = existing_profiles.get(key)
                    prof_matches = cur_prof is not None and len(profiles_equal(exp_prof, cur_prof)) == 0
                    if not prof_matches:
                        cur.execute(
                            """
                            INSERT INTO user_profiles (
                                session_key, phone, role, language, occupation,
                                land_hectares, bpl, age, gender, pregnant,
                                annual_income, social_category, state, district, updated_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, NULL, %s)
                            ON CONFLICT (session_key) DO UPDATE SET
                                phone           = EXCLUDED.phone,
                                role            = EXCLUDED.role,
                                language        = EXCLUDED.language,
                                occupation      = EXCLUDED.occupation,
                                land_hectares   = EXCLUDED.land_hectares,
                                bpl             = EXCLUDED.bpl,
                                age             = EXCLUDED.age,
                                gender          = EXCLUDED.gender,
                                pregnant        = EXCLUDED.pregnant,
                                annual_income   = EXCLUDED.annual_income,
                                social_category = EXCLUDED.social_category,
                                state           = NULL,
                                district        = NULL,
                                updated_at      = EXCLUDED.updated_at;
                            """,
                            (
                                key,
                                key,
                                exp_prof["role"],
                                exp_prof["language"],
                                exp_prof["occupation"],
                                exp_prof["land_hectares"],
                                exp_prof["bpl"],
                                exp_prof["age"],
                                exp_prof["gender"],
                                exp_prof["pregnant"],
                                exp_prof["annual_income"],
                                exp_prof["social_category"],
                                reset_ts,
                            ),
                        )
                        profiles_changed += 1

                cur.execute("DELETE FROM interaction_logs WHERE ts <= %s;", (reset_ts,))
                logs_deleted = cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0

        return sessions_changed, profiles_changed, logs_deleted
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate /data/seed/demo_personas.json and reset/check demo personas in DB (DB-05)."
    )
    parser.add_argument(
        "--personas",
        default=str(PERSONAS_PATH),
        help="Path to demo_personas.json (default: data/seed/demo_personas.json).",
    )
    parser.add_argument(
        "--driver",
        choices=("postgres", "sqlite"),
        default=None,
        help="Override DB_DRIVER (postgres or sqlite).",
    )
    parser.add_argument(
        "--sqlite-path",
        default=None,
        help="Override SQLITE_PATH when driver is sqlite.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Compare DB sessions & user_profiles rows against demo_personas.json and print differences.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate demo_personas.json against db/demo_personas.schema.json without touching DB.",
    )
    args = parser.parse_args(argv)

    load_env()
    app_env = os.environ.get("APP_ENV", "development").strip().lower()
    if not args.check and not args.validate_only and app_env == "production":
        print("[FAIL] Refusing to run demo_reset.py when APP_ENV=production.", file=sys.stderr)
        return 1

    personas_path = Path(args.personas)
    if not personas_path.is_absolute() and not personas_path.exists():
        candidate = REPO_ROOT / personas_path
        if candidate.exists():
            personas_path = candidate

    try:
        schema = load_json_file(PERSONAS_SCHEMA_PATH)
        personas = load_json_file(personas_path)
    except Exception as exc:
        print(f"[FAIL] Could not load personas/schema JSON: {exc}", file=sys.stderr)
        return 1

    val_errors = validate_personas(personas, schema)
    if val_errors:
        print(f"[FAIL] demo_personas.json validation failed ({len(val_errors)} issue(s)):", file=sys.stderr)
        for err in val_errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print(
        f"[PASS] Validated {len(personas)} demo personas in {personas_path.name}: "
        + ", ".join(f"{p['id']} ({p['phone']})" for p in personas)
    )
    if args.validate_only:
        return 0

    try:
        driver = resolve_driver(args.driver)
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    sqlite_path = resolve_sqlite_path(args.sqlite_path)
    database_url = os.environ.get("DATABASE_URL", "").strip()
    target_desc = (
        f"sqlite ({sqlite_path.relative_to(REPO_ROOT) if sqlite_path.is_relative_to(REPO_ROOT) else sqlite_path})"
        if driver == "sqlite"
        else "postgres (DATABASE_URL)"
    )

    keys = [p["phone"] for p in personas]

    if args.check:
        try:
            sessions_map, profiles_map = (
                fetch_sqlite_persona_state(sqlite_path, keys)
                if driver == "sqlite"
                else fetch_postgres_persona_state(database_url, keys)
            )
        except Exception as exc:
            print(f"[FAIL] Could not query {target_desc}: {exc}", file=sys.stderr)
            return 1

        diffs = check_personas_in_db(personas, sessions_map, profiles_map)
        if diffs:
            print(f"[FAIL] --check found {len(diffs)} difference(s) on {target_desc}:")
            for d in diffs:
                print(f"  * {d}")
            return 1

        print(
            f"[OK] --check passed on {target_desc}: 0 differences "
            f"({len(personas)}/5 personas, profiles, and 2-turn web histories match)."
        )
        return 0

    try:
        sess_changed, prof_changed, logs_deleted = (
            reset_sqlite_personas(sqlite_path, personas)
            if driver == "sqlite"
            else reset_postgres_personas(database_url, personas)
        )
    except Exception as exc:
        print(f"[FAIL] Demo reset failed on {target_desc}: {exc}", file=sys.stderr)
        return 1

    print(
        f"[OK] Demo reset complete on {target_desc}: "
        f"sessions_updated={sess_changed}, profiles_updated={prof_changed}, old_logs_deleted={logs_deleted}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
