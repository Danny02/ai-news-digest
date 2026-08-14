# 09 — Top up Desearch balance and verify live

Status: resolved
Type: task
Blocked by:

## Question

Fund the Desearch account and confirm the search actually returns usable posts.

Ticket 01 verified the key, endpoint, and auth format, but every call returns
HTTP 402:

```
{"error":"Insufficient balance","required_cents":0.045,"current_balance_cents":0}
```

Nothing downstream can be exercised end-to-end until this clears.

Steps (HITL — the reader must do the payment):

1. Reader adds credit to the Desearch account at desearch.ai. Any minimum
   top-up lasts a very long time at `$0.00045`/request (~14 cents/month).
2. Reader rotates the API key if the one pasted in chat is production-sensitive,
   and stores the live key as `DESEARCH_API_KEY` in an env var or their secret
   manager — never in this repo.
3. Agent re-runs one live query and records the real response shape: field
   names for post text, author, URL, timestamp, and engagement counts, plus
   how many posts one request returns and how paging works.
4. Agent confirms whether Desearch passes through X engagement operators
   (`min_faves:`, `min_retweets:`) — ticket 02 depends on this for its
   "is it actually talked about" filter.

The answer records the verified response shape and the per-request post yield,
which together set the real monthly cost.

## Answer

**Balance topped up by the reader; the API is live and fully verified.**

### Request

```
GET https://api.desearch.ai/twitter?query=<q>&count=<n>
Authorization: <key>        # plain, NOT "Bearer"
accept: application/json
```

### Response shape

A **bare JSON array** of post objects (no envelope, no cursor field observed).
Per post:

- `id`, `text`, `url`, `created_at` (e.g. `Fri Jul 31 06:56:41 +0000 2026`),
  `lang`, `conversation_id`
- Engagement: `like_count`, `reply_count`, `retweet_count`, `quote_count`,
  `view_count`, `bookmark_count`
- Flags: `is_retweet`, `is_quote_tweet`
- `media[]`, `entities{}`
- `user{}` embedded free — `username`, `name`, `followers_count`,
  `is_blue_verified`, `description`, profile URLs. **No second request needed
  for author data.**

### Verified behaviour

- `count=10` → 10 posts. `count=30` → 30 posts. `count=50` timed out (>60 s);
  latency grows with count, so **keep `count` at or below 30**.
- **`min_faves:` passes through and filters correctly.** Query
  `AI agent min_faves:5000` returned 10 posts, all with `like_count` ≥ 5000.
  This is the lever ticket 02 needs for the "is it actually talked about" test.
- **`since:` passes through and filters correctly.** Query with
  `since:2026-08-02` returned only posts created on or after that date — this
  gives the daily freshness window.
- Results are relevance/engagement-ordered, not strictly chronological.

### Real cost

`$0.00045` per request, and one request yields up to 30 posts. A digest of
~5 queries/day is ~150 requests/month ≈ **7 cents/month**. Cost is per request,
not per post, so raising `count` is free — prefer fewer, larger requests.

### Security

The key pasted in chat should be rotated. Store the live key as
`DESEARCH_API_KEY` in an env var or the reader's secret manager; never commit
it to this repo.
