"""Shared env loading for DB-06 scripts: backend/.env then the root .env (no override of real env)."""
from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TABLES = ("sessions", "user_profiles", "interaction_logs", "schemes")
JSON_COLUMNS = {"sessions": {"history"}, "interaction_logs": {"detail"}, "schemes": {"documents", "sms_summary", "rules"}}
BOOL_COLUMNS = {"user_profiles": {"bpl", "pregnant"}, "interaction_logs": {"ok"}}


def load_envs() -> None:
    for env_file in (REPO_ROOT / "backend" / ".env", REPO_ROOT / ".env"):
        if not env_file.is_file():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if s and not s.startswith("#") and "=" in s:
                k, v = s.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
