#!/usr/bin/env python3
"""DB-06: snapshot the 4 contract tables to db/snapshots/<UTC time>-<driver>/.

    python3 db/snapshot.py                    # driver from DB_DRIVER (memory -> sqlite)
    python3 db/snapshot.py --driver postgres  # Supabase via DATABASE_URL (backend/.env or .env)

Writes tables.json (all rows, JSON columns parsed, booleans as true/false) + meta.json; for SQLite
also a consistent copy of the database file (sqlite3 backup API). Never prints secrets.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _dbenv import BOOL_COLUMNS, JSON_COLUMNS, REPO_ROOT, TABLES, load_envs  # noqa: E402
from init_sqlite import resolve_sqlite_path  # noqa: E402
from seed_db import open_postgres_conn, resolve_driver  # noqa: E402

SNAP_DIR = REPO_ROOT / "db" / "snapshots"


def normalize(table: str, row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if k in JSON_COLUMNS.get(table, ()) and isinstance(v, str):
            try:
                v = json.loads(v)
            except ValueError:
                pass
        elif k in BOOL_COLUMNS.get(table, ()) and v is not None:
            v = bool(v)
        elif hasattr(v, "isoformat"):
            v = v.isoformat().replace("+00:00", "Z")
        elif v is not None and type(v).__name__ == "Decimal":
            v = float(v)
        out[k] = v
    return out


def read_sqlite(path: Path) -> dict[str, list[dict]]:
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    try:
        return {t: [normalize(t, dict(r)) for r in conn.execute(f"SELECT * FROM {t}")] for t in TABLES}
    finally:
        conn.close()


def read_postgres(url: str) -> dict[str, list[dict]]:
    import psycopg2.extras

    conn = open_postgres_conn(url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            data = {}
            for t in TABLES:
                cur.execute(f"SELECT * FROM {t}")
                data[t] = [normalize(t, dict(r)) for r in cur.fetchall()]
            return data
    finally:
        conn.close()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--driver", choices=("sqlite", "postgres"))
    ap.add_argument("--sqlite-path")
    args = ap.parse_args(argv)
    load_envs()
    driver = resolve_driver(args.driver)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = SNAP_DIR / f"{stamp}-{driver}"
    out.mkdir(parents=True, exist_ok=False)
    if driver == "sqlite":
        src = resolve_sqlite_path(args.sqlite_path)
        if not src.exists():
            print(f"[FAIL] SQLite file not found: {src}")
            return 1
        data = read_sqlite(src)
        with sqlite3.connect(str(src)) as s, sqlite3.connect(str(out / "gram_sahayak.sqlite")) as d:
            s.backup(d)
    else:
        data = read_postgres(os.environ.get("DATABASE_URL", ""))
    (out / "tables.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    counts = {t: len(rows) for t, rows in data.items()}
    (out / "meta.json").write_text(json.dumps({"created_at": stamp, "driver": driver, "counts": counts}, indent=2), encoding="utf-8")
    print(f"[OK] snapshot {out.relative_to(REPO_ROOT)}: " + ", ".join(f"{t}={n}" for t, n in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
