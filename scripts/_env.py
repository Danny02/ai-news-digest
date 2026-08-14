"""Load secrets from the repo-root .env into os.environ. Never prints values."""

import pathlib

ENV_PATH = pathlib.Path(__file__).resolve().parent.parent / ".env"


def load():
    """Parse .env lines into os.environ (only if not already set)."""
    if not ENV_PATH.exists():
        return
    for raw in ENV_PATH.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("\"'")
        if key:
            import os
            os.environ.setdefault(key, val)


load()
