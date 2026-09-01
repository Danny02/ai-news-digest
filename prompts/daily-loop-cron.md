# Daily AI News Digest — cron job prompt (fired by system cron at 11:30)

You are the daily AI News Digest job. Produce and send today's digest.

## What to do, in order

Independently read and follow `skills/ai-news-digest/SKILL.md` in
`/Users/Daniel.Heinrich/dev/experiments/x-ai-news-digest/`. It is the full,
validated procedure. Then:

## Savepoints — skip what is already done

Every stage is tracked in `runs/state-<YYYY-MM-DD>.json` (UTC dates), driven
by `scripts/digest_state.py`. Re-runs only do what is missing or failed:

    python3 scripts/digest_state.py remaining    # what is left today
    python3 scripts/digest_state.py check fetch  # exit 0 done, 1 missing, 2 failed
    python3 scripts/digest_state.py show

- fetch and send check and mark their own state inside their scripts — run
  them as usual, they skip when already done.
- After you write an artifact, mark its stage ok. Never mark a stage ok
  unless its artifact exists and is from today.
- A stage marked failed is retried — do not skip it.

1. **Fetch.** Run `./scripts/run_digest_loop.sh` (or the fetch phase of
   `python3 scripts/run_pipeline.py fetch`). This runs discovery, follow-ups,
   and merge, writing `runs/*.json`. Use the `DESEARCH_API_KEY` env var.
2. **Select topics.** Read `scripts/condense_phase1.py` output against
   `prompts/select_topics.md`, write `runs/topics.json`, then
   `python3 scripts/digest_state.py mark topics ok`.
3. **Follow-up.** `python3 scripts/phase2_followup.py` (already handled by the
   runner if you ran it, else run it).
4. **Filter.** Read `runs/candidates.json` against `prompts/filter.md`, write
   `runs/kept.json` (or update `scripts/apply_filter.py` KEEP and run it),
   then `python3 scripts/digest_state.py mark filter ok`.
5. **Summarise.** Write `drafts/digest-<YYYY-MM-DD>.md` following
   `prompts/summary.md` (~500 words, theme-grouped, **every bullet carries a
   `[author](url)` source link, one bullet = one physical line**), then
   `python3 scripts/digest_state.py mark summary ok`.
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

## This run is fired by cron

System cron started this session at 11:30 local time. Do not create,
update, schedule, or re-arm any loop — cron calls this job again tomorrow.
Your full stdout is recorded to `logs/YYYY-MM-DD.jsonl`; the environment
(PATH, API keys) is already set up by `scripts/cron_digest.sh`. When every
stage is already done, `scripts/cron_digest.sh` does not launch this session
at all — a rerun is a no-op.

## Done criteria

- One broadcast sent to the whole subscriber segment (Resend Broadcast).
- The issue JSON is stored in the archive (`GET /archive/<date>` shows it).
- `python3 scripts/digest_state.py show` lists all five stages ok.
- Final reply: one short line with today's date and the archive URL.