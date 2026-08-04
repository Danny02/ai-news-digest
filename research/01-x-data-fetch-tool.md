# Decision 01 — Which tool fetches public X posts

**Status:** resolved (recommendation ready)
**Date researched:** (current)
**Scope:** daily personal digest, ~zero budget, curated keyword queries of *public* posts only (no DM, no login-wall content).

---

## Recommendation (read this first)

**Use the official X API v2 Recent Search endpoint, `GET /2/tweets/search/recent`, authenticated with an app **Bearer Token** (app-only OAuth2).**

It is the only option that is:

- **Stable and long-lived** — owned by X, documented on `docs.x.com`, not broken by X's anti-bot changes.
- **A true curated-keyword search** — it takes a query string with operators (`"AI"`, `from:user`, `lang:en`, `-is:retweet`, `has:links`, phrase matching) that directly expresses the digest's curated query set. Snscrape/nitter cannot express these.
- **Cheap to keep near-zero** — pay-per-use at `$0.005` per Post returned, deduplicated within a 24 h UTC window, so the same Post is charged once per day even if fetched repeatedly. There is **no free tier today** (legacy free access ended; the current model is pay-per-use only), but a small daily budget of posts keeps the cost to a few tens of cents per month.
- **Automation-friendly** — Recent Search works with an app Bearer Token alone, so no interactive per-run OAuth consent is needed.

**Constraint to flag plainly:** none of the three candidates is currently free. The official path is cheap-but-not-free. The only free paths (snscrape / nitter) are reliably broken or against X's terms. So the recommendation optimizes for reliability + curated-query fit, and keeps the bill small by limiting fetched posts and relying on daily dedup.

---

## Runner-up

**Official X MCP server (`github.com/xdevplatform/xmcp`), specifically its `searchPostsRecent` tool.**

- It is a thin FastMCP wrapper over the **same** X API v2 contract (it loads the official OpenAPI spec at startup and exposes it as MCP tools). There is no separate cost or data access — you still need an X API app, Bearer Token + OAuth1 user token, and the same pay-per-use billing.
- **Choose it over the direct API only if the digest runner is an MCP-native agent** that wants a tool surface for both fetching (`searchPostsRecent`) and enrichment (`getUsersByUsername`, `getPostsByIds`, `getUsersMe`, etc.). That reads well against the ticket's "same tool for fetch + enrichment" test.
- **Its operational cost is higher for an automated cron-style job**: it runs a local server process, needs an OAuth1 browser-consent flow (tokens held only in-memory for the server's lifetime), and adds a moving part (the MCP server + transport) that the direct API does not.

**Decision rule:** if the runner is an agent with MCP tool access, prefer the MCP server for ergonomics; if the runner is a plain scheduled script (cron / GitHub Actions / a function), use the direct API. Both share the same underlying endpoint, limits, and billing.

---

## Comparison table

| Tool | Auth | Cost | Limits | Reliability / longevity | Curated-keyword fit | Notes |
|---|---|---|---|---|---|---|
| **X API v2 — Recent Search** `GET /2/tweets/search/recent` | App Bearer Token (app-only OAuth2); no per-user OAuth needed | Pay-per-use: `$0.005` per Post read; dedup within 24 h UTC window; no free tier today | Last **7 days** only; up to **100 Posts/request**; rate limit `450/15 min` (per app bearer), `300/15 min` (per user); 512-char query | High — official, documented, X-owned, not subject to anti-bot breakage | **Excellent** — keyword, phrase, hashtag, `from:`, `lang:`, `-is:retweet`, `has:links`, etc. | Recommended. Full-archive search (`/2/tweets/search/all`) costs the same but is limited to pay-per-use/Enterprise access; not needed for a daily digest. |
| **Official X MCP server (`xdevplatform/xmcp`)** — `searchPostsRecent` | X API app: Bearer Token **and** OAuth1 user token (interactive consent at startup) | Same pay-per-use as the raw API (it is the same API) | Same as API: 7-day window, 100/req, 450/15 min (app) | High — official; adds a local server + OAuth1 flow as moving parts | **Excellent** (same query operators) | Runner-up. Best if runner is an MCP-capable agent; heavier ops for plain cron. |
| **snscrape** | None (anonymous scraping) | Free | N/A | **Very low** — core Twitter scraper broken since ~Jun 2023 by X's login wall / bot-blocking (see primary source); effectively unmaintained | **Poor** — no native curated-query operators; scraping the search page is the broken path | Rejected. Free but broken + ToS risk. |
| **Nitter** (self-host / public instances) | None historically; now requires real X account + session tokens | Free (self-host) | N/A | **Very low** — guest-account mechanism killed Jan 2024; public instances collapsed; per-instance availability fragile | **Poor** — no consistent query API; depends on instance uptime | Rejected. Free but unreliable + ToS risk. |

---

## Why each option scored as it did

**1. Official X API v2 (recommended).** Primary sources (`docs.x.com`) document Recent Search as "available to all developers," with a clear query-language for curated keyword searches, up to 100 Posts per request, and a 7-day lookback that comfortably covers a daily run. Auth: an app Bearer Token is sufficient (the app-only rate limit is 450 requests/15 min). The catch is billing: X moved the API to **pay-per-use with no free tier** — Post reads are `$0.005` each, with same-Post dedup per 24 h UTC day. A disciplined daily run that fetches only, say, 200–500 *distinct* posts/day works out to roughly `$1–2.50`/day worst case, far less after dedup and a relevance filter — a few dollars a month. That is the closest thing to "~zero budget" that is also reliable and term-compliant.

**2. X MCP server (runner-up).** The official repo (`github.com/xdevplatform/xmcp`) is a FastMCP server that pulls the official X API OpenAPI spec and exposes it as tools, including `searchPostsRecent`. It is not a separate data source: same endpoint, same `$0.005`/Post billing, same 100/req limit. It additionally needs OAuth1 user consent at startup and a resident server process. Pick it when the runner benefits from an MCP tool surface; avoid it for a lean scheduled script.

**3. Scrapers (rejected).** Primary evidence: snscrape's own GitHub issue #996 ("All Twitter scrapes are failing" — login wall / `blocked (404)`, open since June 2023, no known workaround) shows the anonymous-scrape path is dead; the repo is effectively unmaintained. Nitter's GitHub states it now requires **real X accounts and session tokens** after X stopped issuing the guest accounts (Jan 2024) that made public instances work — i.e., it no longer offers frictionless anonymous public reading, is fragile, and scraping public pages against X's anti-bot measures is a ToS risk. Neither offers a documented curated-query operator language.

---

## Primary sources

- **X API v2 — Recent Search endpoint (endpoints, query operators, 7-day window, 100/req):**
  https://docs.x.com/x-api/posts/search/introduction
- **X API v2 — Search recent Posts reference (endpoint, params, result shape):**
  https://docs.x.com/x-api/posts/search-recent-posts
- **X API rate limits (Recent Search: 450/15 min app, 300/15 min user; 100 max results):**
  https://docs.x.com/x-api/fundamentals/rate-limits
- **X API pricing — pay-per-use, Post read `$0.005/resource`, no subscriptions:**
  https://docs.x.com/x-api/getting-started/pricing
- **X API usage & billing — credit-based, dedup within 24 h UTC day, 2 M Post-read monthly cap:**
  https://docs.x.com/x-api/fundamentals/post-cap
- **X API data access / introduction — pay-per-use model, no free tier documented:**
  https://docs.x.com/x-api/introduction , https://docs.x.com/x-api/fundamentals/developer-portal
- **Official X MCP server (repo, `searchPostsRecent` tool, auth requirements, OpenAPI spec source):**
  https://github.com/xdevplatform/xmcp
- **snscrape (repo + broken-scraper issue #996 — login wall / `blocked (404)`, open since 2023):**
  https://github.com/JustAnotherArchivist/snscrape , https://github.com/JustAnotherArchivist/snscrape/issues/996
- **Nitter (repo — now requires real X accounts + session tokens; guest-account ban killed public instances Jan 2024):**
  https://github.com/zedeus/nitter , https://perennialte.ch/blog/2024/02/14/public-nitter-instance-shutdown/

---

## Decision-ready summary (paste into ticket 01)

> **Use the official X API v2 `GET /2/tweets/search/recent` with an app Bearer Token.**
> It is the only stable, X-owned option that supports curated keyword queries (keywords, phrases, `from:user`, `lang:en`, `-is:retweet`, `has:links`) — exactly what ticket 02's query set needs. It returns the last 7 days, up to 100 Posts/request, no per-user OAuth (app-only OK), rate limit 450 req/15 min.
> **Cost:** the API is now **pay-per-use with no free tier** — `$0.005` per Post read, same-Post dedup per 24 h UTC day. A disciplined daily run of a few hundred distinct posts = a few dollars/month; the closest thing to "~zero budget" that is also reliable and ToS-compliant.
> **Runner-up:** the official X MCP server (`xdevplatform/xmcp`, `searchPostsRecent`) — identical API, cost, and limits; choose it only if the runner is an MCP-native agent (adds a local server + OAuth1 consent).
> **Rejected:** snscrape (broken since 2023 by X's login wall — snscrape issue #996) and Nitter (guest-account ban Jan 2024; now needs real account tokens, fragile) — free but unreliable and against X's terms.
> **Requires from the runner:** a paid X Developer app (Bearer Token) and a small credit balance. "Completely free" is impossible for a stable, query-capable path as of now.
