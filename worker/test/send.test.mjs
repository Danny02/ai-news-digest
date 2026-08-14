import test from "node:test";
import assert from "node:assert/strict";
import {
  makeEnv,
  makeResend,
  sendRequest,
  fetchWorker,
  atDate,
  SECTIONS,
  SEGMENT_ID,
} from "./harness.mjs";

const TODAY = "2026-08-14";

function setup(envOverrides) {
  const resend = makeResend();
  resend.install();
  return { env: makeEnv(envOverrides), resend };
}

const send = (env, body) => atDate(TODAY, () => sendRequest(env, body));

test("requires the bearer token", async () => {
  const { env, resend } = setup();

  const none = await atDate(TODAY, () => fetchWorker("POST", "/send", { body: { sections: SECTIONS } }, env));
  assert.equal(none.status, 401);

  const wrong = await atDate(TODAY, () => sendRequest(env, { sections: SECTIONS }, "not-the-token"));
  assert.equal(wrong.status, 401);
  assert.equal(resend.state.broadcasts.length, 0);
});

test("refuses to send when no send token is configured", async () => {
  const { env } = setup({ SEND_TOKEN: "" });
  const res = await atDate(TODAY, () => sendRequest(env, { sections: SECTIONS }, ""));
  assert.equal(res.status, 401);
});

test("refuses to send when no segment is configured", async () => {
  const { env } = setup({ RESEND_SEGMENT_ID: "" });
  const res = await send(env, { sections: SECTIONS });
  assert.equal(res.status, 500);
});

test("rejects a caller-supplied date outright", async () => {
  const { env, resend } = setup();
  const res = await send(env, { date: "2026/01/01", sections: SECTIONS });

  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /date is not accepted/);
  assert.equal(resend.state.broadcasts.length, 0);
});

test("rejects malformed sections before anything is sent", async () => {
  const { env, resend } = setup();
  const bad = [
    {},
    { sections: [] },
    { sections: "no" },
    { sections: [{ title: "", items: ["x"] }] },
    { sections: [{ title: "t" }] },
    { sections: [{ title: "t", items: [] }] },
    { sections: [{ title: "t", items: [{ nope: 1 }] }] },
    { sections: [{ title: "t", items: ["x"], label: 7 }] },
  ];
  for (const body of bad) {
    const res = await send(env, body);
    assert.equal(res.status, 400, `should reject ${JSON.stringify(body)}`);
  }
  assert.equal(resend.state.broadcasts.length, 0);
});

test("sends a snake_case broadcast to the configured segment", async () => {
  const { env, resend } = setup();
  const res = await send(env, { sections: SECTIONS });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.date, TODAY);
  assert.equal(body.broadcastId, "broadcast-1");

  const sent = resend.state.broadcasts[0];
  assert.equal(sent.segment_id, SEGMENT_ID);
  assert.equal(sent.send, true);
  assert.ok(!("segmentId" in sent), "camelCase is an SDK spelling the REST API rejects");
  assert.equal(sent.subject, `AI news digest - ${TODAY}`);
  assert.equal(sent.from, "Test <digest@nullzwo.dev>");
});

test("an explicit subject wins over the default", async () => {
  const { env, resend } = setup();
  await send(env, { sections: SECTIONS, subject: "  Qwen goes open  " });
  assert.equal(resend.state.broadcasts[0].subject, "Qwen goes open");
});

test("the broadcast carries both parts and an unsubscribe link", async () => {
  const { env, resend } = setup();
  await send(env, { sections: SECTIONS });
  const { html, text } = resend.state.broadcasts[0];

  assert.ok(html.includes("<strong style=\"font-weight:700"), "markdown is rendered");
  assert.ok(html.includes('href="https://x.com/UnslothAI"'));
  assert.ok(html.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"));
  assert.ok(text.includes("QWEN 3.8 IS COMING OPEN-WEIGHTS"));
  assert.ok(text.includes("(https://x.com/UnslothAI)"));
  assert.ok(!text.includes("**"), "text part carries no markdown");
});

test("the issue and its week index are archived under today's UTC date", async () => {
  const { env } = setup();
  await send(env, { sections: SECTIONS });

  const issue = JSON.parse(await env.DIGEST_ARCHIVE.get(`issue:${TODAY}`));
  assert.equal(issue.date, TODAY);
  assert.deepEqual(issue.sections, SECTIONS);

  const week = JSON.parse(await env.DIGEST_ARCHIVE.get("week:2026-W33"));
  assert.deepEqual(week.issues, [
    { date: TODAY, lead: "Qwen 3.8 is coming open-weights", items: 3 },
  ]);
  assert.equal(await env.DIGEST_ARCHIVE.get("meta:first_week"), "2026-W33");
});

test("a second send on the same day is refused", async () => {
  const { env, resend } = setup();
  assert.equal((await send(env, { sections: SECTIONS })).status, 200);

  const again = await send(env, { sections: SECTIONS });
  assert.equal(again.status, 409);
  assert.match((await again.json()).error, /already sent/);
  assert.equal(resend.state.broadcasts.length, 1, "no subscriber gets two emails");
});

test("the next day sends again and joins the same week", async () => {
  const { env, resend } = setup();
  await atDate("2026-08-14", () => sendRequest(env, { sections: SECTIONS }));
  await atDate("2026-08-15", () => sendRequest(env, { sections: SECTIONS }));

  assert.equal(resend.state.broadcasts.length, 2);
  const week = JSON.parse(await env.DIGEST_ARCHIVE.get("week:2026-W33"));
  assert.deepEqual(week.issues.map((i) => i.date), ["2026-08-15", "2026-08-14"], "newest first");
});

test("a week boundary starts a new index without disturbing the first-week marker", async () => {
  const { env } = setup();
  await atDate("2026-08-14", () => sendRequest(env, { sections: SECTIONS }));
  await atDate("2026-08-17", () => sendRequest(env, { sections: SECTIONS }));

  assert.ok(await env.DIGEST_ARCHIVE.get("week:2026-W33"));
  assert.ok(await env.DIGEST_ARCHIVE.get("week:2026-W34"));
  assert.equal(await env.DIGEST_ARCHIVE.get("meta:first_week"), "2026-W33");
});

test("a rejected broadcast releases the day so a retry can run", async () => {
  const { env, resend } = setup();
  resend.state.fail = "broadcast";

  const failed = await send(env, { sections: SECTIONS });
  assert.equal(failed.status, 502);
  assert.equal(await env.DIGEST_ARCHIVE.get(`issue:${TODAY}`), null, "reservation released");

  resend.state.fail = null;
  const retry = await send(env, { sections: SECTIONS });
  assert.equal(retry.status, 200);
  assert.equal(resend.state.broadcasts.length, 1);
});

test("the day is reserved before the broadcast, so a crash cannot double-send", async () => {
  const { env } = setup();
  const real = globalThis.fetch;
  let reservedAtSendTime = null;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("/broadcasts")) {
      reservedAtSendTime = await env.DIGEST_ARCHIVE.get(`issue:${TODAY}`);
    }
    return real(url, opts);
  };

  await send(env, { sections: SECTIONS });
  assert.ok(reservedAtSendTime, "issue key exists while the broadcast is in flight");
  assert.equal(JSON.parse(reservedAtSendTime).status, "sending");
});
