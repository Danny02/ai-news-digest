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
