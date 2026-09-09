#!/usr/bin/env python3
"""Shared paths and UTC ISO-week calculation for the weekly pipeline."""
import datetime
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def previous_week(now: datetime.date | datetime.datetime | None = None) -> str:
    """Return the ISO week immediately before the current UTC week."""
    if now is None:
        current = datetime.datetime.now(datetime.timezone.utc).date()
    elif isinstance(now, datetime.datetime):
        current = now.astimezone(datetime.timezone.utc).date()
    else:
        current = now
    previous = current - datetime.timedelta(days=7)
    iso = previous.isocalendar()
    return f"{iso.year:04d}-W{iso.week:02d}"


def archive_path(week: str) -> pathlib.Path:
    return ROOT / "runs" / f"weekly-{week}.json"


def draft_path(week: str) -> pathlib.Path:
    return ROOT / "drafts" / f"weekly-{week}.md"


if __name__ == "__main__":
    print(previous_week())
