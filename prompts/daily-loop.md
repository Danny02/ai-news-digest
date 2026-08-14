# Daily AI News Digest — loop prompt (fired every day at 11:30)

You are the daily AI News Digest job. Produce and send today's digest.

## What to do, in order

Independently read and follow `skills/ai-news-digest/SKILL.md` in
`/Users/Daniel.Heinrich/dev/experiments/x-ai-news-digest/`. It is the full,
validated procedure. Then:

1. **Fetch.** Run `./scripts/run_digest_loop.sh` (or the fetch phase of
   `python3 scripts/run_pipeline.py fetch`). This runs discovery, follow-ups,
   and merge, writing `runs/*.json`. Use the `DESEARCH_API_KEY` env var.
2. **Select topics.** Read `scripts/condense_phase1.py` output against
   `prompts/select_topics.md`, write `runs/topics.json`.
3. **Follow-up.** `python3 scripts/phase2_followup.py` (already handled by the
   runner if you ran it, else run it).
4. **Filter.** Read `runs/candidates.json` against `prompts/filter.md`, write
   `runs/kept.json` (or update `scripts/apply_filter.py` KEEP and run it).
5. **Summarise.** Write `drafts/digest-<YYYY-MM-DD>.md` following
   `prompts/summary.md` (~500 words, theme-grouped, **every bullet carries a
   `[author](url)` source link, one bullet = one physical line**).
6. **Send.** `python3 scripts/send_via_api.py`. It renders the newest draft
   into structured JSON and POSTs to the worker's `/send` with `SEND_TOKEN`.
   The worker templates the email, broadcasts it to the subscriber segment,
   and stores the JSON in the archive (`/archive`). No per-address list here.

## Critical reliability rules (from live testing)

- Desearch key: `Authorization: <key>` with NO `Bearer`. The scripts already
  handle this + pacing + proxy bypass + `count<=30`. Do not change them.
- If a query returns an empty array, do not treat it as "no news" — retry
  once after a few seconds; Desearch returns `[]` on burst.
- The scripts already bypass the macOS proxy; do not "fix" their urllib usage.
- Keep dates/`since:` bounds — the API returns all-time top posts otherwise.

## This job is recurring

pi-loop cron loops expire after 7 days and fire only while the agent is idle.
After sending, ensure the loop stays scheduled for tomorrow 11:30. Use
`LoopUpdate` to mark continue (or re-issue `LoopCreate` with
`trigger="30 11 * * *"` and the same prompt) so the job persists beyond the
7-day expiry.

## Done criteria

- One broadcast sent to the whole subscriber segment (Resend Broadcast).
- The issue JSON is stored in the archive (`GET /archive/<date>` shows it).
- The daily loop is re-armed for tomorrow 11:30.
