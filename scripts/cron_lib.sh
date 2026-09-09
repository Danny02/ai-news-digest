#!/usr/bin/env bash

CRON_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$CRON_LIB_DIR/.." && pwd)"
cd "$REPO" || exit 1

# Full pi path so cron's minimal PATH cannot break the call; export a
# reasonable PATH for the python/node helpers the session spawns.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Pin the provider on the CLI (flags beat settings.json defaults). Env vars
# like PI_PROVIDER are ignored by pi 0.84.2. claude-bridge rides the local
# Claude CLI subscription, so it needs no auth.json key.
PROVIDER=claude-bridge
MODEL=claude-sonnet-5
THINKING=medium

# Load secrets from repo-root .env if present (never echoed).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

log() { echo "[digest] $(date -u) $*" >> "$ERRL"; }

cron_setup() {
  LOCK="$1"
  PROMPT_FILE="$2"
  JSONL="$3"
  ERRL="$4"
  mkdir -p "$(dirname "$LOCK")" "$(dirname "$JSONL")" "$(dirname "$ERRL")"
}

cron_acquire_lock() {
  # The optional age keeps the daily caller's 3h default unchanged while
  # allowing longer-running callers to choose their own staleness window.
  local stale_after="${1:-10800}"
  # Overlap guard: skip if a run started within the configured window is
  # still going (cron cannot overlap in practice, but a manual run can).
  if [ -f "$LOCK" ]; then
    AGE=$(( $(date +%s) - $(stat -f %m "$LOCK") ))
    if [ "$AGE" -lt "$stale_after" ]; then
      log "skipping: another run active (lock age ${AGE}s)"
      return 1
    fi
    log "removing stale lock (age ${AGE}s)"
    rm -f "$LOCK"
  fi
  echo "$$" > "$LOCK"
  trap 'rm -f "$LOCK"' EXIT
}

cron_run_model() {
  # Loud failure marker: a headless run can exit 0 while the model turn
  # aborted (auth errors surface as an empty turn, stopReason=error).
  # Only inspect the lines appended by THIS run (the daily file accumulates).
  # tail streams directly into grep so a huge run cannot trigger a broken pipe.
  WC_BEFORE=$(wc -l < "$JSONL" 2>/dev/null || echo 0)
  /opt/homebrew/bin/pi --provider "$PROVIDER" --model "$MODEL" --thinking "$THINKING" \
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
  return "$RC"
}
