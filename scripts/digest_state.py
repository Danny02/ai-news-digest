#!/usr/bin/env python3
"""Savepoints for the daily digest pipeline.

One small state file per day records which stages finished, so re-running the
pipeline only does what is missing (or failed). Dates are UTC — the worker
files every issue under UTC today (see send_via_api.py).

State file: runs/state-YYYY-MM-DD.json    e.g. {"fetch": "ok", "send": "failed"}

A stage is either absent (missing), "ok", or "failed". Failed stages are
retried on the next run; ok stages are skipped.

CLI:
  python3 scripts/digest_state.py show [--date D]       table of all stages
  python3 scripts/digest_state.py check <stage> [--date D]   exit 0 ok / 1 missing / 2 failed
  python3 scripts/digest_state.py mark <stage> ok|failed [--date D]
  python3 scripts/digest_state.py remaining [--date D]  prints stages not ok (exit 0)
"""
import argparse
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
STAGES = ["fetch", "topics", "filter", "summary", "send"]


def today() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")


def path_for(date: str) -> pathlib.Path:
    return ROOT / "runs" / f"state-{date}.json"


def load(date: str) -> dict:
    p = path_for(date)
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text())
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def status(stage: str, date: str) -> str:
    """'ok' | 'missing' | 'failed' for one stage."""
    return load(date).get(stage, "missing")


def is_ok(stage: str, date: str | None = None) -> bool:
    return status(stage, date or today()) == "ok"


def remaining(date: str) -> list:
    return [s for s in STAGES if status(s, date) != "ok"]


def mark(stage: str, state: str, date: str | None = None) -> None:
    d = date or today()
    if stage not in STAGES:
        raise SystemExit(f"unknown stage {stage!r}; stages: {', '.join(STAGES)}")
    if state not in ("ok", "failed"):
        raise SystemExit(f"state must be 'ok' or 'failed', got {state!r}")
    data = load(d)
    data[stage] = state
    p = path_for(d)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n")
    tmp.replace(p)


def cmd_show(args, d: str) -> int:
    data = load(d)
    for s in STAGES:
        print(f"{s:8s} {data.get(s, 'missing')}")
    return 0


def cmd_check(args, d: str) -> int:
    st = status(args.stage, d)
    print(f"{args.stage}: {st}")
    return {"ok": 0, "missing": 1, "failed": 2}[st]


def cmd_mark(args, d: str) -> int:
    mark(args.stage, args.state, d)
    print(f"{args.stage}: {args.state}")
    return 0


def cmd_remaining(args, d: str) -> int:
    # Always exit 0: callers distinguish "empty list" from "tool broken" via
    # stderr/stdout, never via the exit code.
    print(" ".join(remaining(d)))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="digest savepoints")
    sub = ap.add_subparsers(dest="cmd", required=True)

    # --date lives on the subparsers only (a top-level twin would clobber
    # the value with the subparser's default). Canonical: `remaining --date D`.
    def with_date(p):
        p.add_argument("--date", default=None, help="UTC date YYYY-MM-DD (default: today)")
        return p

    c = with_date(sub.add_parser("show"))
    c.set_defaults(fn=cmd_show)
    c = with_date(sub.add_parser("check"))
    c.add_argument("stage")
    c.set_defaults(fn=cmd_check)
    c = with_date(sub.add_parser("mark"))
    c.add_argument("stage")
    c.add_argument("state", choices=["ok", "failed"])
    c.set_defaults(fn=cmd_mark)
    c = with_date(sub.add_parser("remaining"))
    c.set_defaults(fn=cmd_remaining)
    args = ap.parse_args()
    d = args.date or today()
    return args.fn(args, d)


if __name__ == "__main__":
    sys.exit(main())