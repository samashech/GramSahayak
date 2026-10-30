#!/usr/bin/env python3
"""DB-06: restore the 4 contract tables from a snapshot made by db/snapshot.py.

    python3 db/restore.py                          # latest snapshot -> DB_DRIVER (memory -> sqlite)
    python3 db/restore.py --snapshot db/snapshots/<dir> --driver sqlite
    python3 db/restore.py --driver postgres --force   # --force also required when APP_ENV=production

Replaces all rows of sessions, user_profiles, interaction_logs and schemes in one transaction.
A snapshot from either driver can be restored into either driver.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _dbenv import BOOL_COLUMNS, JSON_COLUMNS, REPO_ROOT, TABLES, load_envs  # noqa: E402
from init_sqlite import init_sqlite, resolve_sqlite_path  # noqa: E402
from seed_db import open_postgres_conn, resolve_driver  # noqa: E402

SNAP_DIR = REPO_ROOT / "db" / "snapshots"
INSERT_ORDER = ("sessions", "user_profiles", "interaction_logs", "schemes")  # FK: profiles -> sessions


def latest_snapshot() -> Path | None:
    dirs = sorted(p for p in SNAP_DIR.glob("*") if (p / "tables.json").is_file())
    return dirs[-1] if dirs else None


def to_db(table: str, row: dict, driver: str) -> dict:
    out = {}
    for k, v in row.items():
        if table == "interaction_logs" and k == "id":
            continue  # new ids; sequences stay consistent
        if k in JSON_COLUMNS.get(table, ()) and v is not None:
            if driver == "sqlite":
                v = json.dumps(v, ensure_ascii=False)
            else:
                import psycopg2.extras
                v = psycopg2.extras.Json(v)
        elif k in BOOL_COLUMNS.get(table, ()) and v is not None and driver == "sqlite":
            v = 1 if v else 0
        out[k] = v
    return out


def restore(data: dict, driver: str, sqlite_path: Path | None) -> dict:
    ph = "?" if driver == "sqlite" else "%s"
    if driver == "sqlite":
        init_sqlite(sqlite_path)  # schema exists (idempotent)
        conn = sqlite3.connect(str(sqlite_path))
        conn.execute("PRAGMA foreign_keys = ON")
    else:
        conn = open_postgres_conn(os.environ.get("DATABASE_URL", ""))
    try:
        cur = conn.cursor()
        for t in reversed(INSERT_ORDER):
            cur.execute(f"DELETE FROM {t}")
        counts = {}
        for t in INSERT_ORDER:
            rows = [to_db(t, r, driver) for r in data.get(t, [])]
            for r in rows:
                cols = list(r)
                cur.execute(f"INSERT INTO {t} ({', '.join(cols)}) VALUES ({', '.join([ph] * len(cols))})", [r[c] for c in cols])
            counts[t] = len(rows)
        conn.commit()
        return counts
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--snapshot", help="snapshot directory (default: latest in db/snapshots)")
    ap.add_argument("--driver", choices=("sqlite", "postgres"))
    ap.add_argument("--sqlite-path")
    ap.add_argument("--force", action="store_true", help="allow restore when APP_ENV=production")
    args = ap.parse_args(argv)
    load_envs()
    if os.environ.get("APP_ENV", "development").strip().lower() == "production" and not args.force:
        print("[REFUSED] APP_ENV=production: restore replaces all rows. Re-run with --force if you are sure.")
        return 2
    snap = Path(args.snapshot) if args.snapshot else latest_snapshot()
    if not snap or not (snap / "tables.json").is_file():
        print("[FAIL] no snapshot found (run python3 db/snapshot.py first)")
        return 1
    driver = resolve_driver(args.driver)
    data = json.loads((snap / "tables.json").read_text(encoding="utf-8"))
    counts = restore(data, driver, resolve_sqlite_path(args.sqlite_path) if driver == "sqlite" else None)
    print(f"[OK] restored {snap.name} -> {driver}: " + ", ".join(f"{t}={n}" for t, n in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
