# Map: X AI-News Digest

## Destination

An automated, hands-off daily job that fetches new AI news from X public posts
via the Desearch API, filters them against a personal relevance bar, writes a
short prose summary, and emails it to the reader each morning. Runs on its own
schedule with no interaction required.

## Notes

**Domain:** X/Twitter public posts; AI news; relevance filtering; scheduled
automation; email delivery.

**Source = X search via Desearch (decided).** The official X API free tier
ended Feb 2026, and free proxy/scraper paths are dead (captcha-gated or
private-serverside). Desearch resolves this: real X search at **$0.00045 per
request** — about **14 cents/month** at this job's volume. That is cheap enough
to satisfy the reader's cost bar without giving up X as the source. Rejected
Sorsa: cheaper per 1,000 tweets at scale, but its floor is a $49/mo plan, ~350x
worse for a few hundred requests a month.

**The "would-change-my-setup" bar (binding constraint).** A post belongs in the
digest only if it could plausibly change what the reader runs or how they run
it. Model releases only when people actually talk about them (DeepSeek-tier),
not routine point releases (a boring new Qwen). Plus anything practical: agent
tools, orchestration patterns, prompting techniques, Pi-extension ideas, and
learnings.

**Standing preferences (from destination grilling):**
- Delivery: email.
- Cadence: daily.
- Filter: curated and filtered, not high-recall.
- Search: a fixed curated query set, not an open "AI news" query.
- Cost: near-free required. Desearch pay-per-use (~$0.14/mo) clears the bar;
  flat monthly plans do not.
- Runner: @trevonistrevon/pi-loop (resolved, ticket 04).

**Credentials.** The Desearch key is a secret: keep it in an env var
(`DESEARCH_API_KEY`) or the reader's secret manager, never in this repo. Auth
header is `Authorization: <key>` (plain, no `Bearer`).

**Skills every session should consult:** grilling (taste decisions are the
reader's), research (tool/API facts), domain-modeling (naming).

**Tracker:** local-markdown. Map `map.md`, child tickets under `issues/`.

## Decisions so far

- [01 — Choose the X data-fetch tool](issues/01-choose-x-data-fetch-tool.md) —
  **Desearch API** (`GET https://api.desearch.ai/twitter`, header
  `Authorization: <key>`). Verified live: auth accepted, endpoint valid,
  service "X Search". `$0.00045`/request, no monthly minimum. Rejected the
  official X API (~$30/mo at this volume) and Sorsa ($49/mo floor).
- [03 — Choose the email delivery mechanism](issues/03-choose-email-delivery-mechanism.md) —
  use Resend Free (transactional API; $0, 3,000 emails/mo, 100/day, one
  `RESEND_API_KEY`); Postmark Developer as runner-up; avoid Gmail app passwords
  and SendGrid's temp trial.
- [04 — Choose the runner home](issues/04-choose-runner-home.md) —
  **@trevonistrevon/pi-loop** fired while Pi runs, missed loops catch up at next
  login (no launchd wake, no cloud; Mac is usually on; reader chose pi-loop over
  pi-scheduler). Runner is Pi, so it has model access and local state.
- [09 — Top up Desearch balance and verify live](issues/09-top-up-desearch-and-verify.md) —
  funded and **verified live**. Returns a bare JSON array of posts with author
  embedded free and full engagement counts. `min_faves:` and `since:` operators
  both pass through and filter correctly. Keep `count` ≤ 30 (50 times out).
  Billed per request, not per post ≈ **7 cents/month**.
- [10 — Walk the pipeline manually, phase by phase](issues/10-walk-pipeline-manually.md) —
  **pipeline validated end-to-end and codified.** Discovery + follow-up + filter
  (219→28) + ~500-word themed summary + HTML email via Resend, all built from
  what the manual walkthrough actually learned, not guessed.

- [02 — Define the curated search set](issues/02-define-curated-search-set.md) —
  a **two-pass agentic search**: 6 fixed discovery queries (model releases,
  orchestration, prompting/context, coding-agent tools, model experience, and a
  trusted-account allow-list seeded with `@mattpocockuk` / `@dexhorthy`), then
  3–5 agent-composed follow-up queries that dig into *why* each topic is talked
  about. Noise is handled by the model filter, not tighter floors. All queries
  validated live. ≈ 10 requests/day ≈ 14 cents/month.

## Not yet specified

_(cleared — no fog. The remaining tickets are all sharply specified.)_

## Out of scope

- **Private content (DMs / locked accounts).** This effort reads only public
  posts from public accounts. DM reading and scraping anything behind login is
  ruled out — agreed in destination grilling.
- **Multiple recipients.** One reader (the owner). No multi-user delivery.
- **Free X scrapers and proxy sites.** snscrape/Nitter are dead; proxy search
  sites are captcha-gated or private-serverside. Superseded by Desearch. See
  closed ticket
  [07 — Build the free scraper fetch path](issues/07-build-free-scraper-fetch-path.md).
- **RSS as the source.** Charted as a pivot while X looked unreachable, then
  dropped once Desearch made X search viable and near-free. RSS would have
  narrowed the net to feeds already subscribed to. See closed ticket
  [08 — Build the RSS fetch path](issues/08-build-rss-fetch-path.md).
