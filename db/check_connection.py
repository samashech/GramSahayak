#!/usr/bin/env python3
"""Verify Postgres (Supabase Transaction Pooler :6543) and SQLite connectivity, latency, and row counts (DB-04).

Usage:
    python3 db/check_connection.py                      # check Postgres (if DATABASE_URL set) + SQLite
    python3 db/check_connection.py --require-postgres   # fail if DATABASE_URL is unset or unreachable
    python3 db/check_connection.py --bootstrap-postgres # apply schema.postgres.sql + seed_db + demo_reset on Postgres, then check
    python3 db/check_connection.py --ensure-sqlite      # ensure SQLite is initialized, seeded (13 schemes), and reset (5 personas)
"""

from __future__ import annotations

import argparse
import os
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

REPO_ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = REPO_ROOT / "db" / ".venv" / "bin" / "python"

# Auto-reexec into db/.venv if invoked as a script via system python3 so psycopg2 & dotenv are available.
if (
    __name__ == "__main__"
    and VENV_PYTHON.is_file()
    and Path(sys.prefix).resolve() != (REPO_ROOT / "db" / ".venv").resolve()
):
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])

if str(REPO_ROOT / "db") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "db"))

from demo_reset import PERSONAS_PATH, PERSONAS_SCHEMA_PATH, reset_postgres_personas, reset_sqlite_personas, validate_personas  # noqa: E402
from init_sqlite import init_sqlite, resolve_sqlite_path  # noqa: E402
from seed_db import DEFAULT_SEED_PATH, SCHEMA_PATH, load_env, open_postgres_conn, upsert_postgres_schemes, upsert_sqlite_schemes  # noqa: E402
from validate_seed import load_json_file, run_validation  # noqa: E402

TABLES = ("sessions", "user_profiles", "interaction_logs", "schemes")
POSTGRES_SCHEMA_PATH = REPO_ROOT / "db" / "schema.postgres.sql"


def mask_database_url(url: str) -> str:
    """Mask password in DATABASE_URL so secrets never appear in terminal output or logs."""
    if not url:
        return "<unset>"
    return re.sub(r"://([^:/?#]+):([^@]+)@", r"://\1:***@", url)


def inspect_pooler_port(url: str) -> str | None:
    """Return a warning if DATABASE_URL uses direct port 5432 instead of Transaction Pooler 6543."""
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").lower()
        port = parsed.port
        if host not in ("localhost", "127.0.0.1") and port == 5432:
            return (
                "DATABASE_URL uses direct port 5432 (often blocked on venue Wi-Fi). "
                "Switch to the Supabase Transaction Pooler host on port 6543."
            )
    except Exception:
        pass
    return None


def bootstrap_postgres(database_url: str) -> None:
    """Apply db/schema.postgres.sql, seed 13 schemes, and seed 5 demo personas on Postgres."""
    if not POSTGRES_SCHEMA_PATH.is_file():
        raise FileNotFoundError(f"Missing Postgres schema file: {POSTGRES_SCHEMA_PATH}")

    schema_sql = POSTGRES_SCHEMA_PATH.read_text(encoding="utf-8")
    t0 = time.perf_counter()
    conn = open_postgres_conn(database_url)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(schema_sql)
    finally:
        conn.close()
    schema_ms = (time.perf_counter() - t0) * 1000.0
    print(f"[BOOTSTRAP] Applied db/schema.postgres.sql on Postgres ({schema_ms:.1f} ms)")

    cards = load_json_file(DEFAULT_SEED_PATH)
    seed_schema = load_json_file(SCHEMA_PATH)
    checks = run_validation(cards, seed_schema, allow_subset=False)
    failed = [c for c in checks if not c[1]]
    if failed:
        raise RuntimeError(f"schemes.json validation failed ({len(failed)} check(s))")
    total = upsert_postgres_schemes(database_url, cards, reset=False)
    print(f"[BOOTSTRAP] Seeded Postgres schemes: upserted={len(cards)}, total={total}")

    personas = load_json_file(PERSONAS_PATH)
    p_schema = load_json_file(PERSONAS_SCHEMA_PATH)
    p_errs = validate_personas(personas, p_schema)
    if p_errs:
        raise RuntimeError(f"demo_personas.json validation failed: {p_errs}")
    s_chg, p_chg, l_del = reset_postgres_personas(database_url, personas)
    print(
        f"[BOOTSTRAP] Seeded Postgres demo personas: sessions_updated={s_chg}, "
        f"profiles_updated={p_chg}, old_logs_deleted={l_del}"
    )


def ensure_sqlite_ready(sqlite_path: Path) -> None:
    """Ensure local SQLite file has schema + 13 schemes + 5 demo personas."""
    init_sqlite(sqlite_path, reset=False)
    cards = load_json_file(DEFAULT_SEED_PATH)
    upsert_sqlite_schemes(sqlite_path, cards, reset=False)
    personas = load_json_file(PERSONAS_PATH)
    reset_sqlite_personas(sqlite_path, personas)


def check_postgres(database_url: str) -> dict[str, Any]:
    """Connect with DATABASE_URL, run SELECT 1, count rows in the 4 tables, and measure latency."""
    masked = mask_database_url(database_url)
    port_warning = inspect_pooler_port(database_url)

    t0 = time.perf_counter()
    conn = open_postgres_conn(database_url)
    connect_ms = (time.perf_counter() - t0) * 1000.0
    try:
        with conn.cursor() as cur:
            t_ping = time.perf_counter()
            cur.execute("SELECT 1;")
            one = cur.fetchone()
            ping_ms = (time.perf_counter() - t_ping) * 1000.0
            if not one or one[0] != 1:
                raise RuntimeError(f"Unexpected SELECT 1 result: {one!r}")

            counts: dict[str, int] = {}
            t_counts = time.perf_counter()
            for table in TABLES:
                cur.execute(f"SELECT COUNT(*) FROM {table};")
                row = cur.fetchone()
                counts[table] = int(row[0]) if row else 0
            counts_ms = (time.perf_counter() - t_counts) * 1000.0

        return {
            "ok": True,
            "driver": "postgres",
            "target": masked,
            "connect_ms": round(connect_ms, 2),
            "select1_ms": round(ping_ms, 2),
            "counts_ms": round(counts_ms, 2),
            "counts": counts,
            "warning": port_warning,
        }
    finally:
        conn.close()


def check_sqlite(sqlite_path: Path, auto_init_if_missing: bool = True) -> dict[str, Any]:
    """Connect to SQLite, run SELECT 1, count rows in the 4 tables, and measure latency."""
    if not sqlite_path.is_file() and auto_init_if_missing:
        ensure_sqlite_ready(sqlite_path)
    elif not sqlite_path.is_file():
        raise FileNotFoundError(f"SQLite file not found at {sqlite_path} (run python3 db/init_sqlite.py)")

    t0 = time.perf_counter()
    conn = sqlite3.connect(str(sqlite_path))
    connect_ms = (time.perf_counter() - t0) * 1000.0
    try:
        cur = conn.cursor()
        t_ping = time.perf_counter()
        one = cur.execute("SELECT 1;").fetchone()
        ping_ms = (time.perf_counter() - t_ping) * 1000.0
        if not one or one[0] != 1:
            raise RuntimeError(f"Unexpected SELECT 1 result: {one!r}")

        counts: dict[str, int] = {}
        t_counts = time.perf_counter()
        for table in TABLES:
            row = cur.execute(f"SELECT COUNT(*) FROM {table};").fetchone()
            counts[table] = int(row[0]) if row else 0
        counts_ms = (time.perf_counter() - t_counts) * 1000.0

        # Auto-seed if SQLite was freshly created with 0 schemes/personas so check_connection is turnkey
        if auto_init_if_missing and (counts["schemes"] == 0 or counts["sessions"] == 0):
            conn.close()
            ensure_sqlite_ready(sqlite_path)
            conn = sqlite3.connect(str(sqlite_path))
            cur = conn.cursor()
            for table in TABLES:
                row = cur.execute(f"SELECT COUNT(*) FROM {table};").fetchone()
                counts[table] = int(row[0]) if row else 0

        rel_target = (
            str(sqlite_path.relative_to(REPO_ROOT))
            if sqlite_path.is_relative_to(REPO_ROOT)
            else str(sqlite_path)
        )
        return {
            "ok": True,
            "driver": "sqlite",
            "target": rel_target,
            "connect_ms": round(connect_ms, 2),
            "select1_ms": round(ping_ms, 2),
            "counts_ms": round(counts_ms, 2),
            "counts": counts,
        }
    finally:
        conn.close()


def format_counts(counts: dict[str, int]) -> str:
    return ", ".join(f"{tbl}={counts.get(tbl, 0)}" for tbl in TABLES)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify Postgres (Supabase :6543) and SQLite connectivity, latency, and row counts (DB-04)."
    )
    parser.add_argument(
        "--sqlite-path",
        default=None,
        help="Override SQLITE_PATH (default: data/gram_sahayak.sqlite).",
    )
    parser.add_argument(
        "--require-postgres",
        action="store_true",
        help="Exit non-zero if DATABASE_URL is unset or Postgres check fails.",
    )
    parser.add_argument(
        "--bootstrap-postgres",
        action="store_true",
        help="Apply db/schema.postgres.sql, seed_db.py, and demo_reset.py on Postgres before checking.",
    )
    parser.add_argument(
        "--ensure-sqlite",
        action="store_true",
        help="Ensure local SQLite has schema + 13 schemes + 5 demo personas before checking.",
    )
    args = parser.parse_args(argv)

    load_env()
    configured_driver = os.environ.get("DB_DRIVER", "sqlite").strip().lower()
    database_url = os.environ.get("DATABASE_URL", "").strip()
    sqlite_path = resolve_sqlite_path(args.sqlite_path)

    print(f"=== GramSahayak DB Connectivity & Row Count Check (configured DB_DRIVER={configured_driver}) ===")

    pg_result: dict[str, Any] | None = None
    pg_failed = False

    if database_url:
        try:
            if args.bootstrap_postgres:
                bootstrap_postgres(database_url)
            pg_result = check_postgres(database_url)
            if pg_result.get("warning"):
                print(f"[WARN] POSTGRES: {pg_result['warning']}")
            print(
                f"[OK] POSTGRES ({pg_result['target']}): SELECT 1 = 1 | "
                f"connect={pg_result['connect_ms']:.2f} ms, select1={pg_result['select1_ms']:.2f} ms, "
                f"counts_query={pg_result['counts_ms']:.2f} ms | "
                f"rows: {format_counts(pg_result['counts'])}"
            )
        except Exception as exc:
            pg_failed = True
            print(
                f"[FAIL] POSTGRES ({mask_database_url(database_url)}): {exc}",
                file=sys.stderr,
            )
    else:
        if args.bootstrap_postgres or args.require_postgres or configured_driver == "postgres":
            pg_failed = True
            print(
                "[FAIL] POSTGRES: DATABASE_URL is not set in .env or environment "
                "(set Supabase Transaction Pooler port 6543 URL or switch DB_DRIVER=sqlite).",
                file=sys.stderr,
            )
        else:
            print(
                "[INFO] POSTGRES: DATABASE_URL is empty in .env "
                "(running in local fallback mode; paste Supabase :6543 URL into .env to enable Postgres)."
            )

    sqlite_result: dict[str, Any] | None = None
    sqlite_failed = False
    try:
        if args.ensure_sqlite:
            ensure_sqlite_ready(sqlite_path)
        sqlite_result = check_sqlite(sqlite_path, auto_init_if_missing=True)
        print(
            f"[OK] SQLITE ({sqlite_result['target']}): SELECT 1 = 1 | "
            f"connect={sqlite_result['connect_ms']:.2f} ms, select1={sqlite_result['select1_ms']:.2f} ms, "
            f"counts_query={sqlite_result['counts_ms']:.2f} ms | "
            f"rows: {format_counts(sqlite_result['counts'])}"
        )
    except Exception as exc:
        sqlite_failed = True
        print(f"[FAIL] SQLITE ({sqlite_path}): {exc}", file=sys.stderr)

    # Verify seed row count parity
    parity_failed = False
    if sqlite_result:
        sq_c = sqlite_result["counts"]
        if sq_c["schemes"] != 13 or sq_c["sessions"] < 5 or sq_c["user_profiles"] < 5:
            parity_failed = True
            print(
                f"[FAIL] SQLITE seed counts incomplete: expected schemes=13, sessions>=5, user_profiles>=5; "
                f"got {format_counts(sq_c)}",
                file=sys.stderr,
            )

    if pg_result:
        pg_c = pg_result["counts"]
        if pg_c["schemes"] != 13 or pg_c["sessions"] < 5 or pg_c["user_profiles"] < 5:
            parity_failed = True
            print(
                f"[FAIL] POSTGRES seed counts incomplete: expected schemes=13, sessions>=5, user_profiles>=5; "
                f"got {format_counts(pg_c)} "
                "(run: python3 db/check_connection.py --bootstrap-postgres)",
                file=sys.stderr,
            )
        elif sqlite_result:
            sq_c = sqlite_result["counts"]
            if pg_c["schemes"] == sq_c["schemes"] and pg_c["user_profiles"] == sq_c["user_profiles"]:
                print(
                    f"[OK] PARITY: Postgres and SQLite seed row counts match "
                    f"(schemes={pg_c['schemes']}, user_profiles={pg_c['user_profiles']}, sessions={pg_c['sessions']})."
                )
            else:
                parity_failed = True
                print(
                    f"[FAIL] PARITY MISMATCH: Postgres ({format_counts(pg_c)}) != SQLite ({format_counts(sq_c)})",
                    file=sys.stderr,
                )
    elif sqlite_result and not parity_failed:
        sq_c = sqlite_result["counts"]
        print(
            f"[OK] SEED COUNTS (SQLite active): schemes={sq_c['schemes']}/13, "
            f"user_profiles={sq_c['user_profiles']}/5, sessions={sq_c['sessions']}/5."
        )

    if pg_failed or sqlite_failed or parity_failed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
