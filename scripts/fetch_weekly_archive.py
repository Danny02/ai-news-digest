#!/usr/bin/env python3
"""Fetch the previous completed ISO week's published archive JSON.

The archive is the weekly pipeline's only input. This script creates one local
working artifact for the model and records the weekly fetch savepoint. It never
calls a discovery or research API.

Env: ARCHIVE_API_URL (default https://ai-news.nullzwo.dev/archive).
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

from _env import load  # noqa: E402 (load the repo .env before reading config)

load()

import digest_state  # noqa: E402
from weekly import archive_path, previous_week  # noqa: E402

ARCHIVE_API_URL = os.environ.get("ARCHIVE_API_URL", "https://ai-news.nullzwo.dev/archive")
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def artifact_ready(path, week: str) -> bool:
    if not path.exists():
        return False
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return False
    return isinstance(value, dict) and value.get("week") == week and isinstance(value.get("issues"), list)


def write_artifact(path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, indent=2) + "\n")
    tmp.replace(path)


def main() -> int:
    week = previous_week()
    artifact = archive_path(week)

    if digest_state.is_ok("fetch", week) and artifact_ready(artifact, week):
        print(f"[savepoint] fetch already ok for {week} — using {artifact}")
        return 0

    url = f"{ARCHIVE_API_URL.rstrip('/')}/{urllib.parse.quote(week)}.json"
    req = urllib.request.Request(url, headers={"user-agent": "ai-news-digest-weekly/1"})
    print(f"[fetch] {week} <- {url}")
    try:
        with OPENER.open(req, timeout=30) as response:
            value = json.load(response)
        if not isinstance(value, dict) or value.get("week") != week:
            raise ValueError(f"archive response has the wrong week (expected {week})")
        if not isinstance(value.get("issues"), list):
            raise ValueError("archive response has no issues list")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            # The worker uses 404 for a missing or empty week. Keep a local
            # sentinel so a rerun can skip without asking the endpoint again.
            write_artifact(artifact, {"week": week, "issues": [], "skipped": True})
            digest_state.mark("fetch", "ok", week)
            print(f"[fetch] no archived issues for {week}; skipping weekly edition")
            return 0
        digest_state.mark("fetch", "failed", week)
        print(f"[fetch] archive returned HTTP {exc.code}", file=sys.stderr)
        return 1
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        digest_state.mark("fetch", "failed", week)
        print(f"[fetch] error: {exc}", file=sys.stderr)
        return 1

    write_artifact(artifact, value)
    digest_state.mark("fetch", "ok", week)
    print(f"[fetch] saved {len(value['issues'])} archived issues to {artifact}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
