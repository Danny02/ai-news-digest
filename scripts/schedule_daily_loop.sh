#!/usr/bin/env bash
# Wire the daily AI News Digest loop — 11:30 every day.
#
# The pi-loop extension tools (LoopCreate) are only available inside a pi
# session AFTER the extension is loaded (install already done; a `/reload`
# registers them). Run this helper and paste the printed LoopCreate line into
# that session. Keep cwd at the repo.
set -euo pipefail
cd "$(dirname "$0")/.."

cat <<'EOF'
================================================================
 Daily AI News Digest loop — 11:30 every day
================================================================

Step 1. In an OPEN pi session (this repo's worktree), if pi-loop tools are
        missing, run the reload first:

    /reload

Step 2. Paste this ONE line to create the daily loop:

EOF

# Compact prompt: tells the agent to read the full instructions on disk.
# ANSI-C quoting ($'...') so the apostrophe and the embedded quote in the
# trigger string both survive without a shell quote-dance.
SHORT_PROMPT=$'Run the daily AI News Digest job: read /Users/Daniel.Heinrich/dev/experiments/x-ai-news-digest/prompts/daily-loop.md and skills/ai-news-digest/SKILL.md, then fetch, select topics, filter, summarise and broadcast today\'s digest via scripts/send_via_api.py. After sending, re-arm the loop for tomorrow 11:30 (cron loops expire after 7 days) via LoopUpdate/LoopCreate trigger="30 11 * * *".'

echo "LoopCreate trigger=\"30 11 * * *\" prompt=\"$SHORT_PROMPT\""
echo
cat <<'EOF'
Step 3. Verify it took:  LoopList
        (or /loop / /schedules) should show the 11:30 daily loop.

Step 4. (optional) kill any sandbox leftover from earlier live/design work:
        not needed — pi-loop runs in-process in the pi session.
================================================================
EOF
