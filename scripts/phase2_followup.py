#!/usr/bin/env python3
"""Phase 2 - follow-up dig.

Discovery (phase 1) finds *that* a topic is being talked about. This pass finds
*why*: the comparisons, benchmarks, and reactions that explain it.

Topics come from runs/topics.json, which the agent writes after reading the
condensed phase-1 output against prompts/select_topics.md.
"""
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

# Wider than discovery: the conversation about a release outlives the release.
LOOKBACK_DAYS = int(os.environ.get("FOLLOWUP_LOOKBACK_DAYS", "7"))
SINCE = (dt.date.today() - dt.timedelta(days=LOOKBACK_DAYS)).isoformat()
SUFFIX = f"since:{SINCE} lang:en -filter:retweets"




def search(query: str, attempts: int = 2) -> list:
    url = f"{API}?{urllib.parse.urlencode({'query': query, 'count': COUNT})}"
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
            time.sleep(5)
    return []


def main() -> int:
    if not KEY:
        print("DESEARCH_API_KEY not set", file=sys.stderr)
        return 1

    print(f"  window: since:{SINCE}\n", file=sys.stderr)
    out_dir = pathlib.Path(__file__).resolve().parent.parent / "runs"
    seen_ids = {p.get("id") for p in json.loads((out_dir / "phase1-discovery.json").read_text())}

    topics = json.loads((out_dir / "topics.json").read_text())

    results = {}
    for index, topic in enumerate(topics):
        if index:
            time.sleep(3)
        slug = topic["slug"]
        query = f"{topic['query']} {SUFFIX}"
        try:
            hits = search(query)
        except Exception as exc:
            print(f"  {slug}: FAILED {exc!r}", file=sys.stderr)
            continue
        fresh = [p for p in hits if p.get("id") not in seen_ids]
        results[slug] = {
            "why": topic.get("why", ""),
            "voices": topic.get("voices", []),
            "query": query,
            "posts": sorted(hits, key=lambda p: -p.get("like_count", 0)),
        }
        print(f"  {slug}: {len(hits)} hits, {len(fresh)} not seen in phase 1", file=sys.stderr)

    (out_dir / "phase2-followup.json").write_text(json.dumps(results, indent=2))
    total = sum(len(v["posts"]) for v in results.values())
    print(f"\n{total} posts across {len(results)} topics -> {out_dir / 'phase2-followup.json'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
