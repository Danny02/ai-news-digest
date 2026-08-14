---
name: ai-news-digest
description: Build and run a daily AI-news digest that discovers relevant X posts via the Desearch API, filters them against the user's "would-change-my-setup" bar, writes a theme-grouped summary, and emails it as HTML via Resend. Use when asked to run, update, extend, or debug the AI news digest pipeline.
---

# AI News Digest

A daily, agent-run news digest. Everything below was validated live, end to
end, in hands-on walkthroughs. Follow the steps and the query/prompt rules
exactly — each rule exists because a real run broke without it.

## Where things live

- Repo: `/Users/Daniel.Heinrich/dev/experiments/x-ai-news-digest/`
- Orchestrator: `scripts/run_pipeline.py` (chains fetch, then send)
- Mechanical scripts: `scripts/phase1_discovery.py`, `phase2_followup.py`,
  `merge_candidates.py`, `condense_phase1.py`, `apply_filter.py`,
  `render_email.py` (parsing only), `send_via_api.py`
- Agent-judgment prompts: `prompts/select_topics.md`, `prompts/filter.md`,
  `prompts/summary.md`
- Run artifacts: `runs/` (phase1-discovery.json, topics.json, phase2-followup.json,
  candidates.json, kept.json)
- Deliverable: `drafts/digest-<date>.md`
- Send: worker `POST /send` renders the email and broadcasts it to the
  subscriber segment (see `worker/README.md` for the API contract)

## Setup (once)

```bash
export DESEARCH_API_KEY=...   # api.desearch.ai, plain Authorization header (NOT "Bearer")
export RESEND_API_KEY=...     # sending-only key
export SENDER='Daniel Heinrich <digest@nullzwo.dev>'
```

Secrets live in env vars / the secret manager — never commit them.

## Pipeline

Run fetch, do the three judgment steps in conversation, run send.

### 1. Fetch (scripted)

```bash
python3 scripts/run_pipeline.py fetch
```

This runs discovery (17 queries: 5 topic buckets + 12 trusted-account queries),
prints where to do topic selection, runs follow-up dig, and merges candidates.

**Desearch reliability rules** (each one caused a real failure):
- `Authorization: <key>` with NO `Bearer` prefix.
- Pace queries (script handles this) and retry on empty; a burst returns
  `[]` silently.
- Keep `count <= 30` (50 times out).
- Bypass macOS system proxy in code (`ProxyHandler({})`) — urllib otherwise
  hangs/403s while curl works. `scripts/*.py` already do this.
- Always include `since:<date>` or the API returns all-time top posts.

### 2. Topic selection (AGENT — judgment)

Read the condensed phase-1 output and write `runs/topics.json`:

```bash
python3 scripts/condense_phase1.py
```

Follow `prompts/select_topics.md`. Key rules:
- Pick 3–5 topics by **convergence** (distinct voices), not like-count.
- Keep each query to the **topic identifier**. A second qualifying clause
  collapses results to zero. Sharpen the anchor instead of adding clauses.
- Anchor abstract topics to a concrete product name.

### 3. Follow-up dig (scripted)

`run_pipeline.py fetch` already runs it once `topics.json` exists.

### 4. Filter (AGENT — judgment)

Merge already ran (`runs/candidates.json`). Apply `prompts/filter.md` by
reading the merged list directly:

Write `runs/kept.json`. Rules:
- Engagement is NOT the bar. A 35k-like personal post is noise; a 240-like
  model-verbosity post is signal.
- Drop: off-domain personal, funding/org drama, crypto, engagement bait,
  course promo, vague hype, pure reaction.
- Prefer the explaining post over the announcing post.
- Dedupe by post id across all buckets (a post appearing in 2+ buckets is a
  +relevance signal).

### 5. Summary (AGENT — judgment)

Write `drafts/digest-<date>.md` following `prompts/summary.md`:
- ~500 words, theme-grouped, claim-style headings (`## Opus 5: people are
  souring on it`).
- One line per kept item; fold duplicates.
- Plain literal English, lead with substance, no hype words.

**Hard email rules (a breach ships to the reader):**
- **Every bullet carries a `[author](url)` source link** from `kept.json`.
- **One bullet = one physical source line.** Never soft-wrap a bullet across
  lines — a mis-aligned wrapped bullet was shipping truncated mid-sentence.
- Use `_italics_`; the renderer handles links, bold, code, and italics, and
  hides links from the italic pass so a `_` inside a handle/URL is safe.

### 6. Send (scripted)

The worker broadcasts to the whole subscriber list — there are no per-address
emails. `send_via_api.py` parses the newest draft and POSTs it to `/send`.

```bash
python3 scripts/run_pipeline.py send       # == send_via_api.py
# or, keeping the fetch/send split explicit:
python3 scripts/send_via_api.py
```

Send contract (see `worker/src/index.js` / `worker/README.md`):
- **No recipient list.** A single Resend Broadcast goes to the whole segment.
- **No date.** The issue is always dated UTC today; `--force` posts a draft
  whose date is not today, which is normally an error.
- **One issue per day.** A repeat send for the same day is refused (`409`).
- The markdown is rendered by the worker (`src/email.js`), so the deliverable
  is the `.md` draft only — no local `.html` is produced.
The renderer must be current; the worker carries the link-stash italic fix.

You need `SEND_TOKEN` in `.env` (shared bearer token for `/send`).

## Cost

~17 requests fetch + ~5 follow-up ≈ 22 req/day ≈ 55 cents/month at
`$0.00045`/request. Billing is per request, not per post.

## Extending

- **Add a trusted account**: add the handle to the `ACCOUNTS` list in
  `phase1_discovery.py`. One query per account (a combined `from:` chain lets
  a high-volume account crowd the rest out).
- **Add a query bucket**: add to `QUERIES` in `phase1_discovery.py`; keep the
  `since:`/lang/-filter suffix. Add a color in `render_email.py` if the theme
  is new.
- **Security**: rotate the Desearch and Resend keys if ever pasted in plaintext
  chat. Store as env vars.
