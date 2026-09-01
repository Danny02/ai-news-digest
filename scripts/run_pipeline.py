#!/usr/bin/env python3
"""Run the full digest pipeline end to end.

Chains cleanly all the steps the manual walkthrough validated:

  phase 1  discovery          -> runs/phase1-discovery.json
  topic select (agent)        -> runs/topics.json      (model judgment)
  phase 2  follow-up dig      -> runs/phase2-followup.json
  merge    candidates         -> runs/candidates.json
  filter   (agent)            -> runs/kept.json        (model judgment)
  summary  (agent)            -> drafts/digest-<date>.md (model judgment)
  send     via worker API     -> Resend broadcast to the whole segment

Phases that need the agent (topic selection, filtering, summarising) are marked
STEP<-> .. so the agent does them in conversations. Everything else is scripted.

Usage:
  python3 scripts/run_pipeline.py fetch     # run phase1 + phase2 + merge (API)
  python3 scripts/run_pipeline.py send      # broadcast the current draft
"""
import os
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import digest_state  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def sh(*args: str) -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts" / args[0]), *args[1:]], check=True)


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "fetch"

    if cmd == "fetch":
        # Savepoint: a finished fetch is skipped unless --force (never burn
        # API calls on a rerun). Failures are marked so the next run retries.
        if "--force" not in sys.argv and digest_state.is_ok("fetch"):
            print(f"[savepoint] fetch already ok for {digest_state.today()} — skipping (--force to redo)")
            return 0
        try:
            bucket_f = [f"F-{a}" for a in ["mattpocockuk", "dexhorthy", "karpathy", "simonw",
                                            "trq212", "jeremyphoward", "theo", "ClaudeDevs",
                                            "alliekmiller", "pidotdev", "thdxr", "sama"]]
            sh("phase1_discovery.py")
            print("\nSTEP agent-select: read runs/phase1-discovery.json via "
                  "scripts/condense_phase1.py + prompts/select_topics.md, write runs/topics.json")
            sh("phase2_followup.py")
            sh("merge_candidates.py")
            print("\nSTEP agent-filter: read runs/candidates.json against prompts/filter.md, "
                  "write runs/kept.json (or edit scripts/apply_filter.py KEEP map)")
        except Exception:
            digest_state.mark("fetch", "failed")
            raise
        digest_state.mark("fetch", "ok")
        print(f"[savepoint] fetch marked ok for {digest_state.today()}")
    elif cmd == "send":
        # send_via_api.py parses the newest drafts/digest-*.md itself (via
        # render_email.parse), sends the structured JSON to POST /send, and
        # refuses a draft that is not dated UTC today. The worker renders and
        # broadcasts the email — nothing is rendered or stored locally.
        sh("send_via_api.py")
    else:
        print("usage: run_pipeline.py [fetch|send]", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
