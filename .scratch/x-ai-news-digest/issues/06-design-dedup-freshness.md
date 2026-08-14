# 06 — Design dedup / freshness across runs

Status: open
Type: research
Blocked by: (04)

## Question

How does the job know which posts are "new" each day, so the digest shows only
what wasn't already summarized?

The runner is a Pi session with local state (`~/.pi/agent/state/...` is the
established Pi scheduler state dir), so there is somewhere trusted to store
state. Decide:

- What to store: X post IDs already seen, the last successful run time, or both.
- Where: the Pi state dir vs a small file in this repo (`state/`).
- When a "seen" mark counts: only posts that made the final digest, or every
  fetched post?
- How each post's `created_at` interacts with this local dedup.
- Whether dedup can also cut cost: skipping already-seen posts before they are
  re-fetched keeps the per-request spend down.

Resolve with a recommendation (research, but confirm the storage location
choice with the reader — it is their Pi environment).
