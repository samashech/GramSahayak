#!/usr/bin/env python3
"""Idempotently load and verify /data/seed/schemes.json in Postgres or SQLite (DB-03).

Usage:
    python3 db/seed_db.py                # validate and upsert 13 cards into active DB driver
    python3 db/seed_db.py --reset        # delete all rows in schemes and reload (refused in production)
    python3 db/seed_db.py --dry-run      # validate seed and preview upsert without writing
    python3 db/seed_db.py --check        # compare DB rows against schemes.json and report differences
"""

from __future__ import annotations

import argparse
import json
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

# Ensure sibling imports from /db work regardless of current working directory.
if str(REPO_ROOT / "db") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "db"))

from init_sqlite import init_sqlite, load_root_env, resolve_sqlite_path  # noqa: E402
from validate_seed import (  # noqa: E402
    DEFAULT_SEED_PATH,
    SCHEMA_PATH,
    format_seed_report,
    load_json_file,
    run_validation,
)

SCHEME_COMPARE_FIELDS = (
    "code",
    "id",
    "name_en",
    "name_hi",
    "name_mr",
    "name_ta",
    "category",
    "target_role",
    "benefits",
    "eligibility",
    "exclusions",
    "documents",
    "how_to_apply",
    "helpline",
    "portal_url",
    "sms_summary",
    "rules",
)
JSON_FIELDS = {"documents", "sms_summary", "rules"}


def load_env() -> None:
    env_file = REPO_ROOT / ".env"
    try:
        from dotenv import load_dotenv

        if env_file.is_file():
            load_dotenv(env_file, override=False)
    except ImportError:
        load_root_env(env_file)


def resolve_driver(cli_driver: str | None) -> str:
    raw = (cli_driver or os.environ.get("DB_DRIVER", "sqlite")).strip().lower()
    if raw == "memory":
        # Memory driver lives only inside the Node process; CLI DB scripts operate on SQLite by default.
        print(
            "[INFO] DB_DRIVER=memory has no external database process; targeting local SQLite (SQLITE_PATH)."
        )
        return "sqlite"
    if raw not in ("postgres", "sqlite"):
        raise ValueError(f"Unsupported DB_DRIVER={raw!r}. Expected 'postgres' or 'sqlite'.")
    return raw


def normalize_card_for_compare(row_or_card: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for field in SCHEME_COMPARE_FIELDS:
        val = row_or_card.get(field)
        if field in JSON_FIELDS and isinstance(val, str):
            try:
                val = json.loads(val)
            except json.JSONDecodeError:
                pass
        out[field] = val
    return out


def diff_cards_against_db(
    seed_cards: list[dict[str, Any]],
    db_rows: list[dict[str, Any]],
) -> list[str]:
    diffs: list[str] = []
    seed_by_code = {c["code"]: normalize_card_for_compare(c) for c in seed_cards}
    db_by_code = {r["code"]: normalize_card_for_compare(r) for r in db_rows}

    for code in seed_by_code:
        if code not in db_by_code:
            diffs.append(f"MISSING in DB: scheme {code!r}")

    for code in sorted(set(db_by_code) - set(seed_by_code)):
        diffs.append(f"EXTRA in DB (not in seed JSON): scheme {code!r}")

    for code, expected in seed_by_code.items():
        if code not in db_by_code:
            continue
        actual = db_by_code[code]
        for field in SCHEME_COMPARE_FIELDS:
            if expected[field] != actual[field]:
                diffs.append(
                    f"DIFF {code}.{field}:\n"
                    f"  seed: {json.dumps(expected[field], ensure_ascii=False, sort_keys=True)}\n"
                    f"  db  : {json.dumps(actual[field], ensure_ascii=False, sort_keys=True)}"
                )
    return diffs


# ---------------------------------------------------------------------------
# SQLite operations
# ---------------------------------------------------------------------------


def fetch_sqlite_schemes(db_path: Path) -> list[dict[str, Any]]:
    if not db_path.is_file():
        return []
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        table_exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='schemes';"
        ).fetchone()
        if not table_exists:
            return []
        rows = conn.execute("SELECT * FROM schemes ORDER BY code;").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def upsert_sqlite_schemes(
    db_path: Path,
    cards: list[dict[str, Any]],
    reset: bool = False,
) -> int:
    init_sqlite(db_path, reset=False)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        with conn:
            if reset:
                conn.execute("DELETE FROM schemes;")
            for c in cards:
                conn.execute(
                    """
                    INSERT INTO schemes (
                        code, id, name_en, name_hi, name_mr, name_ta,
                        category, target_role, benefits, eligibility, exclusions,
                        documents, how_to_apply, helpline, portal_url,
                        sms_summary, rules, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?
                    )
                    ON CONFLICT(code) DO UPDATE SET
                        id          = excluded.id,
                        name_en     = excluded.name_en,
                        name_hi     = excluded.name_hi,
                        name_mr     = excluded.name_mr,
                        name_ta     = excluded.name_ta,
                        category    = excluded.category,
                        target_role = excluded.target_role,
                        benefits    = excluded.benefits,
                        eligibility = excluded.eligibility,
                        exclusions  = excluded.exclusions,
                        documents   = excluded.documents,
                        how_to_apply = excluded.how_to_apply,
                        helpline    = excluded.helpline,
                        portal_url  = excluded.portal_url,
                        sms_summary = excluded.sms_summary,
                        rules       = excluded.rules,
                        updated_at  = excluded.updated_at;
                    """,
                    (
                        c["code"],
                        c["id"],
                        c["name_en"],
                        c["name_hi"],
                        c["name_mr"],
                        c["name_ta"],
                        c["category"],
                        c["target_role"],
                        c["benefits"],
                        c["eligibility"],
                        c["exclusions"],
                        json.dumps(c["documents"], ensure_ascii=False),
                        c["how_to_apply"],
                        c["helpline"],
                        c["portal_url"],
                        json.dumps(c["sms_summary"], ensure_ascii=False),
                        json.dumps(c["rules"], ensure_ascii=False),
                        now_iso,
                    ),
                )
            total = conn.execute("SELECT COUNT(*) FROM schemes;").fetchone()[0]
        return int(total)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# PostgreSQL / Supabase operations
# ---------------------------------------------------------------------------


def open_postgres_conn(database_url: str):
    if not database_url:
        raise RuntimeError("DB_DRIVER=postgres requires DATABASE_URL to be set in .env or environment.")
    import psycopg2

    # Ensure SSL on non-local hosts (e.g. Supabase Transaction Pooler :6543) if sslmode not specified.
    is_local = "@localhost" in database_url or "@127.0.0.1" in database_url
    kwargs: dict[str, Any] = {"connect_timeout": 5}
    if not is_local and "sslmode=" not in database_url:
        kwargs["sslmode"] = "require"
    return psycopg2.connect(database_url, **kwargs)


def fetch_postgres_schemes(database_url: str) -> list[dict[str, Any]]:
    import psycopg2.extras

    conn = open_postgres_conn(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM schemes ORDER BY code;")
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def upsert_postgres_schemes(
    database_url: str,
    cards: list[dict[str, Any]],
    reset: bool = False,
) -> int:
    import psycopg2.extras

    conn = open_postgres_conn(database_url)
    try:
        with conn:
            with conn.cursor() as cur:
                if reset:
                    cur.execute("DELETE FROM schemes;")
                for c in cards:
                    cur.execute(
                        """
                        INSERT INTO schemes (
                            code, id, name_en, name_hi, name_mr, name_ta,
                            category, target_role, benefits, eligibility, exclusions,
                            documents, how_to_apply, helpline, portal_url,
                            sms_summary, rules, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, NOW()
                        )
                        ON CONFLICT (code) DO UPDATE SET
                            id           = EXCLUDED.id,
                            name_en      = EXCLUDED.name_en,
                            name_hi      = EXCLUDED.name_hi,
                            name_mr      = EXCLUDED.name_mr,
                            name_ta      = EXCLUDED.name_ta,
                            category     = EXCLUDED.category,
                            target_role  = EXCLUDED.target_role,
                            benefits     = EXCLUDED.benefits,
                            eligibility  = EXCLUDED.eligibility,
                            exclusions   = EXCLUDED.exclusions,
                            documents    = EXCLUDED.documents,
                            how_to_apply = EXCLUDED.how_to_apply,
                            helpline     = EXCLUDED.helpline,
                            portal_url   = EXCLUDED.portal_url,
                            sms_summary  = EXCLUDED.sms_summary,
                            rules        = EXCLUDED.rules,
                            updated_at   = NOW();
                        """,
                        (
                            c["code"],
                            c["id"],
                            c["name_en"],
                            c["name_hi"],
                            c["name_mr"],
                            c["name_ta"],
                            c["category"],
                            c["target_role"],
                            c["benefits"],
                            c["eligibility"],
                            c["exclusions"],
                            psycopg2.extras.Json(c["documents"]),
                            c["how_to_apply"],
                            c["helpline"],
                            c["portal_url"],
                            psycopg2.extras.Json(c["sms_summary"]),
                            psycopg2.extras.Json(c["rules"]),
                        ),
                    )
                cur.execute("SELECT COUNT(*) FROM schemes;")
                row = cur.fetchone()
                return int(row[0]) if row else 0
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate and idempotently load /data/seed/schemes.json into Postgres or SQLite (DB-03)."
    )
    parser.add_argument(
        "--seed",
        default=str(DEFAULT_SEED_PATH),
        help="Path to schemes.json (default: data/seed/schemes.json).",
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
        "--reset",
        action="store_true",
        help="Delete existing rows in schemes and reload cleanly (refused when APP_ENV=production).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate seed JSON and preview target driver operation without writing to DB.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Compare DB schemes rows to the seed JSON and print differences (exits non-zero on mismatch).",
    )
    parser.add_argument(
        "--allow-subset",
        action="store_true",
        help="Allow fewer than 13 cards (for testing db/fixtures/sample_schemes.json).",
    )
    args = parser.parse_args(argv)

    load_env()
    app_env = os.environ.get("APP_ENV", "development").strip().lower()
    if args.reset and app_env == "production":
        print("[FAIL] Refusing to run --reset when APP_ENV=production.", file=sys.stderr)
        return 1

    seed_path = Path(args.seed)
    if not seed_path.is_absolute() and not seed_path.exists():
        candidate = REPO_ROOT / seed_path
        if candidate.exists():
            seed_path = candidate

    try:
        schema = load_json_file(SCHEMA_PATH)
        cards = load_json_file(seed_path)
    except Exception as exc:
        print(f"[FAIL] Could not load seed/schema: {exc}", file=sys.stderr)
        return 1

    checks = run_validation(cards, schema, allow_subset=args.allow_subset)
    failed_checks = [(name, detail) for name, ok, detail in checks if not ok]
    if failed_checks:
        print(f"[FAIL] Seed validation failed before DB operation on {seed_path}:", file=sys.stderr)
        for name, detail in failed_checks:
            print(f"  - {name}: {detail}", file=sys.stderr)
        return 1

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

    if args.dry_run:
        action = "DELETE + UPSERT" if args.reset else "UPSERT"
        print(f"[DRY-RUN] Validated {len(cards)} scheme cards from {seed_path.name}.")
        print(f"[DRY-RUN] Target driver: {target_desc} | Planned action: {action} {len(cards)} cards (0 rows written).")
        print(format_seed_report(cards))
        return 0

    if args.check:
        try:
            db_rows = (
                fetch_sqlite_schemes(sqlite_path)
                if driver == "sqlite"
                else fetch_postgres_schemes(database_url)
            )
        except Exception as exc:
            print(f"[FAIL] Could not read schemes from {target_desc}: {exc}", file=sys.stderr)
            return 1

        diffs = diff_cards_against_db(cards, db_rows)
        if diffs:
            print(f"[FAIL] --check found {len(diffs)} difference(s) on {target_desc}:")
            for d in diffs:
                print(f"  * {d}")
            print(format_seed_report(cards))
            return 1

        print(f"[OK] --check passed on {target_desc}: 0 differences ({len(db_rows)}/{len(cards)} rows match).")
        print(format_seed_report(cards))
        return 0

    # Normal upsert (or --reset + upsert)
    try:
        total_rows = (
            upsert_sqlite_schemes(sqlite_path, cards, reset=args.reset)
            if driver == "sqlite"
            else upsert_postgres_schemes(database_url, cards, reset=args.reset)
        )
    except Exception as exc:
        print(f"[FAIL] Seeding {target_desc} failed: {exc}", file=sys.stderr)
        return 1

    mode_str = "reset + upserted" if args.reset else "upserted"
    print(f"[OK] Successfully {mode_str} {len(cards)} cards into {target_desc} (table rows now: {total_rows}).")
    print(format_seed_report(cards))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
