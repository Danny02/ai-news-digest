# 04 — Choose the runner home

Status: resolved
Type: grilling
Blocked by:

## Question

Where does this daily job run, given the requirement is genuinely hands-off (it
must fire even when the reader is not actively using the tool)?

Research so far has surfaced **@jl1990/pi-scheduler**, a Pi extension for
scheduled agent actions (`once`/`interval`/`cron`; `shell`/`prompt`/`notify`/
`message`). Its key limitation: in-process timers mean tasks fire **only while
Pi is running** — if Pi is closed, they don't fire until the next session
starts. That conflicts with "hands-off daily even when I'm not on the machine."

Work this with the reader (grilling). Surface the real options and their
trade-offs:

- **@jl1990/pi-scheduler alone** — simplest, integrated with Pi, but only fires
  while Pi is open (not truly hands-off).
- **Pi Scheduler + an OS-level wake (launchd/cron)** that starts Pi or triggers
  the job on schedule — hybrid, fills the gap.
- **A scheduled GitHub Actions workflow** in this repo — cloud, runs without the
  Mac, email/API creds as repo secrets.
- **Local launchd/cron directly** running a script — no Pi needed at deploy
  time, but no model access unless it shells into one.

Consider the model-access question: the summary needs an LLM (or a summarising
prompt) — where does the runner get that? That determines where 05's prose
authoring can live.

Resolve with a decision + recommendation.

## Answer

**Runner: @trevonistrevon/pi-loop, fired while Pi runs; missed loops catch up
at the next Pi login.**

Decided by grilling the reader, one question at a time:

- Availability: the Mac is usually on, and the reader accepts a digest that
  lands a bit late or at next login. No hard 07:00 cloud guarantee needed.
- Trigger: pi-loop (not pi-scheduler) — loop fired while Pi runs, no separate
  launchd/cron wake. Zero extra moving part; the reader prefers scheduler
  convenience over exact cadence.
- Model access: yes, for free — the job runs inside a Pi session, so the Pi
  model authors the summary. No external LLM call needed.
- Package choice (reader override): @trevonistrevon/pi-loop over
  @jl1990/pi-scheduler. Same Pi-in-process model; pi-loop adds cron/event/
  background-monitor surface. Install: `pi install npm:@trevonistrevon/pi-loop`.
- Rejected: a launchd wake (extra plist not worth a hard guarantee the user
  doesn't need) and GitHub Actions / cloud (overkill given the Mac is on).

Consequence for the fog: because the runner is Pi (model access + local state),
both previously-unpinnable items are now specifiable — see new tickets 05 and
06. The X-fetch and email calls run as loops from Pi (Bearer Token +
`RESEND_API_KEY` as env).
