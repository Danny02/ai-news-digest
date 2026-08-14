/**
 * Test doubles for the worker's three dependencies: KV, the Resend API, and
 * the edge cache. The worker module is imported directly — no source rewriting
 * — so what the tests exercise is what wrangler deploys.
 *
 * The fakes are deliberately strict:
 *  - KV `list()` throws, because the worker must never list a namespace.
 *  - The Resend fake validates request bodies against the published OpenAPI
 *    shapes, so an SDK-only spelling like `segmentId` fails the suite instead
 *    of failing in production.
 */

import worker from "../src/index.js";

export const SEND_TOKEN = "s3cr3t-token";
export const SEGMENT_ID = "seg-1";
export const ORIGIN = "https://ai-news.nullzwo.dev";

export function makeKv() {
  const store = new Map();
  const now = () => Date.now();
  const live = (k) => {
    const e = store.get(k);
    if (!e) return null;
    if (e.expires != null && e.expires <= now()) {
      store.delete(k);
      return null;
    }
    return e;
  };
  return {
    store,
    reads: 0,
    async put(key, value, opts = {}) {
      if (typeof key !== "string" || !key.length) throw new TypeError("KV key must be a string");
      if (key.length > 512) throw new RangeError("KV key too long");
      if (opts.expirationTtl != null && opts.expirationTtl < 60) {
        throw new RangeError("KV expirationTtl must be >= 60");
      }
      store.set(key, {
        value: String(value),
        expires: opts.expirationTtl != null ? now() + opts.expirationTtl * 1000 : null,
      });
    },
    async get(key) {
      this.reads++;
      const e = live(key);
      return e ? e.value : null;
    },
    async delete(key) {
      store.delete(key);
    },
    async list() {
      throw new Error("KV list() is banned: every archive and pending lookup must be a direct get");
    },
    /** Force a key to look expired, without waiting for wall-clock time. */
    expire(key) {
      const e = store.get(key);
      if (e) e.expires = now() - 1;
    },
  };
}

/**
 * Minimal Resend stand-in. Every handler asserts the request shape the real API
 * documents; anything else throws, which surfaces as a failing test.
 */
export function makeResend() {
  const state = { emails: [], contacts: new Map(), broadcasts: [], fail: null };

  const ok = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  async function handle(url, opts) {
    const method = (opts.method || "GET").toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : null;

    if (!/^Bearer .+/.test(opts.headers?.authorization || "")) {
      return ok({ message: "Missing API key" }, 401);
    }

    if (url === "https://api.resend.com/emails" && method === "POST") {
      if (!body.from || !Array.isArray(body.to) || !body.subject) {
        throw new Error("POST /emails: from, to[] and subject are required");
      }
      state.emails.push(body);
      return ok({ id: `email-${state.emails.length}` });
    }

    if (url === "https://api.resend.com/broadcasts" && method === "POST") {
      // The API is snake_case. `segmentId` is the Node SDK spelling and is a
      // 422 against the REST endpoint — this assertion is the regression guard.
      if ("segmentId" in body || "audienceId" in body) {
        throw new Error("POST /broadcasts: body must be snake_case (segment_id), got camelCase");
      }
      for (const required of ["segment_id", "from", "subject"]) {
        if (!body[required]) throw new Error(`POST /broadcasts: ${required} is required`);
      }
      if (state.fail === "broadcast") return ok({ message: "Segment not found" }, 422);
      state.broadcasts.push(body);
      return ok({ id: `broadcast-${state.broadcasts.length}`, object: "broadcast" }, 201);
    }

    if (url === "https://api.resend.com/contacts" && method === "POST") {
      if (!body.email) throw new Error("POST /contacts: email is required");
      if (body.segments && !Array.isArray(body.segments)) {
        throw new Error("POST /contacts: segments must be an array of { id }");
      }
      if (state.fail === "contact") return ok({ message: "Rate limited" }, 429);
      state.contacts.set(body.email, { unsubscribed: false });
      return ok({ id: "contact-1", object: "contact" }, 201);
    }

    const contactGet = /^https:\/\/api\.resend\.com\/contacts\/(.+)$/.exec(url);
    if (contactGet && method === "GET") {
      const email = decodeURIComponent(contactGet[1]);
      const found = state.contacts.get(email);
      if (!found) return ok({ message: "Contact not found", name: "not_found" }, 404);
      return ok({ object: "contact", id: "c1", email, unsubscribed: found.unsubscribed });
    }

    throw new Error(`unexpected Resend call: ${method} ${url}`);
  }

  return {
    state,
    install() {
      globalThis.fetch = (input, opts = {}) => handle(String(input), opts);
    },
    /** Pretend the address is an existing active contact. */
    seedContact(email, unsubscribed = false) {
      state.contacts.set(email, { unsubscribed });
    },
  };
}

/** An edge cache that behaves like caches.default, for the cache tests. */
export function installEdgeCache() {
  const store = new Map();
  const key = (req) => new Request(req).url;
  globalThis.caches = {
    default: {
      async match(req) {
        const hit = store.get(key(req));
        return hit ? hit.clone() : undefined;
      },
      async put(req, res) {
        store.set(key(req), res.clone());
      },
    },
  };
  return { store, uninstall: () => delete globalThis.caches };
}

export function makeCtx() {
  const pending = [];
  return {
    waitUntil: (p) => pending.push(p),
    settled: () => Promise.all(pending),
  };
}

export function makeEnv(overrides = {}) {
  return {
    DIGEST_PENDING: makeKv(),
    DIGEST_ARCHIVE: makeKv(),
    RESEND_API_KEY: "re_test",
    RESEND_SEGMENT_ID: SEGMENT_ID,
    SEND_TOKEN,
    SENDER: "Test <digest@nullzwo.dev>",
    ...overrides,
  };
}

/** Freeze UTC "today" for the duration of `fn`. */
export async function atDate(isoDate, fn) {
  const real = Date.now;
  Date.now = () => Date.parse(`${isoDate}T06:00:00Z`);
  try {
    return await fn();
  } finally {
    Date.now = real;
  }
}

export function request(method, path, { body, headers = {}, json = true } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (json && typeof body !== "string") init.headers["content-type"] = "application/json";
  }
  return new Request(ORIGIN + path, init);
}

export function fetchWorker(method, path, opts = {}, env, ctx = makeCtx()) {
  return worker.fetch(request(method, path, opts), env, ctx);
}

/** Send with the right bearer token. */
export function sendRequest(env, body, token = SEND_TOKEN) {
  return fetchWorker("POST", "/send", { body, headers: { authorization: `Bearer ${token}` } }, env);
}

export const SECTIONS = [
  {
    title: "Qwen 3.8 is coming open-weights",
    label: "Models",
    items: [
      "Qwen3.8-27B runs on **17GB RAM/VRAM** per [@UnslothAI](https://x.com/UnslothAI), a real option for the 24GB class.",
      "Use `ASD-STE100` to kill the slop.",
    ],
  },
  {
    title: "Harness engineering is the theme",
    label: "Orchestration",
    items: ["A paper frames the harness as the determinant of reliability."],
  },
];
