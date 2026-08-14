import test from "node:test";
import assert from "node:assert/strict";
import { makeEnv, fetchWorker, makeCtx } from "./harness.mjs";

test("landing page carries the GoatCounter script from GC_SITE", async () => {
  const env = makeEnv({ GC_SITE: "ai-news" });
  const res = await fetchWorker("GET", "/", {}, env, makeCtx());
  const html = await res.text();
  assert.match(html, /data-goatcounter="https:\/\/ai-news\.goatcounter\.com\/count"/);
});

test("landing page omits the GoatCounter script when GC_SITE is unset", async () => {
  const env = makeEnv({ GC_SITE: undefined });
  const res = await fetchWorker("GET", "/", {}, env, makeCtx());
  const html = await res.text();
  assert.doesNotMatch(html, /goatcounter/i);
});

test("landing page links the GitHub repo in the footer", async () => {
  const env = makeEnv();
  const res = await fetchWorker("GET", "/", {}, env, makeCtx());
  const html = await res.text();
  assert.match(html, /github\.com\/Danny02\/ai-news-digest/);
  assert.match(html, /aria-label="Source on GitHub"/);
});

test("canonical link uses SITE_DOMAIN and the current path", async () => {
  const env = makeEnv({ SITE_DOMAIN: "news.example.com" });
  const res = await fetchWorker("GET", "/archive/2026-08-14", {}, env, makeCtx());
  const html = await res.text();
  assert.match(html, /rel="canonical" href="https:\/\/news\.example\.com\/archive\/2026-08-14"/);
});

test("confirm page places the canonical on its path", async () => {
  const env = makeEnv({ SITE_DOMAIN: "news.example.com" });
  const res = await fetchWorker("GET", "/confirm?token=nope", {}, env, makeCtx());
  const html = await res.text();
  // pathname only, not the query string
  assert.match(html, /rel="canonical" href="https:\/\/news\.example\.com\/confirm"/);
});

test("pages serve a favicon link", async () => {
  const res = await fetchWorker("GET", "/", {}, makeEnv(), makeCtx());
  const html = await res.text();
  assert.match(html, /rel="icon" href="\/favicon\.svg"/);
});

test("/bg.jpg serves from env.ASSETS first when Pages provides it", async () => {
  const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const env = makeEnv({
    ASSETS: {
      fetch: async () =>
        new Response(fake, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
    },
  });
  const res = await fetchWorker("GET", "/bg.jpg", {}, env, makeCtx());
  assert.equal(res.status, 200);
  const body = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(body), Array.from(fake));
});

test("/bg.jpg falls back to the embedded texture when there is no ASSETS", async () => {
  const env = makeEnv();
  const res = await fetchWorker("GET", "/bg.jpg", {}, env, makeCtx());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/jpeg");
  const body = new Uint8Array(await res.arrayBuffer());
  assert.ok(body.length > 10_000, `expected a real JPEG, got ${body.length} bytes`);
  assert.equal(body[0], 0xff);
  assert.equal(body[1], 0xd8);
});