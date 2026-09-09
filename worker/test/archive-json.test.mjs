import test from "node:test";
import assert from "node:assert/strict";
import { makeEnv, makeResend, fetchWorker, atDate } from "./harness.mjs";

const TODAY = "2026-08-14"; // Friday, ISO week 2026-W33
const WEEK = "2026-W33";

function setup() {
  const resend = makeResend();
  resend.install();
  return { env: makeEnv(), resend };
}

const get = (env, path) => atDate(TODAY, () => fetchWorker("GET", path, {}, env));

test("the JSON archive returns a week's published issue data", async () => {
  const { env } = setup();
  const issue = {
    date: "2026-08-13",
    subject: "AI news digest - 2026-08-13",
    sections: [
      {
        title: "The important story",
        label: "Models",
        items: ["The first item.", "The second item."],
      },
    ],
  };
  await env.DIGEST_ARCHIVE.put(
    `week:${WEEK}`,
    JSON.stringify({ week: WEEK, issues: [{ date: issue.date, lead: "The important story", items: 2 }] })
  );
  await env.DIGEST_ARCHIVE.put(`issue:${issue.date}`, JSON.stringify(issue));

  const res = await get(env, `/archive/${WEEK}.json`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "public, max-age=60");
  assert.deepEqual(body, { week: WEEK, issues: [issue] });
  assert.equal(env.DIGEST_ARCHIVE.reads, 2, "week and issue are direct key reads");
});

test("an empty JSON archive week is not found", async () => {
  const { env } = setup();
  await env.DIGEST_ARCHIVE.put(`week:2026-W32`, JSON.stringify({ week: "2026-W32", issues: [] }));

  const res = await get(env, "/archive/2026-W32.json");

  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), null);
  assert.deepEqual(await res.json(), { error: "Archive week not found." });
});

test("a malformed JSON archive week is a client error", async () => {
  const { env } = setup();

  const res = await get(env, "/archive/2026-W99.json");

  assert.equal(res.status, 400);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), null);
  assert.deepEqual(await res.json(), { error: "Invalid ISO week." });
  assert.equal(env.DIGEST_ARCHIVE.reads, 0, "malformed identifiers do not read storage");
});
