#!/usr/bin/env python3
"""Merge phase-1 and phase-2 output into one deduped candidate list.

A post can appear in several phase-1 buckets and several phase-2 topics, so
dedup is by post id across everything, keeping the richest attribution.
"""
import json
import pathlib

RUNS = pathlib.Path(__file__).resolve().parent.parent / "runs"
MAX_TEXT = 240


def main() -> None:
    candidates = {}

    for post in json.loads((RUNS / "phase1-discovery.json").read_text()):
        pid = post.get("id")
        if pid:
            candidates[pid] = {"post": post, "sources": [post.get("_bucket", "?")]}

    followups = json.loads((RUNS / "phase2-followup.json").read_text())
    for slug, payload in followups.items():
        for post in payload.get("posts", []):
            pid = post.get("id")
            if not pid:
                continue
            if pid in candidates:
                candidates[pid]["sources"].append(slug)
            else:
                candidates[pid] = {"post": post, "sources": [slug]}

    rows = sorted(candidates.values(), key=lambda c: -c["post"].get("like_count", 0))

    out = []
    for row in rows:
        post = row["post"]
        user = post.get("user") or {}
        out.append(
            {
                "id": post.get("id"),
                "author": user.get("username"),
                "likes": post.get("like_count", 0),
                "created_at": post.get("created_at"),
                "sources": sorted(set(row["sources"])),
                "url": post.get("url"),
                "text": " ".join(post.get("text", "").split())[:MAX_TEXT],
            }
        )

    (RUNS / "candidates.json").write_text(json.dumps(out, indent=2))
    print(f"{len(out)} unique candidates -> {RUNS / 'candidates.json'}")

    multi = [c for c in out if len(c["sources"]) > 1]
    print(f"{len(multi)} appear in more than one bucket/topic (cross-source signal)")


if __name__ == "__main__":
    main()
