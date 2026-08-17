# 10 — Walk the pipeline manually, phase by phase

Status: resolved
Type: prototype
Blocked by: (02)

Can the digest pipeline be walked by hand, one phase at a time, with the reader
reviewing each phase before the next runs — so that the final skill/loop is
built from what was actually learned rather than guessed?

Reader's call: do it manually first, review together at each step, improve, and
only then codify into the scheduled loop.

## Phases

1. **Discovery sweep** — run the 6 pass-1 queries from ticket 02, review the
   raw catch together.
2. **Follow-up dig** — agent picks topics worth explaining, runs pass-2
   queries, review what the *why* material looks like.
3. **Filter** — apply the "would-change-my-setup" bar, review what got kept and
   what got dropped, and why. Tune the bar.
4. **Summary prose** — write the digest, review length/format/grouping. Feeds
   ticket 05.
5. **Delivery** — send the real email via Resend, review how it reads in an
   inbox.
6. **Codify** — turn the learned pipeline into the pi-loop schedule + skill.

Each phase records what was learned and what changed. The answer is the
validated pipeline plus the list of adjustments made along the way.

## Progress (manual walkthrough)

- **Phase 1 — discovery (done).** 6 topic queries + 1 query per trusted account
  (12 accounts). 81 posts from a 2-day window. Bugs found & fixed: burst
  empty-return (pacing + retry), account crowding (one query per account),
  missing recency window (`since:`), crypto noise (exclusions). Crono filter
  also validated. Script: `scripts/phase1_discovery.py`.
- **Phase 2 — follow-up dig (done).** Model-composed topic selection against
  `prompts/select_topics.md`; 5 topics, each expanded with a widened (7-day)
  query. 146 new posts. Query rule hardened: keep it to the topic identifier,
  sharpen the anchor instead of adding clauses. Script:
  `scripts/phase2_followup.py`, topics in `runs/topics.json`.
- **Phase 3 — filter (done).** Market scripted via `scripts/merge_candidates.py`
  (219 unique candidates, cross-source dedup) + `scripts/apply_filter.py`
  + `prompts/filter.md` (219 → 28). The user reviewed every cut. Engagement is
  not the bar; the model filter does the judgement.
- **Phase 4 — summary prose (done).** Digest drafted at ~510 words (reader
  chose ~500 over 350), theme-grouped, claim-style headings. Draft:
  `drafts/digest-2026-08-03.md`, prompt `prompts/summary.md`.
- **Phase 5 — delivery (done).** Built an HTML email template
  (`templates/email.html`) with dark header, themed sections, colored left
  borders; renderer `scripts/render_email.py`; send `scripts/send_digest.py`
  via Resend from `digest@nullzwo.dev`. Live HTML send approved by the
  reader. Sender domain `nullzwo.dev` is verified (not `senacor.com`).
  Recipients are managed by the worker (Resend segment); no per-address list.

## Answer

(To be written on Phase 6 completion: the validated pipeline + adjustments
list + the codified loop/skill.)

The pipeline is **validated end-to-end and codified**.

**Adjustments the manual walkthrough forced (this is the real value):**
- Pace + retry Desearch calls (a burst silently returns `[]`).
- One query per trusted account (a combined `from:` chain lets one account
  crowd the rest out).
- Always bound with `since:` or the API returns all-time top posts, not news.
- Keep follow-up queries to the topic identifier; a second qualifying clause
  collapses results to zero (verified twice).
- Bypass macOS system proxy in code (`ProxyHandler({})`) or urllib hangs while
  curl works.
- Cross-source dedup: a post in 2+ buckets is a relevance signal.
- Engagement is not the bar; the model filter does the judgement. Reader
  reviewed every cut.
- Summary is ~500 words (reader chose it over 350) and theme-grouped.
- Email needs HTML (plain text was rejected) and a verified sender domain
  (`nullzwo.dev`, not `senacor.com`).

**Deliverables:**
- Orchestrator `scripts/run_pipeline.py` (fetch chain + send chain).
- Skill `skills/ai-news-digest/SKILL.md` — the full validated procedure incl.
  the reliability rules, ready for the pi-loop agent to follow on schedule.
- Prompts `prompts/select_topics.md`, `prompts/filter.md`, `prompts/summary.md`.
- Email template `templates/email.html` + renderer `scripts/render_email.py`.
- Live HTML delivery approved by the reader.

**Cost:** ~22 requests/day ≈ 55 cents/month at `$0.00045`/request.

**Runner note:** ticket 04 chose @trevonistrevon/pi-loop as the scheduler. The
skill above is the work the loop's recurring prompt invokes; wiring the exact
loop/interval is the remaining (small) step, pending the reader's Pi setup.
