#!/usr/bin/env python3
"""Initialize the local GramSahayak SQLite database from db/schema.sqlite.sql.

Idempotent by default: creates parent directories and applies CREATE TABLE/INDEX IF NOT EXISTS.
Pass --reset to delete an existing SQLite database before recreating (refused if APP_ENV=production).
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "db" / "schema.sqlite.sql"
EXPECTED_TABLES = ("interaction_logs", "schemes", "sessions", "user_profiles")


def load_root_env(env_path: Path) -> None:
    """Lightweight .env reader using stdlib only so init_sqlite.py works with zero pip installs."""
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def resolve_sqlite_path(cli_path: str | None) -> Path:
    raw = cli_path or os.environ.get("SQLITE_PATH", "data/gram_sahayak.sqlite")
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = REPO_ROOT / candidate
    return candidate


def init_sqlite(db_path: Path, reset: bool = False) -> list[str]:
    app_env = os.environ.get("APP_ENV", "development").strip().lower()
    if reset:
        if app_env == "production":
            raise RuntimeError("Refusing to run --reset when APP_ENV=production.")
        for suffix in ("", "-wal", "-shm", "-journal"):
            target = Path(f"{db_path}{suffix}")
            if target.exists():
                target.unlink()

    if not SCHEMA_PATH.is_file():
        raise FileNotFoundError(f"Missing SQLite schema file: {SCHEMA_PATH}")

    db_path.parent.mkdir(parents=True, exist_ok=True)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.executescript(schema_sql)
        conn.commit()

        rows = conn.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name;
            """
        ).fetchall()
        tables = [r[0] for r in rows]
    finally:
        conn.close()

    return tables


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize GramSahayak SQLite database (DB-02).")
    parser.add_argument(
        "--path",
        default=None,
        help="Override SQLITE_PATH (default: data/gram_sahayak.sqlite from .env or contract).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing SQLite database and recreate cleanly (blocked when APP_ENV=production).",
    )
    args = parser.parse_args()

    load_root_env(REPO_ROOT / ".env")
    db_path = resolve_sqlite_path(args.path)

    try:
        tables = init_sqlite(db_path, reset=args.reset)
    except Exception as exc:
        print(f"[FAIL] SQLite initialization failed: {exc}", file=sys.stderr)
        return 1

    missing = [t for t in EXPECTED_TABLES if t not in tables]
    if missing:
        print(f"[FAIL] Missing expected tables: {missing} (found: {tables})", file=sys.stderr)
        return 1

    rel_display = db_path.relative_to(REPO_ROOT) if db_path.is_relative_to(REPO_ROOT) else db_path
    print(f"[OK] SQLite initialized at {rel_display}")
    print(f"[OK] Tables ({len(tables)}): {', '.join(tables)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
