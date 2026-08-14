import test from "node:test";
import assert from "node:assert/strict";
import { renderInline, renderPlain, escapeHtml, safeHref, WEB, emailStyle } from "../src/md.js";

const EMAIL = emailStyle({ ink: "#fff", body: "#b8b8b8", mono: "monospace" });

test("escapes HTML before anything else runs", () => {
  assert.equal(escapeHtml(`<script>"x" & 'y'</script>`), "&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;");
  assert.equal(renderInline("<img onerror=x>", WEB), "&lt;img onerror=x&gt;");
});

test("strips the NUL sentinel so input cannot forge a link placeholder", () => {
  const out = renderInline("\u00000\u0000 [real](https://example.com)", WEB);
  assert.ok(!out.includes("\u0000"));
  assert.equal(out, '0 <a href="https://example.com" rel="noopener">real</a>');
});

test("renders links, bold, code and italics", () => {
  assert.equal(
    renderInline("**a** `b` _c_ [d](https://e.com)", WEB),
    '<strong>a</strong> <code>b</code> <em>c</em> <a href="https://e.com" rel="noopener">d</a>'
  );
});

test("underscores inside a URL or handle survive the italic pass", () => {
  const out = renderInline("see [@a_b_c](https://x.com/a_b_c) now", WEB);
  assert.equal(out, 'see <a href="https://x.com/a_b_c" rel="noopener">@a_b_c</a> now');
  assert.ok(!out.includes("<em>"));
});

test("digits around a link are not mistaken for a placeholder", () => {
  const out = renderInline("up 0 percent [x](https://e.com) and 1 more", WEB);
  assert.ok(out.includes("up 0 percent"));
  assert.ok(out.includes("and 1 more"));
  assert.ok(out.includes('href="https://e.com"'));
});

test("only http(s) reaches an href — both renderers, one rule", () => {
  for (const style of [WEB, EMAIL]) {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.com"]) {
      const out = renderInline(`[click](${bad})`, style);
      assert.ok(!out.includes(bad.split(":")[0] + ":"), `${bad} leaked into ${JSON.stringify(out)}`);
      assert.ok(out.includes('href="#"'));
    }
  }
});

test("safeHref passes http and https through, escaped", () => {
  assert.equal(safeHref("https://e.com/?a=1&b=2"), "https://e.com/?a=1&amp;b=2");
  assert.equal(safeHref("HTTP://e.com"), "HTTP://e.com");
  assert.equal(safeHref("ftp://e.com"), "#");
});

test("email styling differs from web styling but escaping does not", () => {
  const md = "**bold** <b>raw</b>";
  assert.ok(renderInline(md, EMAIL).includes("font-weight:700"));
  assert.equal(renderInline(md, WEB).includes("font-weight"), false);
  for (const style of [WEB, EMAIL]) {
    assert.ok(renderInline(md, style).includes("&lt;b&gt;raw&lt;/b&gt;"));
  }
});

test("plain text keeps the URL and drops the markup", () => {
  assert.equal(renderPlain("**a** `b` _c_ [d](https://e.com)"), "a b c d (https://e.com)");
});
