#!/usr/bin/env python3
"""Deliver the previous ISO week's edition via the worker API.

This client is deliberately separate from send_via_api.py. The daily client
selects today's ``drafts/digest-*.md`` file; this client selects the exact
weekly ``drafts/weekly-GGGG-Www.md`` file and sends cadence=weekly. The worker
chooses the previous week and the weekly audience itself.

Env: SEND_API_URL (default https://ai-news.nullzwo.dev/send), SEND_TOKEN.
"""
import json
import os
import sys
import urllib.error
import urllib.request

from _env import load  # noqa: E402 (load the repo .env before reading config)

load()

import digest_state  # noqa: E402
from render_email import parse  # noqa: E402
from weekly import draft_path, previous_week  # noqa: E402

URL = os.environ.get("SEND_API_URL", "https://ai-news.nullzwo.dev/send")
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def main() -> int:
    week = previous_week()

    # Check this before credentials, draft parsing, or network setup. A
    # successful send, including a recorded 409, is a complete no-op.
    if digest_state.is_ok("send", week):
        print(f"[savepoint] send already ok for {week} — skipping")
        return 0

    token = os.environ.get("SEND_TOKEN")
    if not token:
        print("ERROR: SEND_TOKEN not set (shared token for the send API)", file=sys.stderr)
        return 3

    src = draft_path(week)
    if not src.exists():
        print(f"ERROR: weekly draft not found: {src}", file=sys.stderr)
        return 1

    sections = [
        {"title": section["title"], "items": section["items"], "label": section.get("label")}
        for section in parse(src.read_text())
    ]
    if not sections or any(not section["items"] for section in sections):
        print(f"ERROR: weekly draft has no sendable sections: {src}", file=sys.stderr)
        return 1

    # Do not include week or date. The worker derives the previous completed
    # week and uses it as the idempotency key.
    payload = {"cadence": "weekly", "sections": sections}
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "user-agent": "ai-news-digest-weekly/1",
        },
        method="POST",
    )
    print(f"[send] {src.name} -> {URL}")
    try:
        with OPENER.open(req, timeout=30) as response:
            result = json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        print(json.dumps({"http_error": exc.code, "body": body}, indent=2))
        if exc.code == 409:
            print(f"[send] weekly issue for {week} already went out; not sending again", file=sys.stderr)
            digest_state.mark("send", "ok", week)
            return 0
        digest_state.mark("send", "failed", week)
        return 1
    except Exception as exc:
        digest_state.mark("send", "failed", week)
        print(f"[send] error: {exc}", file=sys.stderr)
        return 1

    digest_state.mark("send", "ok", week)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
