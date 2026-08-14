import test from "node:test";
import assert from "node:assert/strict";
import {
  makeEnv,
  makeResend,
  sendRequest,
  fetchWorker,
  atDate,
  installEdgeCache,
  makeCtx,
  SECTIONS,
} from "./harness.mjs";

const TODAY = "2026-08-14"; // Friday, ISO week 2026-W33

function setup() {
  const resend = makeResend();
  resend.install();
  return { env: makeEnv(), resend };
}

const get = (env, path, ctx) => atDate(TODAY, () => fetchWorker("GET", path, {}, env, ctx));

async function withIssues(env, dates) {
  for (const date of dates) {
    await atDate(date, () => sendRequest(env, { sections: SECTIONS }));
  }
}

test("/archive redirects to the current week and is never cached", async () => {
  const { env } = setup();
  const res = await get(env, "/archive");

  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/archive/2026-W33");
  assert.equal(res.headers.get("cache-control"), "no-store");

  const slash = await get(env, "/archive/");
  assert.equal(slash.status, 302);
});

test("a week page lists that week's issues, newest first", async () => {
  const { env } = setup();
  await withIssues(env, ["2026-08-11", "2026-08-13"]);

  const res = await get(env, "/archive/2026-W33");
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.ok(html.indexOf("2026-08-13") < html.indexOf("2026-08-11"), "newest first");
  assert.ok(html.includes("Qwen 3.8 is coming open-weights"));
  assert.ok(html.includes('href="/archive/2026-08-13"'));
  assert.ok(html.includes("10–16 Aug 2026"));
});

test("an empty week renders instead of 404ing", async () => {
  const { env } = setup();
  const res = await get(env, "/archive/2026-W30");
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes("No issues that week"));
});

test("week navigation stops at the first week and at this week", async () => {
  const { env } = setup();
  await withIssues(env, ["2026-08-03", "2026-08-11"]); // W32 and W33

  const current = await (await get(env, "/archive/2026-W33")).text();
  assert.ok(current.includes('href="/archive/2026-W32"'), "back is offered");
  assert.ok(!current.includes('href="/archive/2026-W34"'), "the future is not linked");

  // W32 is the first week ever published: there is nothing behind it.
  const earliest = await (await get(env, "/archive/2026-W32")).text();
  assert.ok(!earliest.includes('href="/archive/2026-W31"'), "no link before the first issue");
  assert.ok(earliest.includes('href="/archive/2026-W33"'), "forward to a published week");
});

test("a future week is not found", async () => {
  const { env } = setup();
  const res = await get(env, "/archive/2026-W40");
  assert.equal(res.status, 404);
});

test("an issue page renders the stored markdown safely", async () => {
  const { env } = setup();
  await withIssues(env, [TODAY]);

  const res = await get(env, `/archive/${TODAY}`);
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.ok(html.includes("<strong>17GB RAM/VRAM</strong>"));
  assert.ok(html.includes('href="https://x.com/UnslothAI"'));
  assert.ok(html.includes("<code>ASD-STE100</code>"));
  assert.ok(html.includes('href="/archive/2026-W33"'), "links up to its week");
});

test("issue navigation walks the week", async () => {
  const { env } = setup();
  await withIssues(env, ["2026-08-11", "2026-08-12", "2026-08-13"]);

  const html = await (await get(env, "/archive/2026-08-12")).text();
  assert.ok(html.includes('href="/archive/2026-08-11"'), "older");
  assert.ok(html.includes('href="/archive/2026-08-13"'), "newer");

  const oldest = await (await get(env, "/archive/2026-08-11")).text();
  assert.ok(!oldest.includes('href="/archive/2026-08-10"'));
});

test("javascript: links never reach an href in the archive", async () => {
  const { env } = setup();
  await atDate(TODAY, () =>
    sendRequest(env, {
      sections: [{ title: "X", items: ["see [here](javascript:alert(1))"] }],
    })
  );
  const html = await (await get(env, `/archive/${TODAY}`)).text();
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes('href="#"'));
});

test("a reserved but unsent day is not readable as an issue", async () => {
  const { env } = setup();
  await env.DIGEST_ARCHIVE.put(`issue:${TODAY}`, JSON.stringify({ date: TODAY, status: "sending" }), {
    expirationTtl: 300,
  });
  const res = await get(env, `/archive/${TODAY}`);
  assert.equal(res.status, 404);
});

test("unknown, malformed and future slugs are 404", async () => {
  const { env } = setup();
  for (const path of [
    "/archive/2026-01-01", // valid date, no issue
    "/archive/2026-02-30", // not a calendar date
    "/archive/2026-W99", // not an ISO week
    "/archive/nonsense",
    "/archive/../etc",
  ]) {
    const res = await get(env, path);
    assert.equal(res.status, 404, `${path} should 404`);
  }
});

test("a malformed percent-escape in the slug is a 404, not a crash", async () => {
  const { env } = setup();
  for (const path of ["/archive/%zz", "/archive/2026-W%33", "/archive/2026-%zz"]) {
    const res = await get(env, path);
    assert.equal(res.status, 404, `${path} must not throw`);
  }
});

test("only GET is served", async () => {
  const { env } = setup();
  for (const method of ["PUT", "DELETE", "POST"]) {
    const res = await atDate(TODAY, () => fetchWorker(method, `/archive/${TODAY}`, {}, env));
    assert.equal(res.status, 404, `${method} must not be routed`);
  }
});

test("settled pages cache for a day, live pages for a minute", async () => {
  const { env } = setup();
  await withIssues(env, ["2026-08-11", TODAY]);

  const thisWeek = await get(env, "/archive/2026-W33");
  assert.equal(thisWeek.headers.get("cache-control"), "public, max-age=60");

  const pastWeek = await get(env, "/archive/2026-W32");
  assert.equal(pastWeek.headers.get("cache-control"), "public, max-age=86400");

  const today = await get(env, `/archive/${TODAY}`);
  assert.equal(today.headers.get("cache-control"), "public, max-age=60");

  const older = await get(env, "/archive/2026-08-11");
  assert.equal(older.headers.get("cache-control"), "public, max-age=86400");
});

test("a 404 is never stored in the edge cache", async () => {
  const cache = installEdgeCache();
  try {
    const { env } = setup();
    const ctx = makeCtx();
    await get(env, "/archive/2026-01-01", ctx);
    await ctx.settled();
    assert.equal(cache.store.size, 0);
  } finally {
    cache.uninstall();
  }
});

test("a cached week page is served without touching KV again", async () => {
  const cache = installEdgeCache();
  try {
    const { env } = setup();
    await withIssues(env, [TODAY]);

    const ctx = makeCtx();
    const first = await get(env, "/archive/2026-W33", ctx);
    await ctx.settled();
    assert.equal(first.status, 200);
    assert.equal(cache.store.size, 1, "one fixed cache key per week");

    env.DIGEST_ARCHIVE.reads = 0;
    const second = await get(env, "/archive/2026-W33", makeCtx());
    assert.equal(second.status, 200);
    assert.equal(env.DIGEST_ARCHIVE.reads, 0, "served from the edge");
    assert.ok((await second.text()).includes("2026-08-14"));
  } finally {
    cache.uninstall();
  }
});

test("the landing page and 404 page still render", async () => {
  const { env } = setup();
  const home = await get(env, "/");
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(html.includes("Most AI news is noise"));
  assert.ok(html.includes('action="/subscribe"'));

  const missing = await get(env, "/nope");
  assert.equal(missing.status, 404);
});
