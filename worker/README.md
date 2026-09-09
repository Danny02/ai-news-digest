# AI News Digest worker setup — run the wizard

Everything below is automated by a wizard. Run it instead of doing this by hand:

```bash
cd worker
./setup.sh
```

It walks you through: Resend domain, Resend API key, SENDER, deploy, and the
`ai-news.nullzwo.dev` custom domain. Segment IDs are public configuration in
`wrangler.toml`; the wizard does not ask for them or store them as secrets. It
writes local values to `.dev.vars` and sets project secrets via
`wrangler pages secret put`.

---

# Cloudflare Worker — AI News Digest mailing list

Landing page under `ai-news.nullzwo.dev` with a daily-or-weekly subscribe
choice, plus double opt-in registration into the matching Resend segment.

## Flow

1. `GET /` — landing page with an email field and a daily-or-weekly choice.
2. `POST /subscribe` — validates the email and cadence, stores a 7-day pending
   token in KV, and emails a confirmation link.
3. `GET /confirm?token=…` — the click handler; adds the contact to the chosen
   segment, removes it from the other segment, then deletes the token.

The two valid cadence values are `daily` (every weekday) and `weekly` (one mail
on Monday covering the week). A missing cadence is treated as `daily`.

Unsubscribe is handled by Resend's hosted page (add
`{{{RESEND_UNSUBSCRIBE_URL}}}` to the daily digest template).

## Sending

`POST /send` broadcasts the day's digest to `DAILY_SEGMENT_ID` and archives it.
It is the only writer of the archive, so there is no separate archive token.

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
twice
(`tok:<token>` contains `{ email, cadence }` and `pend:<email>` contains the
token) precisely so the subscribe dedupe is O(1) rather than a scan of the
namespace. Legacy bare-email token values are treated as `daily` at confirmation.

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

### 2. Audience configuration

The two Resend audience IDs are public `[vars]` in `wrangler.toml`:

```toml
DAILY_SEGMENT_ID = "d95ca2ac-b89d-4939-b1d0-c8745e139b86"
WEEKLY_SEGMENT_ID = "a05fac9d-a5e9-4d70-a1fc-62e200038e71"
```

The daily send uses `DAILY_SEGMENT_ID`. Confirmation adds each contact to
its chosen segment and removes it from the other one. Do not set either ID as a
secret.

### 3. Secrets (Pages project — run from the worker dir)
```bash
wrangler pages secret put RESEND_API_KEY --project-name ai-news-digest        # Resend sending key
wrangler pages secret put SEND_TOKEN --project-name ai-news-digest            # bearer token required by POST /send
```

> the old `RESEND_SEGMENT_ID` secret may only be deleted AFTER the deployment that reads the config value is live. Both may coexist in between; the code path is the same either way.

SENDER is NOT a secret — it's a non-secret `[vars]` entry in `wrangler.toml`
(deployed with the config; fallback `AI News Digest <digest@nullzwo.dev>` in
code). Do not set it as a secret — a Pages secret of the same name would
shadow the var.

### 4. Custom domain
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
`.dev.vars` holds `RESEND_API_KEY` and `SENDER`. `DAILY_SEGMENT_ID` and
`WEEKLY_SEGMENT_ID` are public config values from `[vars]` in `wrangler.toml`;
they are also listed in `.dev.vars.example` for local overrides.

## Deploy
```bash
cd worker
npm run deploy
```

## Audience configuration
The daily and weekly Resend audience IDs are checked into the `[vars]` block in
`wrangler.toml` because they are public identifiers, not credentials. Update
that block when an audience changes; do not move either value into Pages
secrets.
