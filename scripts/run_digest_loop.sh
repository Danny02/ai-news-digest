#!/usr/bin/env bash
# Daily AI News Digest — one-command entrypoint for the pi-loop schedule.
#
# Fires the full pipeline every day at ~11:30:
#   1. fetch (discovery + follow-up + merge)  -> runs/*.json
#   2. AGENT (judgment in the loop prompt): topic selection, filter, summary
#      per skills/ai-news-digest/SKILL.md and prompts/*.md
#   3. broadcast the newest draft to the subscriber segment via the worker
#      (scripts/send_via_api.py -> POST /send)
#
# Env needed: DESEARCH_API_KEY, RESEND_API_KEY, SEND_TOKEN, SENDER (optional).
# No per-address recipient list: the worker owns the audience.
set -euo pipefail
cd "$(dirname "$0")/.."

# Load secrets from repo-root .env if present (never echoed).
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

echo "[digest] $(date -u) starting"

# --- 1) fetch ---
# Runs phase1 (discovery), reports where to select topics, runs phase2 + merge.
python3 scripts/run_pipeline.py fetch

# --- 2) AGENT step (done by the loop's model, not this script) ---
# The pi-loop prompt instructs: read runs/candidates.json, apply
# prompts/filter.md -> runs/kept.json, then write drafts/digest-<date>.md per
# prompts/summary.md. This script assumes that happened before send.

# --- 3) render + send the newest draft via the worker API (broadcast) ---
LATEST=$(ls -1t drafts/digest-*.md | head -1)
if [ -z "$LATEST" ]; then
  echo "[digest] no digest draft found" >&2
  exit 1
fi
echo "[digest] sending: $LATEST"
python3 scripts/send_via_api.py
# send_via_api.py targets the newest draft; it needs SEND_TOKEN from .env.
echo "[digest] done"
