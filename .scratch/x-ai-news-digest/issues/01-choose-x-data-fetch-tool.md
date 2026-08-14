# 01 — Choose the X data-fetch tool (MCP vs API)

Status: resolved
Type: research
Blocked by:

## Question

Which tool should fetch public X posts for this daily digest: the official X
MCP server, the official X API v2 (direct), or a separate scraping layer
(snscrape etc.)?

Resolve as a decision with a recommendation. Weigh:

- Free-tier limits and cost (the job runs daily; budget is ~zero).
- Auth requirements (does it need a paid plan or user OAuth?).
- Reliability/longevity (X breaks scrapers often; the API is stable).
- Fit for a *curated keyword query* (not user-timeline crawling).
- Whether the same tool works for both fetching and follow-up enrichment.

This is the first frontier ticket: its answer shapes what 02's queries can
express and what the runner must provide credentials for.

## Answer

**Use the Desearch API.**

```
GET https://api.desearch.ai/twitter?query=<q>&count=<n>
Authorization: <key>        # plain, NOT "Bearer <key>"
accept: application/json
```

Verified live against the reader's key: auth accepted, endpoint valid, the
service identifies itself as "X Search". Other valid endpoints on the same
host: `/twitter/latest`, `/twitter/post`, `/web`. The `x-api-key` header is
rejected with 401 — the header name must be `Authorization`.

**Cost: `$0.00045` per request** (`required_cents: 0.045`), no monthly
minimum. At this job's volume (~300 requests/month) that is about **14 cents a
month**.

**Open blocker:** the account balance is currently `0`. The API returns HTTP
402 `Insufficient balance` until it is topped up. See ticket 09.

Rejected alternatives:
- **Official X API v2** — `$0.005` per *post* read, ~$30/mo at this volume, and
  it silently drops engagement operators (`min_faves:` etc). Original research
  for this option is kept below and in `research/01-x-data-fetch-tool.md`.
- **Sorsa** — genuinely cheaper per 1,000 tweets at scale ($0.02), but its
  cheapest plan is a $49/mo flat floor. ~350x worse than Desearch for a few
  hundred requests a month. Its 100 free no-card requests are useful only for
  one-off prototyping.
- **Free scrapers / proxy sites** — dead or gated (see closed ticket 07).

---

### Superseded: earlier official-X-API recommendation (kept as context)

**Use the official X API v2 `GET /2/tweets/search/recent` with an app Bearer
Token.**

- Only stable, X-owned path that supports curated keyword query operators
  (keywords, phrases, `from:user`, `lang:en`, `-is:retweet`, `has:links`).
- Returns last 7 days, up to 100 posts/request, app-only auth (no per-user
  OAuth), rate limit 450 req/15 min.
- **Cost: pay-per-use with no free tier** — `$0.005` per post read, same-post
  dedup per 24 h UTC day. A disciplined daily run of a few hundred distinct
  posts ≈ a few dollars/month. "Completely free" is not possible on a stable
  query-capable path.
- Runner-up: official X MCP server (`xdevplatform/xmcp`, `searchPostsRecent`) —
  identical API/cost/limits; choose it only if the runner is an MCP-native
  agent.
- Rejected: snscrape (broken since 2023, login wall) and Nitter (guest-account
  ban Jan 2024) — free but broken + ToS risk.

Full findings + primary sources:
`research/01-x-data-fetch-tool.md` on branch `research/01`.
