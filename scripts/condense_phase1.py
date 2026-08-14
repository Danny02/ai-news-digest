#!/usr/bin/env python3
"""Condense phase-1 output into a compact list for the topic-selection step.

In the scheduled loop the agent reads this, applies the selection prompt in
prompts/select_topics.md, and writes runs/topics.json.
"""
import json
import pathlib

RUNS = pathlib.Path(__file__).resolve().parent.parent / "runs"
MAX_TEXT = 190


def main() -> None:
    posts = json.loads((RUNS / "phase1-discovery.json").read_text())
    posts.sort(key=lambda p: -p.get("like_count", 0))
    for post in posts:
        user = post.get("user") or {}
        text = " ".join(post.get("text", "").split())[:MAX_TEXT]
        print(
            f"[{post.get('_bucket')}] {post.get('like_count', 0)} likes "
            f"@{user.get('username', '?')}: {text}"
        )


if __name__ == "__main__":
    main()
