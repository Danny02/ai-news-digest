#!/usr/bin/env python3
"""Deliver the day's digest to the whole mailing list via the worker API.

Renders the draft markdown into the WORKER's structured newsletter JSON
(sections: title + items), then calls POST /send with the shared SEND_TOKEN.
The worker does the HTML templating and sends a Resend Broadcast to the
subscriber segment — no per-address list here.

The worker dates the issue itself (UTC today) and refuses a second send for
the same day with a 409, so this script sends no date and refuses to post a
draft that is not today's.

Env: SEND_API_URL (default https://ai-news.nullzwo.dev/send), SEND_TOKEN.
"""
import datetime
import json
import os
import pathlib
import sys
import urllib.request

from _env import load  # noqa: E402  (loads .env before any os.environ read)
load()

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from render_email import parse  # noqa: E402

URL = os.environ.get("SEND_API_URL", "https://ai-news.nullzwo.dev/send")
# Bypass macOS system proxy discovery (same fix as the other scripts).
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def main() -> int:
    token = os.environ.get("SEND_TOKEN")
    if not token:
        print("ERROR: SEND_TOKEN not set (shared token for the send API)", file=sys.stderr)
        return 3
    drafts = sorted((ROOT / "drafts").glob("digest-*.md"))
    if not drafts:
        print("no digest draft found", file=sys.stderr)
        return 1
    src = drafts[-1]
    draft_date = src.stem.replace("digest-", "")
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    if draft_date != today and "--force" not in sys.argv:
        print(
            f"ERROR: newest draft is {draft_date}, but the worker files every issue\n"
            f"       under UTC today ({today}). Generate today's draft, or pass --force.",
            file=sys.stderr,
        )
        return 2

    # parse() returns sections [{title, items, key, label}]; the worker treats
    # label as optional and falls back to "Digest". Drop key.
    sections = [
        {"title": s["title"], "items": s["items"], "label": s.get("label")}
        for s in parse(src.read_text())
    ]
    payload = {"sections": sections}

    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "user-agent": "curl/8.7.1",
        },
        method="POST",
    )
    print(f"[send] {src.name} -> {URL}")
    try:
        with OPENER.open(req, timeout=30) as resp:
            result = json.load(resp)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        print(json.dumps({"http_error": exc.code, "body": body}, indent=2))
        if exc.code == 409:
            print(f"[send] today's issue already went out; not sending again", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
