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
# Full pi path so cron's minimal PATH cannot break the call; export a
# reasonable PATH for the python/node helpers the session spawns.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Pin a key-based provider on the CLI (flags beat settings.json defaults).
# opencode-go has a plain key in ~/.pi/agent/auth.json; the claude-bridge
# default (claude-opus-5) needs interactive OAuth and aborts headless runs
# with "Not logged in". Env vars like PI_PROVIDER are ignored by pi 0.84.2.
PROVIDER=opencode-go
MODEL=deepseek-v4-flash

# Load secrets from repo-root .env if present (never echoed).
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

DAY="$(date +%F)"
JSONL="logs/$DAY.jsonl"
ERRL="logs/$DAY.err.log"
mkdir -p logs
log() { echo "[digest] $(date -u) $*" >> "$ERRL"; }

# Overlap guard: skip if a run started <3h ago is still going (daily cron
# cannot overlap in practice, but a manual run can).
LOCK="logs/.digest.lock"
if [ -f "$LOCK" ]; then
  AGE=$(( $(date +%s) - $(stat -f %m "$LOCK") ))
  if [ "$AGE" -lt 10800 ]; then
    log "skipping: another run active (lock age ${AGE}s)"
    exit 0
  fi
  log "removing stale lock (age ${AGE}s)"
  rm -f "$LOCK"
fi
echo "$$" > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

# PROMPT_FILE override for manual tests; default is the cron variant of the
# daily loop prompt (no loop re-arm step).
PROMPT_FILE="${PROMPT_FILE:-prompts/daily-loop-cron.md}"

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

# Loud failure marker: a headless run can exit 0 while the model turn
# aborted (auth errors surface as an empty turn, stopReason=error).
# Only inspect the lines appended by THIS run (the daily file accumulates).
# tail streams directly into grep so a huge run cannot trigger a broken pipe.
WC_BEFORE=$(wc -l < "$JSONL" 2>/dev/null || echo 0)
/opt/homebrew/bin/pi --provider "$PROVIDER" --model "$MODEL" \
  --mode json --no-session -p "$(cat "$PROMPT_FILE")" \
  >> "$JSONL" 2>> "$ERRL"
RC=$?
if tail -n +$((WC_BEFORE + 1)) "$JSONL" | grep -q 'Not logged in' \
  || tail -n +$((WC_BEFORE + 1)) "$JSONL" | grep -q '"stopReason":"error"'; then
  ALERT="MODEL TURN FAILED (auth/error) — check $ERRL and $JSONL"
  echo "$ALERT" >&2
  log "$ALERT"
fi
log "pi exited rc=$RC"
exit $RC