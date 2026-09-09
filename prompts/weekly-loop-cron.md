# Weekly AI News Digest — cron job prompt (fired Monday at 09:00)

You are the weekly AI News Digest job. Produce and send the edition for the
previous completed ISO week.

## What to do, in order

Independently read and follow `skills/ai-news-digest/SKILL.md` for the shared
reader and voice rules. Then read `prompts/weekly-condense.md`. This weekly run
is a second view over published data. It does no discovery, fetching from
Desearch, follow-up research, or new source collection.

Set the target key and inspect its weekly savepoints:

    WEEK="$(python3 scripts/weekly.py)"
    python3 scripts/digest_state.py show --week "$WEEK"
    python3 scripts/digest_state.py remaining --week "$WEEK"

Weekly state is in `runs/state-<GGGG-Www>.json` and has exactly these stages:
`fetch`, `condense`, and `send`. A stage marked `ok` is not repeated. Never
mark a stage `ok` unless its artifact or completed operation exists for this
week.

1. **Fetch the published week.** Run:

       python3 scripts/fetch_weekly_archive.py

   It reads `GET /archive/<GGGG-Www>.json` from the published archive. The
   optional `ARCHIVE_API_URL` environment variable changes only the archive
   base URL for local verification; it defaults to
   `https://ai-news.nullzwo.dev/archive`. The script writes
   `runs/weekly-<GGGG-Www>.json` and marks `fetch` when the file is valid.
   Do not read local daily drafts as input.

   The worker returns 404 for a missing or empty week. If the fetch script
   reports `no archived issues`, log the skip and stop successfully. Do not
   write a draft. Do not run the condense model step. Do not send.

2. **Condense.** If `condense` is not already `ok`, read the fetched
   `runs/weekly-<GGGG-Www>.json` and apply every rule in
   `prompts/weekly-condense.md`. Write the reviewable draft as
   `drafts/weekly-<GGGG-Www>.md`, then mark it:

       python3 scripts/digest_state.py mark condense ok --week "$WEEK"

   If the model turn fails, do not mark `condense` ok. Leave the failure loud
   in the cron transcript so the next run retries it. Do not use daily
   headings, the daily draft glob, or any fetching/research tool.

3. **Send.** Run only the separate weekly client:

       python3 scripts/send_weekly_via_api.py

   It sends `{"cadence":"weekly","sections":[...]}` with no `week` or
   `date`; the worker derives the previous completed week and chooses the
   weekly audience. A 409 means that week's edition is already out. The
   client records that as `send: ok`, so a rerun does not try again.

## This run is fired by cron

The host cron entry owns the Monday schedule. Do not create, update, schedule,
or re-arm a loop from this prompt. The weekly cron entrypoint uses its own
lock, logs, and weekly savepoint key; do not use the daily lock or daily client.

When all three weekly stages are already `ok`, this prompt must do nothing:
no archive HTTP request, no model turn, and no send HTTP request.

## Done criteria

- The source was the published JSON archive for the previous completed ISO week.
- The draft is `drafts/weekly-<GGGG-Www>.md` and has at most five topic blocks,
  at most four bullets per topic, plus the final full-week archive link.
- The weekly send client posted one weekly edition, or recorded a 409 as success.
- `python3 scripts/digest_state.py show --week "$WEEK"` lists fetch,
  condense, and send as `ok` for a sent week.
- The final report is one short line with the ISO week and archive URL, or the
  explicit empty-week skip.
