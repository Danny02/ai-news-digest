# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single reader (the owner, a developer) who receives the digest by email each
morning and reads it on phone or desktop between tasks. Job: in under a minute,
learn what changed this week in AI that could affect how they work, and spot
the concrete fix or tool worth acting on.

## Product Purpose

A daily AI-news digest email. Discovers relevant X posts via the Desearch API
(search + trusted-account queries), follows up on the strongest topics, filters
to the reader's "would-change-my-setup" bar, and delivers a theme-grouped
summary. Designed to be scanned, then skimmed, then (rarely) followed up on.

## Positioning

The digest is not a headline feed and not a summary of everything. It applies a
relevance bar ("could this change how I run things or how I work?") and
surfaces the actionable item behind each story — the fix, config, or tool — not
just the news.

## Operating Context

Read daily by one engineer on phone/Gmail and occasionally desktop. Rendered
inside email clients, so the HTML must be table-based with inline styles, work
in Gmail/Outlook/Apple Mail and on mobile, and degrade to a plain-text part for
clients that strip HTML. Emails are brief (under a minute to scan). The digest
is read as a morning ritual alongside other email, not as a destination site.

## Capabilities and Constraints

- Must render correctly in email clients: table-based layout, inline CSS,
  no external stylesheets or scripts, max-width ~600px, dark-mode/MO
  considerations.
- Must include a plain-text fallback (the reader rejected a text-only send as
  badly formatted, so HTML is required; the plain part still needs to read
  cleanly).
- Content is theme-grouped (one claim-style heading per theme, one line per
  post). ~500 words.
- Includes topic accents per theme (colored markers per section).
- Sender: digest@nullzwo.dev (verified domain). The digest is broadcast once a
  day to the whole subscriber segment via the worker (`POST /send`); there is
  no per-recipient emailing from the pipeline.
- Technical pipeline (scripts, prompts, skill) already exists and is validated;
  this task is the visual design of the email artifact itself.

## Brand Commitments

- No external brand assets exist; no logo beyond the wordmark "AI News Digest".
- Voice: plain, literal, technical, no hype words, no exclamation marks for
  effect. (Established in prompts/summary.md.)
- The reader liked an earlier dark-header + themed-colour-sections treatment
  and did not ask to change it, but has requested a complete redesign with
  multiple options to choose from — so the direction is open, that treatment is
  one option, not a binding constraint.

## Evidence on Hand

- Real digest draft: drafts/digest-2026-08-03.md (theme-grouped, real copy).
- Existing HTML template (dark header, colored left-border bullets) at
  templates/email.html — approved as "great" in first send; the redesign is
  the owner asking to go further, not a fix.
- Current renderer: worker `src/email.js` renders the stored structured JSON
  into the broadcast; the pipeline only produces the `drafts/digest-<date>.md`
  draft and sends it via `scripts/send_via_api.py`.
  (A previous legacy renderer/template — `scripts/render_email.py` +
  `templates/email.html` + per-recipient `send_digest.py` — was replaced by the
  worker broadcast.)
- No images/assets on hand; all imagery must be authorable or omitted.

## Product Principles

1. Read before persuaded — the reader acts on a scan; hierarchy and one-glance
   grouping beat decoration.
2. Theme is the atomic unit — each section must be distinguishable at a glance
   (colour, weight, spacing) without relying on borders alone.
3. Plain over artful for content — the copy carries the value; the design gives
   it a frame it wants to be scanned in, not compete with it.
4. Every accent must survive email-client flattening and dark modes.
5. Finish means shipped — the design is only real if it renders in the actual
   inbox, so every option is validated as real email HTML, not a browser mock.

## Accessibility & Inclusion

Must hold body-text contrast ≥4.5:1 in light and (where feasible) dark modes.
Readable at ~60-75 characters per line in a 600px column. Not reliant on colour
alone (theme markers are a supplement, not the only cue).
