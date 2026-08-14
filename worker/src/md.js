/**
 * The one inline-markdown rule.
 *
 * Digest items are markdown written from scraped X posts, and they are rendered
 * twice: once into the archive page, once into the email. Both renderings run
 * through `renderInline` so the escaping and the href allowlist cannot drift
 * apart — the only difference between them is the tags they emit.
 *
 * Order matters: escape first, stash links second, emphasis last. An underscore
 * inside a handle or a URL must never be eaten by the italic pass.
 */

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s) {
  // NUL is stripped first: renderInline uses it as its link-placeholder
  // sentinel, so input must not be able to forge one.
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/**
 * Link targets originate from scraped posts, so anything that is not http(s)
 * — javascript:, data:, vbscript: — is neutralised rather than rendered.
 */
export function safeHref(url) {
  const clean = String(url).trim();
  if (!/^https?:\/\//i.test(clean)) return "#";
  return escapeHtml(clean);
}

/** Web styling: classes and CSS do the work, so the tags stay bare. */
export const WEB = {
  a: (href, label) => `<a href="${href}" rel="noopener">${label}</a>`,
  strong: (s) => `<strong>${s}</strong>`,
  code: (s) => `<code>${s}</code>`,
  em: (s) => `<em>${s}</em>`,
};

/** Email styling: inline styles only, since email clients drop stylesheets. */
export function emailStyle({ ink, body, mono }) {
  return {
    a: (href, label) =>
      `<a href="${href}" style="color:${ink}; text-decoration:underline; text-underline-offset:2px;">${label}</a>`,
    strong: (s) => `<strong style="font-weight:700; color:${ink};">${s}</strong>`,
    code: (s) => `<span style="font-family:${mono}; font-size:0.92em; color:${ink};">${s}</span>`,
    em: (s) => `<em style="font-style:italic; color:${body};">${s}</em>`,
  };
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const STRONG_RE = /\*\*(.+?)\*\*/g;
const CODE_RE = /`(.+?)`/g;
const EM_RE = /_(.+?)_/g;

export function renderInline(text, style) {
  let out = escapeHtml(text);

  // Links are stashed behind placeholders that survive the emphasis passes.
  const links = [];
  out = out.replace(LINK_RE, (_m, label, href) => {
    links.push(style.a(safeHref(href), label));
    return `\u0000${links.length - 1}\u0000`;
  });

  out = out.replace(STRONG_RE, (_m, s) => style.strong(s));
  out = out.replace(CODE_RE, (_m, s) => style.code(s));
  out = out.replace(EM_RE, (_m, s) => style.em(s));

  return out.replace(/\u0000(\d+)\u0000/g, (_m, i) => links[Number(i)]);
}

/** Plain-text rendering for the email's text/plain part. */
export function renderPlain(text) {
  return String(text)
    .replace(LINK_RE, "$1 ($2)")
    .replace(STRONG_RE, "$1")
    .replace(CODE_RE, "$1")
    .replace(EM_RE, "$1");
}
