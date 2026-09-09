#!/usr/bin/env bash
# Weekly AI News Digest — cron entrypoint.
#
# Fires the weekly edition on Monday at 09:00 UTC host time, ahead of the
# daily run, for the previous completed ISO week.
#
# Operator installation: these are host crontab entries on the operator's
# machine, not managed infrastructure. Install them manually alongside the
# daily entry below. The host/cron timezone must be UTC.
#
# Crontab lines:
#   0 9 * * 1 /Users/Daniel.Heinrich/dev/experiments/x-ai-news-digest/scripts/cron_weekly.sh
#  30 11 * * * /Users/Daniel.Heinrich/dev/experiments/x-ai-news-digest/scripts/cron_digest.sh
#
# Weekly logs (in repo root):
#   logs/weekly-GGGG-Www.jsonl     pi session transcript (JSONL, --mode json)
#   logs/weekly-GGGG-Www.err.log   stderr + status lines
#
# Weekly state and lock:
#   runs/state-GGGG-Www.json       fetch/condense/send savepoints
#   logs/.weekly-digest.lock       separate from logs/.digest.lock
#
set -uo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/cron_lib.sh"

WEEK="$(python3 "$REPO/scripts/weekly.py")"
JSONL="logs/weekly-$WEEK.jsonl"
ERRL="logs/weekly-$WEEK.err.log"

# PROMPT_FILE override for manual tests; default is the weekly cron prompt.
PROMPT_FILE="${PROMPT_FILE:-prompts/weekly-loop-cron.md}"
LOCK="logs/.weekly-digest.lock"

# The weekly model turn condenses seven days of archived issues, so allow up
# to six hours before treating its lock as stale. Daily keeps its 3h default.
WEEKLY_LOCK_STALE_SECONDS=21600

cron_setup "$LOCK" "$PROMPT_FILE" "$JSONL" "$ERRL"
if ! cron_acquire_lock "$WEEKLY_LOCK_STALE_SECONDS"; then
  exit 0
fi

# Savepoints: only launch pi when a weekly stage is missing or failed
# (runs/state-<ISO week>.json, driven by scripts/digest_state.py). When all
# three stages are done, a rerun is a no-op — zero tokens, zero API calls.
log "starting (week=$WEEK prompt=$PROMPT_FILE)"
REMAINING=$(python3 "$REPO/scripts/digest_state.py" remaining --week "$WEEK" 2>/dev/null) \
  || REMAINING="remaining?"   # state tool broken -> fail open, do the work
log "savepoints ($WEEK) remaining: ${REMAINING:-none}"
if [ -z "$REMAINING" ]; then
  log "all stages done for $WEEK — nothing to do, skipping pi"
  exit 0
fi

cron_run_model
exit $?
