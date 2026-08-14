# AI News Digest worker setup — run the wizard

Everything below is automated by a wizard. Run it instead of doing this by hand:

```bash
cd worker
./setup.sh
```

It walks you through: Resend domain, Resend API key, Resend segment, SENDER,
deploy, and the `ai-news.nullzwo.dev` custom domain. It writes local values to
`.dev.vars` and sets worker secrets via `wrangler secret put`.

---

# Cloudflare Worker — AI News Digest mailing list

Landing page under `ai-news.nullzwo.dev` with a single subscribe input, plus
double opt-in registration into a Resend mailing list.

## Flow

1. `GET /` — landing page, one email field.
2. `POST /subscribe` — validates the email, stores a 7-day pending token in KV,
   emails a confirmation link.
3. `GET /confirm?token=…` — the click handler; calls Resend to register the
   email as a contact in the segment (mailing list), then deletes the token.

Unsubscribe is handled by Resend's hosted page (add
`{{{RESEND_UNSUBSCRIBE_URL}}}` to the daily digest template).

## Sending

`POST /send` broadcasts the day's digest to the segment and archives it. It is
the only writer of the archive, so there is no separate archive token.

```bash
curl -X POST https://ai-news.nullzwo.dev/send \
  -H "authorization: Bearer $SEND_TOKEN" \
  -H "content-type: application/json" \
  -d '{"subject":"optional","sections":[{"title":"…","label":"Models","items":["markdown"]}]}'
```

- **No `date` field.** The issue is always dated UTC today; passing `date` is a
  400. Backfilling would mean emailing something the archive contradicts.
- **One issue per day.** The archive key is reserved before the broadcast, so a
  retry or a double-fire gets `409` instead of mailing the list twice. KV is
  eventually consistent, so this stops retries, not two simultaneous callers.
- A Resend rejection returns `502` and releases the day for a retry.

## Archive

Issues live in `DIGEST_ARCHIVE` as the **structured JSON** `/send` received, not
as rendered HTML, so restyling the site updates every past issue without
re-publishing anything.

```
issue:<YYYY-MM-DD>   { date, subject, sections }
week:<GGGG-Www>      { week, issues: [{ date, lead, items }] }   # ISO week
meta:first_week      earliest week key ever published
```

The archive is paged by ISO week so every URL is a **fixed cache key**: a past
week is cached for a day, the current week for a minute. Week-to-week and
issue-to-issue navigation is computed arithmetically from the week key, so no
page needs to know what else exists.

| Route | Purpose |
|---|---|
| `GET /archive` | 302 to the current week (`no-store`) |
| `GET /archive/<GGGG-Www>` | one week of issues, newest first |
| `GET /archive/<YYYY-MM-DD>` | one issue |

**There is no `list()` call in the worker.** Every lookup — pending tokens,
week pages, issues — is a direct key read. Pending subscriptions are stored
twice (`tok:<token>` and `pend:<email>`) precisely so the subscribe dedupe is
O(1) rather than a scan of the namespace.

## Tests

```bash
cd worker
npm test          # node --test, no dependencies
```

The suite imports `src/index.js` directly and fakes KV, Resend and the edge
cache. The fakes are strict on purpose: KV `list()` throws, and the Resend
double rejects SDK-only camelCase (`segmentId`) because the REST API requires
`segment_id`.

## One-time setup

### 1. KV namespaces
```bash
cd worker
wrangler kv namespace create DIGEST_PENDING
wrangler kv namespace create DIGEST_ARCHIVE
```
Paste each returned `id` into the matching `[[kv_namespaces]]` block in
`wrangler.toml`.

For `wrangler dev`, also create a preview namespace:
```bash
wrangler kv namespace create --preview DIGEST_PENDING
```
Paste that `preview_id` into `wrangler.toml`.

### 2. Secrets
```bash
wrangler secret put RESEND_API_KEY        # Resend sending key
wrangler secret put RESEND_SEGMENT_ID     # Resend list/segment ID (from Resend dashboard)
wrangler secret put SEND_TOKEN            # bearer token required by POST /send
```

Also set `SENDER` (optional, defaults to `AI News Digest <digest@nullzwo.dev>`):
```bash
wrangler secret put SENDER
```

### 3. Custom domain
`ai-news.nullzwo.dev` is declarative in `wrangler.toml` (`routes` with
`custom_domain = true`), so every `wrangler deploy` attaches it automatically.
Requires the `nullzwo.dev` zone to be active in the same Cloudflare account.

> Note: the proxy env vars on this machine (`http_proxy`/`all_proxy` on
> localhost) make `wrangler` fetch fail sometimes; retry, or unset `all_proxy`
> for the command. DNS for a fresh custom domain can take a few minutes to
> propagate — `dig @1.1.1.1 ai-news.nullzwo.dev` to check.

## Local dev
```bash
cd worker
cp .dev.vars.example .dev.vars   # fill in real values (NOT committed)
npm run dev                      # wrangler dev
```
`.dev.vars` holds `RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `SENDER`.

## Deploy
```bash
cd worker
npm run deploy
```

## Getting the Resend list/segment ID
In the Resend dashboard, Audiences/Segments → create or open your segment →
its ID is in the URL or the segment detail. Sending to the whole list is then
a Resend Broadcast to that segment (the daily digest loop switches from the
two hardcoded addresses to a Broadcast on that segment).
