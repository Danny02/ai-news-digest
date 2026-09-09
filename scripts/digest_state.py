#!/usr/bin/env python3
"""Savepoints for the daily and weekly digest pipelines.

One small state file per key records which stages finished, so re-running a
pipeline only does what is missing (or failed). Daily keys are UTC dates; a
weekly key is an ISO week. The worker files daily issues under UTC today and
weekly issues under the previous completed ISO week.

State files:
  runs/state-YYYY-MM-DD.json    daily, e.g. {"fetch": "ok", "send": "failed"}
  runs/state-GGGG-Www.json      weekly, e.g. {"fetch": "ok", "condense": "ok"}

A stage is either absent (missing), "ok", or "failed". Failed stages are
retried on the next run; ok stages are skipped. Daily behaviour uses the
original five stages. Weekly runs select their own three stages with
``--week``.

CLI:
  python3 scripts/digest_state.py show [--date D | --week W]
  python3 scripts/digest_state.py check <stage> [--date D | --week W]
  python3 scripts/digest_state.py mark <stage> ok|failed [--date D | --week W]
  python3 scripts/digest_state.py remaining [--date D | --week W]
"""
import argparse
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DAILY_STAGES = ["fetch", "topics", "filter", "summary", "send"]
WEEKLY_STAGES = ["fetch", "condense", "send"]
# Keep the original name for callers that inspect the daily stage set.
STAGES = DAILY_STAGES


def today() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")


def path_for(key: str) -> pathlib.Path:
    """Return the state path for a daily date or an ISO-week key."""
    return ROOT / "runs" / f"state-{key}.json"


def load(key: str) -> dict:
    p = path_for(key)
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text())
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def status(stage: str, key: str) -> str:
    """'ok' | 'missing' | 'failed' for one stage."""
    return load(key).get(stage, "missing")


def is_ok(stage: str, key: str | None = None) -> bool:
    return status(stage, key or today()) == "ok"


def remaining(key: str, stages: list | None = None) -> list:
    """Return stages not marked ok for a daily or weekly key."""
    selected = DAILY_STAGES if stages is None else stages
    return [s for s in selected if status(s, key) != "ok"]


def mark(stage: str, state: str, key: str | None = None) -> None:
    d = key or today()
    all_stages = DAILY_STAGES + [s for s in WEEKLY_STAGES if s not in DAILY_STAGES]
    if stage not in all_stages:
        raise SystemExit(f"unknown stage {stage!r}; stages: {', '.join(all_stages)}")
    if state not in ("ok", "failed"):
        raise SystemExit(f"state must be 'ok' or 'failed', got {state!r}")
    data = load(d)
    data[stage] = state
    p = path_for(d)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n")
    tmp.replace(p)


def selected_stages(args) -> list:
    return WEEKLY_STAGES if args.week else DAILY_STAGES


def cmd_show(args, key: str) -> int:
    data = load(key)
    for stage in selected_stages(args):
        print(f"{stage:8s} {data.get(stage, 'missing')}")
    return 0


def cmd_check(args, key: str) -> int:
    st = status(args.stage, key)
    print(f"{args.stage}: {st}")
    return {"ok": 0, "missing": 1, "failed": 2}[st]


def cmd_mark(args, key: str) -> int:
    if args.stage not in selected_stages(args):
        raise SystemExit(
            f"unknown stage {args.stage!r} for this key; stages: {', '.join(selected_stages(args))}"
        )
    mark(args.stage, args.state, key)
    print(f"{args.stage}: {args.state}")
    return 0


def cmd_remaining(args, key: str) -> int:
    # Always exit 0: callers distinguish "empty list" from "tool broken" via
    # stderr/stdout, never via the exit code.
    print(" ".join(remaining(key, selected_stages(args))))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="digest savepoints")
    sub = ap.add_subparsers(dest="cmd", required=True)

    # --date and --week live on the subparsers only (a top-level twin would
    # clobber the value with the subparser's default). Canonical weekly form:
    # `remaining --week 2026-W33`.
    def with_key(p):
        keys = p.add_mutually_exclusive_group()
        keys.add_argument("--date", default=None, help="UTC date YYYY-MM-DD (default: today)")
        keys.add_argument("--week", default=None, help="ISO week GGGG-Www")
        return p

    c = with_key(sub.add_parser("show"))
    c.set_defaults(fn=cmd_show)
    c = with_key(sub.add_parser("check"))
    c.add_argument("stage")
    c.set_defaults(fn=cmd_check)
    c = with_key(sub.add_parser("mark"))
    c.add_argument("stage")
    c.add_argument("state", choices=["ok", "failed"])
    c.set_defaults(fn=cmd_mark)
    c = with_key(sub.add_parser("remaining"))
    c.set_defaults(fn=cmd_remaining)
    args = ap.parse_args()
    key = args.week or args.date or today()
    return args.fn(args, key)


if __name__ == "__main__":
    sys.exit(main())