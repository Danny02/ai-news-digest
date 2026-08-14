/**
 * AI News Digest — mailing list Cloudflare Worker.
 *
 * Routes
 *   GET  /                     landing page
 *   POST /subscribe            validate, store a pending token, email a link
 *   GET  /confirm?token=       register the contact with Resend
 *   POST /send                 broadcast today's digest, archive it (bearer auth)
 *   GET  /archive              302 to the current week
 *   GET  /archive/GGGG-Www     one week of issues
 *   GET  /archive/YYYY-MM-DD   one issue
 *   GET  /bg.jpg               inlined background image
 *
 * Bindings
 *   KV      DIGEST_PENDING   tok:<token> -> email, pend:<email> -> token (TTL'd)
 *   KV      DIGEST_ARCHIVE   issue:<date>, week:<weekKey>, meta:first_week
 *   secret  RESEND_API_KEY, RESEND_SEGMENT_ID, SEND_TOKEN
 *   var     SENDER (optional)
 *
 * No KV `list()` is used anywhere: every lookup is a direct key read. See
 * `pendingKeys` and the week index for why.
 */

import { landingPage, statusPage, notFound, archiveWeekPage, archiveIssuePage } from "./ui.js";
import { buildEmailHtml, buildEmailText } from "./email.js";
import { escapeHtml } from "./md.js";
import { BG_JPEG_B64 } from "./bg.js";
import {
  DATE_RE,
  isValidDate,
  isValidWeekKey,
  weekKeyOf,
  shiftWeek,
  todayUTC,
} from "./week.js";

const TTL_SECONDS = 7 * 24 * 60 * 60; // pending token validity: 7 days
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254; // RFC 5321 address limit; also bounds the KV key
const SEND_RESERVATION_TTL = 300; // seconds a crashed /send can block the day

const ISSUE = "issue:";
const WEEK = "week:";
const FIRST_WEEK = "meta:first_week";

const CACHE_FRESH = 60; // today / this week: a new issue must surface quickly
const CACHE_SETTLED = 86400; // past issues and past weeks no longer change

function json(res, status) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// --- subscribe ---------------------------------------------------------
//
// Two keys per pending subscription, written and expired together:
//
//   tok:<token>   -> email   read by /confirm
//   pend:<email>  -> token   read by /subscribe to dedupe
//
// The reverse key is what makes the dedupe O(1). The previous version listed
// the whole namespace and read every value on every request, which capped out
// at 1000 keys and made an unauthenticated endpoint cost O(subscribers).

const pendingKeys = {
  token: (token) => `tok:${token}`,
  email: (email) => `pend:${email}`,
};

async function handleSubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > EMAIL_MAX) {
    return json({ error: "Enter a valid email address." }, 400);
  }

  // Already on the list: report success without sending anything. The response
  // must not tell the caller whether an address is subscribed.
  if (await isAlreadySubscribed(env, email)) {
    return json({ ok: true, detail: "confirmation_sent" }, 200);
  }

  // A pending token already exists: resend it rather than minting a second one,
  // so the earlier email in the inbox keeps working.
  const existing = await env.DIGEST_PENDING.get(pendingKeys.email(email));
  if (existing) {
    await sendConfirmEmail(env, request, email, existing);
    return json({ ok: true, detail: "confirmation_resent" }, 200);
  }

  const token = randomToken();
  const opts = { expirationTtl: TTL_SECONDS };
  await Promise.all([
    env.DIGEST_PENDING.put(pendingKeys.token(token), email, opts),
    env.DIGEST_PENDING.put(pendingKeys.email(email), token, opts),
  ]);
  await sendConfirmEmail(env, request, email, token);
  return json({ ok: true, detail: "confirmation_sent" }, 200);
}

/**
 * True when the address is an active Resend contact. A 404 (no such contact)
 * or any error means "not subscribed": we fail open and send the confirmation
 * rather than silently dropping a genuine new subscriber.
 */
async function isAlreadySubscribed(env, email) {
  let res;
  try {
    res = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
  } catch (err) {
    console.error("contact check failed", err);
    return false;
  }
  if (res.status === 404) return false;
  if (!res.ok) {
    console.error("contact check non-404", res.status, await res.text().catch(() => ""));
    return false;
  }
  const data = await res.json().catch(() => null);
  return Boolean(data && data.unsubscribed === false);
}

async function handleConfirm(request, env, url) {
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return statusPage({
      kicker: "Incomplete link",
      a: "Half a link.",
      b: "Use the full one.",
      spec: [
        "The confirmation link was cut short, usually by an email client wrapping it.",
        "Open the message again and click the button, or paste the whole URL.",
      ],
      action: { href: "/", label: "Start again" },
      title: "Confirm",
    });
  }

  const email = await env.DIGEST_PENDING.get(pendingKeys.token(token));
  if (!email) {
    return statusPage({
      kicker: "Link expired",
      a: "That link is spent.",
      b: "Nothing was lost.",
      spec: [
        "Confirmation links last 7 days and work once.",
        "Enter your address again and a fresh link arrives in seconds.",
      ],
      action: { href: "/", label: "Subscribe again" },
      title: "Confirm",
    });
  }

  try {
    await registerContact(env, email);
  } catch (err) {
    console.error("register failed", err);
    return statusPage({
      kicker: "Confirmation failed",
      a: "Our side broke.",
      b: "Not your address.",
      spec: [
        "The address could not be registered just now.",
        "Try the link again in a few minutes. It stays valid.",
      ],
      action: { href: "/", label: "Back to start" },
      title: "Confirm",
      status: 500,
    });
  }

  // Both directions go, or the address can never re-subscribe after unsubscribing.
  await Promise.all([
    env.DIGEST_PENDING.delete(pendingKeys.token(token)),
    env.DIGEST_PENDING.delete(pendingKeys.email(email)),
  ]);

  return statusPage({
    kicker: "Subscription confirmed",
    a: "You cleared the bar.",
    b: "First issue tomorrow.",
    receipt: escapeHtml(email),
    chip: "PASS",
    spec: [
      "<b>Daily</b>, one email. Nothing else.",
      "<b>~500 words</b>, five themes, under a minute to scan.",
      "<b>One click</b> in any issue takes you off the list.",
    ],
    title: "Confirmed",
  });
}

// --- send --------------------------------------------------------------

/**
 * Rejects anything buildEmailHtml or the archive index would choke on, so a
 * malformed payload fails with a 400 instead of a half-sent broadcast.
 */
function validateSections(value) {
  if (!Array.isArray(value) || value.length === 0) return "sections must be a non-empty array.";
  for (const [i, s] of value.entries()) {
    if (!s || typeof s !== "object") return `sections[${i}] must be an object.`;
    if (typeof s.title !== "string" || !s.title.trim()) return `sections[${i}].title is required.`;
    if (s.label != null && typeof s.label !== "string") return `sections[${i}].label must be a string.`;
    if (!Array.isArray(s.items) || s.items.length === 0) {
      return `sections[${i}].items must be a non-empty array.`;
    }
    if (s.items.some((it) => typeof it !== "string")) {
      return `sections[${i}].items must contain only strings.`;
    }
  }
  return null;
}

/**
 * Broadcast today's digest and archive it.
 *
 * The issue date is always UTC today — the caller cannot pass one. Backfilling
 * or re-dating an issue would mean sending an email that contradicts the
 * archive, so the only supported operation is "send today's".
 *
 * Re-sending is refused: the archive key doubles as the record that today has
 * been sent. The key is reserved before the broadcast, so a crash between
 * broadcast and archive write cannot turn into a second email. KV is eventually
 * consistent, so this is a guard against retries and double-fires, not a lock
 * against two genuinely simultaneous callers.
 */
async function handleSend(request, env) {
  const expected = `Bearer ${env.SEND_TOKEN || ""}`;
  if (!env.SEND_TOKEN || (request.headers.get("authorization") || "") !== expected) {
    return json({ error: "Unauthorized." }, 401);
  }
  if (!env.RESEND_SEGMENT_ID) {
    return json({ error: "Sending is not configured (no segment)." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if ("date" in body) {
    return json({ error: "date is not accepted; /send always sends today's issue." }, 400);
  }
  const invalid = validateSections(body.sections);
  if (invalid) return json({ error: invalid }, 400);
  const sections = body.sections;

  const date = todayUTC();
  const archive = env.DIGEST_ARCHIVE;
  if (await archive.get(ISSUE + date)) {
    return json({ error: `An issue for ${date} was already sent.`, date }, 409);
  }

  // Reserve the day before sending. The TTL means a worker that dies mid-send
  // blocks the day for five minutes, not forever.
  await archive.put(ISSUE + date, JSON.stringify({ date, status: "sending" }), {
    expirationTtl: SEND_RESERVATION_TTL,
  });

  const subject =
    typeof body.subject === "string" && body.subject.trim()
      ? body.subject.trim()
      : `AI news digest - ${date}`;

  let broadcastId;
  try {
    broadcastId = await sendBroadcast(env, {
      subject,
      html: buildEmailHtml(date, sections),
      text: buildEmailText(date, sections),
    });
  } catch (err) {
    await archive.delete(ISSUE + date); // release the day so a retry can run
    console.error("broadcast failed", err);
    return json({ error: "Resend rejected the broadcast.", detail: String(err.message || err) }, 502);
  }

  await archive.put(ISSUE + date, JSON.stringify({ date, subject, sections }));
  await indexIssue(env, date, sections);

  return json({ ok: true, date, broadcastId }, 200);
}

/**
 * Add the issue to its week's index and record the first week ever published.
 * The week doc is what the archive reads: one get per page, no list, and a
 * cache key that is fixed for the whole week.
 */
async function indexIssue(env, date, sections) {
  const archive = env.DIGEST_ARCHIVE;
  const weekKey = weekKeyOf(date);
  const summary = {
    date,
    lead: sections[0].title.slice(0, 140),
    items: sections.reduce((n, s) => n + s.items.length, 0),
  };

  const week = (await readJson(archive, WEEK + weekKey)) || { week: weekKey, issues: [] };
  week.issues = week.issues.filter((i) => i.date !== date);
  week.issues.push(summary);
  week.issues.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  await archive.put(WEEK + weekKey, JSON.stringify(week));

  const first = await archive.get(FIRST_WEEK);
  if (!first || weekKey < first) await archive.put(FIRST_WEEK, weekKey);
}

async function readJson(kv, key) {
  const raw = await kv.get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- resend ------------------------------------------------------------

/**
 * POST /broadcasts. The body is snake_case: `segment_id` is required and
 * `segmentId` is silently not it — that is an SDK-only spelling, and sending it
 * gets the broadcast rejected. `send: true` creates and sends in one call.
 * Success is 201.
 */
async function sendBroadcast(env, { subject, html, text }) {
  const res = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      segment_id: env.RESEND_SEGMENT_ID,
      from: env.SENDER || "AI News Digest <digest@nullzwo.dev>",
      subject,
      html,
      text,
      send: true,
    }),
  });
  if (!res.ok) throw new Error(`Resend broadcast ${res.status}: ${await res.text()}`);
  const data = await res.json().catch(() => null);
  return data && data.id;
}

async function registerContact(env, email) {
  const res = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, segments: [{ id: env.RESEND_SEGMENT_ID }] }),
  });
  if (!res.ok) throw new Error(`Resend create contact ${res.status}: ${await res.text()}`);
}

async function sendConfirmEmail(env, request, email, token) {
  const link = `${new URL(request.url).origin}/confirm?token=${encodeURIComponent(token)}`;
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  const htmlBody = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;margin:0;padding:0">
<tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="font-family:${sans};font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#7a7a7a;padding-bottom:26px">AI News Digest</td></tr>
<tr><td style="font-family:${sans};font-size:34px;line-height:1.05;letter-spacing:-.035em;font-weight:800;color:#7a7a7a">One click left.<br><span style="color:#ffffff">Then you're on.</span></td></tr>
<tr><td style="font-family:${sans};font-size:15px;line-height:1.55;color:#b8b8b8;padding-top:22px">Confirm this address to start receiving the digest. If you did not ask for it, ignore this email and nothing happens.</td></tr>
<tr><td style="padding-top:30px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#ffffff">
<a href="${link}" style="display:inline-block;padding:15px 28px;font-family:${sans};font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#000000;text-decoration:none">Confirm subscription</a>
</td></tr></table>
</td></tr>
<tr><td style="font-family:${mono};font-size:12px;line-height:1.6;color:#7a7a7a;padding-top:28px">Or paste this into your browser:<br><a href="${link}" style="color:#b8b8b8;word-break:break-all">${link}</a></td></tr>
<tr><td style="border-top:1px solid #1e1e1e;padding-top:20px;margin-top:10px"></td></tr>
<tr><td style="font-family:${mono};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5a5a61">Link valid 7 days &middot; digest@nullzwo.dev</td></tr>
</table></td></tr></table>`;
  const textBody = [
    "AI News Digest",
    "",
    "Confirm this address to start receiving the digest:",
    link,
    "",
    "The link is valid for 7 days and works once.",
    "If you did not ask for this, ignore this email.",
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.SENDER || "AI News Digest <digest@nullzwo.dev>",
      to: [email],
      subject: "Confirm your AI News Digest subscription",
      html: htmlBody,
      text: textBody,
    }),
  });
  if (!res.ok) throw new Error(`Resend send ${res.status}: ${await res.text()}`);
}

// --- archive -----------------------------------------------------------
//
// Issues are stored as the structured JSON from /send, not as rendered HTML,
// so a restyle applies to the whole archive without re-ingesting anything.
//
//   issue:<YYYY-MM-DD>  { date, subject, sections }
//   week:<GGGG-Www>     { week, issues: [{ date, lead, items }] }
//   meta:first_week     the earliest week key ever published
//
// Paging is by ISO week so every archive URL is a fixed cache key: a settled
// week is cached for a day, the current week for a minute. Week-to-week
// navigation is arithmetic, so no page needs to know what else exists.

async function handleArchiveWeek(env, weekKey) {
  const [doc, firstWeek] = await Promise.all([
    readJson(env.DIGEST_ARCHIVE, WEEK + weekKey),
    env.DIGEST_ARCHIVE.get(FIRST_WEEK),
  ]);
  const thisWeek = weekKeyOf(todayUTC());
  if (weekKey > thisWeek) return notFound();

  const prev = shiftWeek(weekKey, -1);
  const next = shiftWeek(weekKey, 1);
  const res = archiveWeekPage({
    weekKey,
    issues: (doc && doc.issues) || [],
    prevWeek: firstWeek && prev >= firstWeek ? prev : null,
    nextWeek: next <= thisWeek ? next : null,
  });
  return withCache(res, weekKey === thisWeek ? CACHE_FRESH : CACHE_SETTLED);
}

async function handleArchiveIssue(env, date) {
  const doc = await readJson(env.DIGEST_ARCHIVE, ISSUE + date);
  // `status: "sending"` is a reservation, not a published issue.
  if (!doc || !Array.isArray(doc.sections) || !doc.sections.length) return notFound();

  const weekKey = weekKeyOf(date);
  const week = await readJson(env.DIGEST_ARCHIVE, WEEK + weekKey);
  const dates = ((week && week.issues) || []).map((i) => i.date); // newest first
  const at = dates.indexOf(date);

  const res = archiveIssuePage({
    date,
    sections: doc.sections,
    weekKey,
    prev: at >= 0 && at < dates.length - 1 ? dates[at + 1] : null,
    next: at > 0 ? dates[at - 1] : null,
  });
  return withCache(res, date === todayUTC() ? CACHE_FRESH : CACHE_SETTLED);
}

function withCache(res, ttl) {
  res.headers.set("cache-control", `public, max-age=${ttl}`);
  return res;
}

/**
 * Read-through edge cache. Only 200s are stored, so a 404 never sticks.
 * Invalidation is by TTL: cache.delete() clears one colo, which would look
 * global while being anything but.
 */
async function cached(request, ctx, render) {
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  if (cache) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  const res = await render();
  if (res.status === 200 && cache && ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(cache.put(request, res.clone()));
  }
  return res;
}

// --- misc --------------------------------------------------------------

let bgBytes = null;

function backgroundImage() {
  if (!bgBytes) {
    const bin = atob(BG_JPEG_B64);
    bgBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bgBytes[i] = bin.charCodeAt(i);
  }
  return new Response(bgBytes, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// --- router ------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const isGet = request.method === "GET";

    if (isGet && (pathname === "/" || pathname === "")) return landingPage();
    if (isGet && pathname === "/bg.jpg") return backgroundImage();
    if (isGet && pathname === "/confirm") return handleConfirm(request, env, url);

    if (request.method === "POST" && pathname === "/subscribe") {
      try {
        return await handleSubscribe(request, env);
      } catch (err) {
        console.error(err);
        return json({ error: "Failed to send confirmation." }, 500);
      }
    }

    if (request.method === "POST" && pathname === "/send") {
      try {
        return await handleSend(request, env);
      } catch (err) {
        console.error(err);
        return json({ error: "Failed to send digest." }, 500);
      }
    }

    if (isGet && (pathname === "/archive" || pathname === "/archive/")) {
      return new Response(null, {
        status: 302,
        headers: {
          location: `/archive/${weekKeyOf(todayUTC())}`,
          "cache-control": "no-store", // never pin a visitor to last week
        },
      });
    }

    if (isGet && pathname.startsWith("/archive/")) {
      // A malformed escape (%zz) makes decodeURIComponent throw. The slug is
      // user-controlled text in a URL, so that must be a 404, not a 500.
      let slug;
      try {
        slug = decodeURIComponent(pathname.slice("/archive/".length));
      } catch {
        return notFound();
      }
      if (isValidWeekKey(slug)) return cached(request, ctx, () => handleArchiveWeek(env, slug));
      if (DATE_RE.test(slug) && isValidDate(slug)) {
        return cached(request, ctx, () => handleArchiveIssue(env, slug));
      }
    }

    return notFound();
  },
};
