import test from "node:test";
import assert from "node:assert/strict";
import {
  makeEnv,
  makeResend,
  sendRequest,
  fetchWorker,
  atDate,
  SECTIONS,
  DAILY_SEGMENT_ID,
  WEEKLY_SEGMENT_ID,
} from "./harness.mjs";

const TODAY = "2026-08-14";

function setup(envOverrides) {
  const resend = makeResend();
  resend.install();
  return { env: makeEnv(envOverrides), resend };
}

const send = (env, body) => atDate(TODAY, () => sendRequest(env, body));

async function seedWeek(env, week, date) {
  await env.DIGEST_ARCHIVE.put(
    `week:${week}`,
    JSON.stringify({ week, issues: [{ date, lead: "An archived issue", items: 1 }] })
  );
}

const weeklySend = (env, body) => atDate(TODAY, () => sendRequest(env, { cadence: "weekly", ...body }));

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
  const { env } = setup({ DAILY_SEGMENT_ID: "" });
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

test("rejects an unsupported cadence before anything is sent", async () => {
  const { env, resend } = setup();
  const res = await send(env, { cadence: "monthly", sections: SECTIONS });

  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /cadence must be daily or weekly/);
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
  assert.equal(sent.segment_id, DAILY_SEGMENT_ID);
  assert.equal(sent.send, true);
  assert.ok(!("segmentId" in sent), "camelCase is an SDK spelling the REST API rejects");
  assert.equal(sent.subject, `AI news digest - ${TODAY}`);
  assert.equal(sent.from, "Test <digest@nullzwo.dev>");
});

test("an explicit daily cadence keeps the daily audience", async () => {
  const { env, resend } = setup();
  await send(env, { cadence: "daily", sections: SECTIONS });
  assert.equal(resend.state.broadcasts[0].segment_id, DAILY_SEGMENT_ID);
});

test("an explicit subject wins over the default", async () => {
  const { env, resend } = setup();
  await send(env, { sections: SECTIONS, subject: "  Qwen goes open  " });
  assert.equal(resend.state.broadcasts[0].subject, "Qwen goes open");
});

test("weekly sends derive the previous completed ISO week", async () => {
  const { env, resend } = setup();
  await seedWeek(env, "2026-W32", "2026-08-13");
  await seedWeek(env, "2026-W53", "2026-12-31");

  const friday = await atDate("2026-08-14", () =>
    sendRequest(env, { cadence: "weekly", sections: SECTIONS })
  );
  assert.equal(friday.status, 200);
  assert.equal((await friday.json()).week, "2026-W32");
  assert.equal(resend.state.broadcasts[0].subject, "AI news digest - 2026-W32");

  const monday = await atDate("2027-01-04", () =>
    sendRequest(env, { cadence: "weekly", sections: SECTIONS })
  );
  assert.equal(monday.status, 200);
  assert.equal((await monday.json()).week, "2026-W53");
  assert.equal(resend.state.broadcasts[1].subject, "AI news digest - 2026-W53");
  assert.deepEqual(JSON.parse(await env.DIGEST_ARCHIVE.get("weekly:2026-W53")), {
    week: "2026-W53",
    subject: "AI news digest - 2026-W53",
    sections: SECTIONS,
  });
});

test("weekly sends use the weekly audience and weekly email copy", async () => {
  const { env, resend } = setup();
  await seedWeek(env, "2026-W32", "2026-08-13");

  await weeklySend(env, { sections: SECTIONS });

  const sent = resend.state.broadcasts[0];
  assert.equal(sent.segment_id, WEEKLY_SEGMENT_ID);
  assert.ok(sent.html.includes("2026-W32"));
  assert.ok(sent.html.includes("A week of AI news, distilled."));
  assert.ok(sent.html.includes("From the week&#39;s daily issues"));
  assert.ok(!sent.html.includes("Most AI news is noise."));
  assert.ok(sent.text.includes("A week of AI news, distilled. Here is what mattered."));
});

test("a supplied weekly subject wins over its ISO-week default", async () => {
  const { env, resend } = setup();
  await seedWeek(env, "2026-W32", "2026-08-13");

  await weeklySend(env, { sections: SECTIONS, subject: "  The week in AI  " });

  assert.equal(resend.state.broadcasts[0].subject, "The week in AI");
  assert.equal(JSON.parse(await env.DIGEST_ARCHIVE.get("weekly:2026-W32")).subject, "The week in AI");
});

test("weekly sends reject caller-supplied date and week", async () => {
  const { env, resend } = setup();
  await seedWeek(env, "2026-W32", "2026-08-13");

  for (const [field, value, error] of [
    ["date", "2026-08-14", /date is not accepted/],
    ["week", "2026-W32", /week is not accepted/],
  ]) {
    const res = await weeklySend(env, { [field]: value, sections: SECTIONS });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, error);
  }
  assert.equal(resend.state.broadcasts.length, 0);
  assert.equal(env.DIGEST_ARCHIVE.store.size, 1, "the seeded daily index is the only archive write");
});

test("a second weekly send conflicts without calling the mail provider twice", async () => {
  const { env, resend } = setup();
  await seedWeek(env, "2026-W32", "2026-08-13");

  assert.equal((await weeklySend(env, { sections: SECTIONS })).status, 200);
  const again = await weeklySend(env, { sections: SECTIONS });

  assert.equal(again.status, 409);
  assert.deepEqual(await again.json(), {
    error: "A weekly issue for 2026-W32 was already sent.",
    week: "2026-W32",
  });
  assert.equal(resend.state.broadcasts.length, 1, "mail provider was not called twice");
});

test("an empty weekly source skips mail and the weekly archive write", async () => {
  const { env, resend } = setup();

  const res = await weeklySend(env, { sections: SECTIONS });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, week: "2026-W32", skipped: true });
  assert.equal(resend.state.broadcasts.length, 0);
  assert.equal(env.DIGEST_ARCHIVE.store.size, 0, "empty weeks do not write an archive entry");
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
