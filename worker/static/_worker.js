/**
 * Cloudflare Pages entrypoint (advanced mode).
 *
 * Pages serves the sibling static files (bg.jpg, favicon.svg, robots.txt)
 * through `env.ASSETS`; this worker handles every other route (landing,
 * subscribe, confirm, send, archive). The handler is the same module the
 * offline tests import — no source rewrite.
 *
 * Deploy from worker/ with:  wrangler pages deploy
 * KV namespaces and vars come from wrangler.toml; secrets via
 * `wrangler pages secret put`.
 */
import worker from "../src/index.js";

export default worker;