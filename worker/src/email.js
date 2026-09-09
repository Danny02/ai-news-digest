/**
 * The daily digest email. Table-based and inline-styled, because email clients
 * drop stylesheets and modern layout. Item markdown is rendered by the shared
 * rule in md.js, so the archive and the email can never disagree about what a
 * link or a bold span means.
 */

import { escapeHtml, renderInline, renderPlain, emailStyle } from "./md.js";

const INK = "#ffffff";
const BODY = "#b8b8b8";
const MUTED = "#7a7a7a";
const RULE = "#1e1e1e";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const STYLE = emailStyle({ ink: INK, body: BODY, mono: MONO });

// Resend expands this into a per-contact one-click unsubscribe link.
const UNSUBSCRIBE = "{{{RESEND_UNSUBSCRIBE_URL}}}";

const COPY = {
  daily: {
    first: "Most AI news is noise.",
    second: "Here is the rest.",
    intro: "From public X posts, held to one bar: could this change how you work?",
  },
  weekly: {
    first: "A week of AI news, distilled.",
    second: "Here is what mattered.",
    intro: "From the week's daily issues, held to one bar: could this change how you work?",
  },
};

function copyFor(cadence) {
  return COPY[cadence] || COPY.daily;
}

function item(md) {
  return (
    '<tr><td style="padding:8px 0;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    `<td width="2" style="width:2px; background-color:${INK}; font-size:0; line-height:0;">&nbsp;</td>` +
    '<td width="16" style="width:16px; font-size:0; line-height:0;">&nbsp;</td>' +
    `<td><div style="font-size:15px; line-height:23px; color:${BODY};">${renderInline(md, STYLE)}</div></td>` +
    "</tr></table></td></tr>"
  );
}

function theme(section) {
  const chip =
    `<span style="font-family:${MONO}; color:${MUTED}; font-size:11px; letter-spacing:0.18em; ` +
    `text-transform:uppercase;">${escapeHtml(section.label || "Digest").toUpperCase()}</span>`;
  const title =
    `<div style="font-size:19px; line-height:26px; font-weight:800; letter-spacing:-0.025em; ` +
    `color:${INK};">${escapeHtml(section.title)}</div>`;
  return (
    '<tr><td style="padding:0 6px;">' +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${RULE};">` +
    '<tr><td style="padding:26px 0 30px 0;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    `<tr><td style="padding:0 0 9px 0;">${chip}</td></tr>` +
    `<tr><td style="padding:0 0 14px 0;">${title}</td></tr>` +
    '<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    section.items.map(item).join("") +
    "</table></td></tr>" +
    "</table></td></tr></table></td></tr>"
  );
}

export function buildEmailHtml(date, sections, cadence = "daily") {
  const copy = copyFor(cadence);
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    '<meta name="color-scheme" content="dark" /><title>AI News Digest</title></head>' +
    `<body style="margin:0; padding:0; background-color:#000000; font-family:${SANS}; color:${BODY};">` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">' +
    '<tr><td align="center" style="padding:36px 14px 56px 14px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%;">' +
    '<tr><td style="padding:0 6px 8px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    '<tr><td align="left" style="vertical-align:middle;"><span style="font-size:11px; font-weight:700; letter-spacing:0.2em; ' +
    'text-transform:uppercase; color:#ffffff;">AI&nbsp;News&nbsp;Digest</span></td>' +
    `<td align="right" style="vertical-align:middle;"><span style="font-family:${MONO}; font-size:12px; ` +
    `letter-spacing:0.1em; color:${MUTED};">${escapeHtml(date)}</span></td></tr>` +
    `<tr><td colspan="2" style="padding-top:30px;"><div style="font-family:${SANS}; font-size:34px; line-height:1.02; ` +
    `font-weight:800; letter-spacing:-0.04em; color:${MUTED};">${escapeHtml(copy.first)}<br/>` +
    `<span style="color:#ffffff;">${escapeHtml(copy.second)}</span></div></td></tr>` +
    `<tr><td colspan="2" style="padding-top:18px; padding-bottom:4px;"><div style="font-size:14px; line-height:21px; ` +
    `color:${MUTED}; padding-right:24px;">${escapeHtml(copy.intro)}</div></td></tr>` +
    "</table></td></tr>" +
    sections.map(theme).join("") +
    '<tr><td style="padding:30px 6px 0 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    `<tr><td><div style="border-top:1px solid ${RULE}; padding-top:18px;"><span style="font-family:${MONO}; font-size:11px; ` +
    `line-height:18px; color:#5a5a61; letter-spacing:0.12em; text-transform:uppercase;">Unsubscribe: ${UNSUBSCRIBE}</span>` +
    "</div></td></tr></table></td></tr>" +
    "</table></td></tr></table></body></html>"
  );
}

export function buildEmailText(date, sections, cadence = "daily") {
  const copy = copyFor(cadence);
  const lines = ["AI News Digest", date, "", `${copy.first} ${copy.second}`, ""];
  for (const section of sections) {
    lines.push("", section.title.toUpperCase());
    for (const md of section.items) lines.push("  \u2022 " + renderPlain(md));
  }
  lines.push("", `Unsubscribe: ${UNSUBSCRIBE}`);
  return lines.join("\n");
}
