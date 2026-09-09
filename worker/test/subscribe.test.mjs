import test from "node:test";
import assert from "node:assert/strict";
import { makeEnv, makeResend, fetchWorker, DAILY_SEGMENT_ID } from "./harness.mjs";

function setup() {
  const resend = makeResend();
  resend.install();
  return { env: makeEnv(), resend };
}

const post = (env, body) => fetchWorker("POST", "/subscribe", { body }, env);

async function subscribe(env, email) {
  const res = await post(env, { email });
  return { res, body: await res.json() };
}

function tokenFrom(resend) {
  const link = /\/confirm\?token=([a-f0-9]+)/.exec(JSON.stringify(resend.state.emails.at(-1)));
  return link && link[1];
}

test("rejects malformed and oversized addresses without touching Resend", async () => {
  const { env, resend } = setup();
  for (const email of ["", "nope", "a@b", "a b@c.de", 42, null, "x".repeat(250) + "@e.com"]) {
    const res = await post(env, { email });
    assert.equal(res.status, 400, `${email} should be rejected`);
  }
  assert.equal(resend.state.emails.length, 0);
});

test("rejects a non-JSON body", async () => {
  const { env } = setup();
  const res = await fetchWorker("POST", "/subscribe", { body: "email=x@y.com" }, env);
  assert.equal(res.status, 400);
});

test("a new address gets one confirmation email and two KV keys", async () => {
  const { env, resend } = setup();
  const { res, body } = await subscribe(env, "reader@example.com");

  assert.equal(res.status, 200);
  assert.deepEqual(body, { ok: true, detail: "confirmation_sent" });
  assert.equal(resend.state.emails.length, 1);
  assert.deepEqual(resend.state.emails[0].to, ["reader@example.com"]);

  const token = tokenFrom(resend);
  assert.ok(token, "confirmation email carries a token link");
  assert.equal(await env.DIGEST_PENDING.get(`tok:${token}`), "reader@example.com");
  assert.equal(await env.DIGEST_PENDING.get("pend:reader@example.com"), token);
});

test("the address is normalised before it is stored", async () => {
  const { env } = setup();
  await subscribe(env, "  Reader@Example.COM  ");
  assert.equal(await env.DIGEST_PENDING.get("pend:reader@example.com"), await pendToken(env));
});

async function pendToken(env) {
  return env.DIGEST_PENDING.get("pend:reader@example.com");
}

test("dedupe is O(1): a resend costs a fixed number of KV reads", async () => {
  const { env, resend } = setup();
  await subscribe(env, "reader@example.com");

  // Fill the namespace: a list-based implementation would now read every key.
  for (let i = 0; i < 200; i++) {
    await env.DIGEST_PENDING.put(`tok:filler${i}`, `filler${i}@example.com`, {
      expirationTtl: 3600,
    });
  }

  env.DIGEST_PENDING.reads = 0;
  const { body } = await subscribe(env, "reader@example.com");

  assert.equal(body.detail, "confirmation_resent");
  assert.ok(env.DIGEST_PENDING.reads <= 2, `expected O(1) reads, got ${env.DIGEST_PENDING.reads}`);
  assert.equal(resend.state.emails.length, 2, "the same token is emailed again");
  assert.equal(tokenFrom(resend), await pendToken(env), "no second token is minted");
});

test("an expired pending token lets a fresh one be minted", async () => {
  const { env, resend } = setup();
  await subscribe(env, "reader@example.com");
  const first = tokenFrom(resend);

  env.DIGEST_PENDING.expire("pend:reader@example.com");
  env.DIGEST_PENDING.expire(`tok:${first}`);

  await subscribe(env, "reader@example.com");
  assert.notEqual(tokenFrom(resend), first);
});

test("an existing active contact gets silence, not a second email", async () => {
  const { env, resend } = setup();
  resend.seedContact("reader@example.com");

  const { res, body } = await subscribe(env, "reader@example.com");

  assert.equal(res.status, 200);
  assert.deepEqual(body, { ok: true, detail: "confirmation_sent" }, "response must not leak membership");
  assert.equal(resend.state.emails.length, 0);
});

test("an unsubscribed contact can subscribe again", async () => {
  const { env, resend } = setup();
  resend.seedContact("reader@example.com", true);
  await subscribe(env, "reader@example.com");
  assert.equal(resend.state.emails.length, 1);
});

test("a Resend outage during the contact check fails open", async () => {
  const { env, resend } = setup();
  const real = globalThis.fetch;
  let first = true;
  globalThis.fetch = (url, opts) => {
    if (first && String(url).includes("/contacts/")) {
      first = false;
      return Promise.reject(new Error("network down"));
    }
    return real(url, opts);
  };
  const { res } = await subscribe(env, "reader@example.com");
  assert.equal(res.status, 200);
  assert.equal(resend.state.emails.length, 1, "a genuine subscriber is never dropped");
});

// --- confirm ---

async function confirmed(env, resend, email = "reader@example.com") {
  await subscribe(env, email);
  const token = tokenFrom(resend);
  const res = await fetchWorker("GET", `/confirm?token=${token}`, {}, env);
  return { token, res, html: await res.text() };
}

test("confirming registers the contact in the segment and clears both keys", async () => {
  const { env, resend } = setup();
  const { token, res, html } = await confirmed(env, resend);

  assert.equal(res.status, 200);
  assert.ok(html.includes("Subscription confirmed"));
  assert.ok(html.includes("reader@example.com"));
  assert.deepEqual(resend.state.contacts.get("reader@example.com"), { unsubscribed: false });

  assert.equal(await env.DIGEST_PENDING.get(`tok:${token}`), null);
  assert.equal(await env.DIGEST_PENDING.get("pend:reader@example.com"), null, "reverse key must go too");
});

test("the contact is created against the configured segment", async () => {
  const { env, resend } = setup();
  const real = globalThis.fetch;
  let created;
  globalThis.fetch = (url, opts) => {
    if (String(url) === "https://api.resend.com/contacts" && opts.method === "POST") {
      created = JSON.parse(opts.body);
    }
    return real(url, opts);
  };
  await confirmed(env, resend);
  assert.deepEqual(created.segments, [{ id: DAILY_SEGMENT_ID }]);
});

test("a token works once", async () => {
  const { env, resend } = setup();
  const { token } = await confirmed(env, resend);
  const again = await fetchWorker("GET", `/confirm?token=${token}`, {}, env);
  assert.ok((await again.text()).includes("spent"));
});

test("an unknown or missing token is a friendly page, not an error", async () => {
  const { env } = setup();
  const unknown = await fetchWorker("GET", "/confirm?token=deadbeef", {}, env);
  assert.equal(unknown.status, 200);
  assert.ok((await unknown.text()).includes("spent"));

  const missing = await fetchWorker("GET", "/confirm", {}, env);
  assert.ok((await missing.text()).includes("Half a link"));
});

test("a failed registration keeps the token usable", async () => {
  const { env, resend } = setup();
  await subscribe(env, "reader@example.com");
  const token = tokenFrom(resend);

  resend.state.fail = "contact";
  const res = await fetchWorker("GET", `/confirm?token=${token}`, {}, env);
  assert.equal(res.status, 500);
  assert.equal(await env.DIGEST_PENDING.get(`tok:${token}`), "reader@example.com", "token survives");

  resend.state.fail = null;
  const retry = await fetchWorker("GET", `/confirm?token=${token}`, {}, env);
  assert.ok((await retry.text()).includes("Subscription confirmed"));
});
