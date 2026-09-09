# AI News Digest

A daily digest of AI news from X: fetch, curate, summarise, then email it to
subscribers and keep a weekly archive on the web.

**[View the live site](https://ai-news.nullzwo.dev)** &middot; **[Source on GitHub](https://github.com/Danny02/ai-news-digest)**

![AI News Digest landing page](screenshot.png)

## How it works

1. **Fetch** — `scripts/phase1_discovery.py` pulls recent posts from a curated
   set of AI accounts (via Desearch), `phase2_followup.py` digs into the
   promising ones, `merge_candidates.py` combines the results.
2. **Curate** — an agent selects topics, filters signal from noise, and writes
   the digest as markdown (`drafts/digest-<date>.md`), guided by `prompts/` and
   `skills/ai-news-digest/`.
3. **Send** — `scripts/send_via_api.py` POSTs the draft to the worker, which
   broadcasts it to the subscriber segment (Resend) and stores it in the
   archive. Today's issue can be sent once; a repeat send is rejected.
4. **Read** — the site at the worker's origin shows the landing page, a
   subscription flow (double opt-in), and a weekly archive page.

### Weekly edition

The weekly run sends one Monday edition for the previous completed ISO week. It
reads the published `GET /archive/<GGGG-Www>.json` response. It does not fetch
new posts or run research. An agent condenses the archived issues by subject,
deduplicates stories into their final state, and keeps at most five topics with
at most four bullets each. The full ranking and writing rules live in
[`prompts/weekly-condense.md`](prompts/weekly-condense.md).

The weekly cron prompt is [`prompts/weekly-loop-cron.md`](prompts/weekly-loop-cron.md).
Its run has three per-week savepoints in
`runs/state-<GGGG-Www>.json`: `fetch`, `condense`, and `send`. The fetched input
is kept in `runs/weekly-<GGGG-Www>.json`; the reviewable draft is
`drafts/weekly-<GGGG-Www>.md`. The `weekly-` filename is separate from the
daily sender's `drafts/digest-*.md` glob.

The model writes the draft, then `scripts/send_weekly_via_api.py` posts it with
`cadence: weekly`. The worker derives the week and refuses a duplicate send;
a `409` is recorded as a successful savepoint. A missing or empty archive week
is logged and exits without a draft or send. The daily pipeline and its
`drafts/digest-<date>.md` behavior are unchanged.

## Layout

```
worker/    Cloudflare Pages site + function (subscription, send, archive)
scripts/   Python fetch/merge pipeline and the send client
prompts/   Agent instructions for topic selection, filtering, summarising
skills/    The ai-news-digest skill (daily loop instructions)
drafts/    Markdown digest drafts (output, not source)
runs/      Intermediate pipeline JSON (output, not source)
```

## Worker

See [`worker/README.md`](worker/README.md) for the API contract, KV layout,
bindings, and the Pages deployment setup.

Run the worker tests (offline, no deps):

```sh
cd worker
npm test
```

## Secrets

Secrets live in Cloudflare (`wrangler pages secret put`) and in a git-ignored
local `.env`; nothing secret is committed. `worker/.dev.vars.example` lists the
names. Public config — the GoatCounter site code and the site domain — is set
as plain vars in `worker/wrangler.toml`.

## License

MIT
