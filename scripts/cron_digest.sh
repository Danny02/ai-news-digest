#!/usr/bin/env bash
# Daily AI News Digest — cron entrypoint.
#
# Fires a fresh headless pi session with the digest prompt every day at
# 11:30. Replaces the old pi-loop schedule (loops expire after 7 days and
# only fire while an interactive session is open).
#
# Crontab line:
#   30 11 * * * /Users/Daniel.Heinrich/dev/experiments/x-ai-news-digest/scripts/cron_digest.sh
#
# Logs (in repo root):
#   logs/YYYY-MM-DD.jsonl     pi session transcript (JSONL, --mode json)
#   logs/YYYY-MM-DD.err.log   stderr + status lines
#
set -uo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/cron_lib.sh"

DAY="$(date +%F)"
JSONL="logs/$DAY.jsonl"
ERRL="logs/$DAY.err.log"

# PROMPT_FILE override for manual tests; default is the cron variant of the
# daily loop prompt (no loop re-arm step).
PROMPT_FILE="${PROMPT_FILE:-prompts/daily-loop-cron.md}"
LOCK="logs/.digest.lock"

cron_setup "$LOCK" "$PROMPT_FILE" "$JSONL" "$ERRL"
if ! cron_acquire_lock; then
  exit 0
fi

# Savepoints: only launch pi for stages that are missing or failed today
# (runs/state-<UTC date>.json, driven by scripts/digest_state.py). When
# everything is done, a rerun is a no-op — zero tokens, zero API calls.
DAY_UTC="$(date -u +%F)"
log "starting (prompt=$PROMPT_FILE)"
REMAINING=$(python3 "$REPO/scripts/digest_state.py" remaining --date "$DAY_UTC" 2>/dev/null) \
  || REMAINING="remaining?"   # state tool broken -> fail open, do the work
log "savepoints ($DAY_UTC) remaining: ${REMAINING:-none}"
if [ -z "$REMAINING" ]; then
  log "all stages done for $DAY_UTC — nothing to do, skipping pi"
  exit 0
fi

cron_run_model
exit $?