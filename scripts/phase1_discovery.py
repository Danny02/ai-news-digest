#!/usr/bin/env python3
"""Phase 1 - discovery sweep. Runs the ticket-02 pass-1 queries against Desearch."""
import datetime as dt
import json
import os
import pathlib
import sys
import time
import urllib.parse
import urllib.request

from _env import load  # noqa: E402  (loads .env before any os.environ read)
load()

API = "https://api.desearch.ai/twitter"
KEY = os.environ.get("DESEARCH_API_KEY")
COUNT = 30

# Bypass macOS system proxy discovery: urllib otherwise hangs indefinitely on
# this host while curl to the same URL succeeds.
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

# Without a recency window the API returns all-time top posts, so a daily run
# surfaces years-old viral tweets instead of news. Two days gives a buffer for
# a missed run; dedup (ticket 06) drops anything already sent.
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "2"))
SINCE = (dt.date.today() - dt.timedelta(days=LOOKBACK_DAYS)).isoformat()
SUFFIX = f"since:{SINCE} lang:en -filter:retweets -filter:replies"

# Crypto/KOL posts clear the like floor easily but never change the reader's setup.
NOT_CRYPTO = "-crypto -token -airdrop -presale -memecoin -trencher -KOL"

# Queried one at a time: in a combined from: chain a high-volume account
# (e.g. @sama) takes most slots and the quieter accounts get no coverage.
ACCOUNTS = [
    "mattpocockuk",
    "dexhorthy",
    "karpathy",
    "simonw",
    "trq212",
    "jeremyphoward",
    "theo",
    "ClaudeDevs",
    "alliekmiller",
    "pidotdev",
    "thdxr",
    "sama",
]

QUERIES = {
    "A-model-releases": (
        "(DeepSeek OR GPT OR Claude OR Gemini OR Llama OR Qwen OR Mistral OR Kimi) "
        f"(release OR launch OR announcing OR benchmark) min_faves:3000 {NOT_CRYPTO} {SUFFIX}"
    ),
    "B-orchestration": (
        '(agent OR agents OR subagent) (orchestration OR "multi-agent" OR workflow OR harness) '
        f"min_faves:800 {SUFFIX}"
    ),
    "C-prompting-context": (
        '("context window" OR "system prompt" OR prompting OR "context rot" OR compaction) '
        f"(agent OR LLM OR Claude OR Codex) min_faves:500 {SUFFIX}"
    ),
    "D-agent-tools": (
        '("Claude Code" OR Codex OR "coding agent" OR "AI IDE") '
        f"(MCP OR extension OR skill OR plugin OR hook OR config) min_faves:500 {SUFFIX}"
    ),
    "E-model-experience": (
        '(Opus OR Sonnet OR "GPT-5") '
        '(verbose OR "been using" OR learnings OR "switched to" OR worse OR better) '
        f"min_faves:500 {SUFFIX}"
    ),
}

# No engagement floor here: these accounts are already trusted, and a floor
# would silence the smaller ones (e.g. @pidotdev) entirely.
QUERIES.update(
    {
        f"F-{handle}": f"from:{handle} since:{SINCE} -filter:replies"
        for handle in ACCOUNTS
    }
)


def search(query: str, attempts: int = 3, count: int = COUNT) -> list:
    """Desearch returns an empty list when queried in a burst, so retry and pace."""
    url = f"{API}?{urllib.parse.urlencode({'query': query, 'count': count})}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": KEY,
            "accept": "application/json",
            "user-agent": "curl/8.7.1",
        },
    )
    for attempt in range(attempts):
        with OPENER.open(req, timeout=45) as resp:
            data = json.load(resp)
        if isinstance(data, list) and data:
            return data
        if attempt < attempts - 1:
            time.sleep(5 * (attempt + 1))
    return []


def main() -> int:
    if not KEY:
        print("DESEARCH_API_KEY not set", file=sys.stderr)
        return 1

    print(f"  window: since:{SINCE}\n", file=sys.stderr)
    seen, posts = set(), []
    for index, (bucket, query) in enumerate(QUERIES.items()):
        if index:
            time.sleep(3)
        try:
            hits = search(query, count=10 if bucket.startswith("F-") else COUNT)
        except Exception as exc:
            print(f"  {bucket}: FAILED {exc!r}", file=sys.stderr)
            continue
        fresh = 0
        for post in hits:
            pid = post.get("id")
            if not pid or pid in seen:
                continue
            seen.add(pid)
            post["_bucket"] = bucket
            posts.append(post)
            fresh += 1
        print(f"  {bucket}: {len(hits)} hits, {fresh} new", file=sys.stderr)

    posts.sort(key=lambda p: -p.get("like_count", 0))
    out = pathlib.Path(__file__).resolve().parent.parent / "runs" / "phase1-discovery.json"
    out.write_text(json.dumps(posts, indent=2))
    print(f"\n{len(posts)} unique posts -> {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
