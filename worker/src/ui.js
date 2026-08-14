/**
 * Every page the site serves. One shell, one stylesheet, one status-page
 * layout for all terminal states (confirmed, expired, failed, 404).
 *
 * Nothing here touches KV or Resend: handlers pass in plain data, so a page
 * can be rendered and asserted on in a test without any bindings.
 */

import { escapeHtml, renderInline, WEB } from "./md.js";
import { weekLabel } from "./week.js";

// Public footer link to the source. Not a secret.
const GITHUB_REPO = "https://github.com/Danny02/ai-news-digest";
// GitHub octocat mark (simple-icons, CC0), inlined so no external asset loads.
const GITHUB_MARK =
  `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12Z" /></svg>`;

/** The mailbox part of a Sender header like "Name <a@b.c>", or the raw string. */
function siteAddr(sender) {
  if (typeof sender !== "string") return "";
  const m = sender.match(/<([^<>]+)>/);
  return m ? m[1] : sender;
}

/**
 * Site-level config that varies by deployment. `site` is threaded in by the
 * router from env so pages never touch a secret:
 *  - gcSite:  GoatCounter site code ("ai-news")  -> the count script URL
 *  - domain:  SITE_DOMAIN ("ai-news.nullzwo.dev")
 *  - path:    current pathname, for the canonical URL
 *  - sender:  SENDER, used for the footer contact address
 */
function shell(main, title, status = 200, extraScript = "", bodyClass = "", site = {}) {
  const gc = site.gcSite
    ? `<script data-goatcounter="https://${site.gcSite}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`
    : "";
  const canon = site.domain
    ? `<link rel="canonical" href="https://${site.domain}${site.path || ""}">`
    : "";
  const addr = siteAddr(site.sender) || "digest@nullzwo.dev";
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="color-scheme" content="dark light">` +
      `<title>${title}</title>` +
      `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` +
      `<style>${css()}</style>` +
      `${canon}${gc}` + `</head><body${bodyClass ? ` class="${bodyClass}"` : ""}>` +
      `<div class="plate" aria-hidden="true"></div>` +
      `<div class="grain" aria-hidden="true"></div>` +
      `<div class="gl gl1" aria-hidden="true"></div>` +
      `<div class="gl gl2" aria-hidden="true"></div>` +
      `<div class="gl gl3" aria-hidden="true"></div>` +
      `<div class="stream" aria-hidden="true"><div class="streamIn"><div class="track" id="track"></div></div></div>` +
      `<div class="crt" aria-hidden="true"></div>` +
      `<div class="bar"><a class="mark" href="/"><b>AI News Digest</b></a>` +
      `<span><a href="/archive">Archive</a> &middot; Sent daily</span></div>` +
      `<main>${main}</main>` +
      `<footer><span>${addr}</span><span>No sponsors</span>` +
      `<span>No tracking pixels</span>` +
      `<a class="gh" href="${GITHUB_REPO}" target="_blank" rel="noopener" aria-label="Source on GitHub">${GITHUB_MARK}</a>` +
      `<button id="inv" type="button">Invert</button></footer>` +
      `<script>${baseScript()}${extraScript}</script>` +
      `</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function css() {
  return `
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#000;--ink:#fff;--dim:#7a7a7a;--faint:#3a3a3a;--hair:#1e1e1e;
--noise:#333;--pass:#8f8f8f;--veil:rgba(0,0,0,.58);--scan:rgba(255,255,255,.03);
--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
--mono:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace}
html.light{--bg:#fff;--ink:#000;--dim:#6b6b6b;--faint:#c4c4c4;--hair:#e6e6e6;
--noise:#d2d2d2;--pass:#7d7d7d;--veil:rgba(255,255,255,.7);--scan:rgba(0,0,0,.035)}
html,body{height:100%}
html{-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--ink);font:400 16px/1.6 var(--sans);
overflow-x:hidden;display:flex;flex-direction:column;min-height:100svh}

.grain,.gl{position:fixed;inset:64px 0 58px;z-index:1;pointer-events:none;
background:url(/bg.jpg) center/cover no-repeat;filter:brightness(1.9) contrast(1.1);
-webkit-mask-image:radial-gradient(66% 82% at 30% 50%,transparent 0 32%,#000 86%);
mask-image:radial-gradient(66% 82% at 30% 50%,transparent 0 32%,#000 86%)}
.grain{opacity:.34;animation:flick 4.3s steps(1) infinite}
html.light .grain,html.light .gl{filter:brightness(1.9) contrast(1.1) invert(1)}
html.light .grain{opacity:.26}
.gl{opacity:0}
.gl1{clip-path:inset(8% 0 79% 0);animation:tear1 5.7s steps(1) infinite}
.gl2{clip-path:inset(58% 0 26% 0);animation:tear2 8.3s steps(1) infinite}
.gl3{clip-path:inset(86% 0 4% 0);animation:tear1 11.1s steps(1) infinite}
@keyframes tear1{0%,89%{opacity:0;transform:none}
90%{opacity:.42;transform:translate3d(-22px,0,0)}
92%{opacity:.42;transform:translate3d(14px,0,0)}
94%{opacity:0;transform:none}}
@keyframes tear2{0%,71%{opacity:0;transform:none}
72%{opacity:.38;transform:translate3d(17px,0,0)}
73.5%{opacity:.38;transform:translate3d(-9px,0,0)}
75%{opacity:0;transform:none}}
@keyframes flick{0%,96%{opacity:.34}97%{opacity:.26}98%{opacity:.4}99%{opacity:.3}}

.crt{position:fixed;inset:0;z-index:3;pointer-events:none;background:
linear-gradient(180deg,transparent,var(--scan) 42%,var(--scan) 58%,transparent) 0 0/100% 260px no-repeat,
repeating-linear-gradient(180deg,var(--scan) 0 1px,transparent 1px 3px);
animation:roll-bar 6.6s linear infinite}
@keyframes roll-bar{from{background-position:0 -280px,0 0}to{background-position:0 110vh,0 0}}

.stream{position:fixed;top:64px;bottom:58px;right:0;width:min(44vw,560px);z-index:1;pointer-events:none;
-webkit-mask-image:linear-gradient(180deg,transparent,#000 12%,#000 80%,transparent);
mask-image:linear-gradient(180deg,transparent,#000 12%,#000 80%,transparent)}
.streamIn{position:absolute;inset:0;overflow:hidden;
-webkit-mask-image:linear-gradient(90deg,transparent,#000 30%);
mask-image:linear-gradient(90deg,transparent,#000 30%)}
.track{position:absolute;inset:0 0 auto;animation:roll 34s linear infinite;will-change:transform}
.ln{display:flex;gap:16px;align-items:baseline;padding:6px 40px 6px 22px;white-space:nowrap;
font:400 13px/1.4 var(--mono);color:var(--noise)}
.ln .h{flex:0 0 104px;overflow:hidden;text-overflow:ellipsis}
.ln .t{flex:1;overflow:hidden;text-overflow:ellipsis;text-decoration:line-through;
text-decoration-thickness:1px;text-decoration-color:currentColor}
.ln .v{flex:0 0 auto;font-size:10px;letter-spacing:.18em;opacity:.55}
.ln.pass{color:var(--pass)}
.ln.pass .h,.ln.pass .v{opacity:.85}
.ln.pass .t{position:relative;text-decoration:none}
.ln.pass .t::before{content:"";position:absolute;left:-11px;top:-1px;bottom:-1px;width:2px;
background:var(--pass)}
@keyframes roll{to{transform:translate3d(0,-50%,0)}}
.plate{position:fixed;inset:0;z-index:1;pointer-events:none;background:
radial-gradient(56% 72% at 27% 54%,var(--bg) 0 34%,transparent 78%),
linear-gradient(var(--veil),var(--veil))}

.bar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;
gap:16px;padding:26px 40px;font:600 11px/1 var(--sans);letter-spacing:.2em;text-transform:uppercase}
.bar b{display:inline-flex;align-items:center;gap:10px;font-weight:600}
.bar b::before{content:"";width:7px;height:7px;background:var(--ink);
animation:blink 3.4s steps(1) infinite}
@keyframes blink{50%{opacity:.15}}
.bar span{color:var(--dim)}
.bar a{color:inherit;text-decoration:none}
.bar span a{color:var(--dim);border-bottom:1px solid var(--faint);padding-bottom:2px}
.bar span a:hover{color:var(--ink);border-color:var(--ink)}
.bar .mark:hover b{opacity:.7}

/* Read mode: the archive is for reading, so the atmosphere steps back and the
   column is top-aligned instead of centred. */
body.doc main{align-items:flex-start;padding-top:56px}
body.doc .stream{display:none}
body.doc .grain{opacity:.2;
-webkit-mask-image:linear-gradient(90deg,#000,transparent 22%,transparent 78%,#000);
mask-image:linear-gradient(90deg,#000,transparent 22%,transparent 78%,#000)}
body.doc .gl{display:none}
body.doc .plate{background:linear-gradient(var(--veil),var(--veil))}
.doc{width:100%;max-width:760px;margin:0 auto}
.doc h1{font-size:clamp(34px,4.6vw,60px)}
.doc .lead{margin-top:26px}

.rows{margin:46px 0 0;border-top:1px solid var(--hair)}
.rowhead,.row{display:grid;grid-template-columns:120px 1fr 56px;gap:20px;align-items:baseline;
padding:15px 0;border-bottom:1px solid var(--hair)}
.rowhead{font:400 10.5px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.row{text-decoration:none;color:var(--dim);transition:color .14s}
.row:hover{color:var(--ink)}
.row .d{font:400 13px/1.5 var(--mono);white-space:nowrap}
.row .t{font:600 16px/1.45 var(--sans);color:var(--ink);letter-spacing:-.01em}
.row .n{font:400 13px/1.5 var(--mono);text-align:right}
.empty{padding:24px 0;border-bottom:1px solid var(--hair);color:var(--dim);font:400 15px var(--mono)}

.issue{margin:44px 0 0;border-top:1px solid var(--hair)}
.theme{padding:30px 0 34px;border-bottom:1px solid var(--hair)}
.theme .chip{font:400 11px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.theme h2{margin:12px 0 18px;font:800 clamp(21px,2.4vw,26px)/1.3 var(--sans);
letter-spacing:-.025em;color:var(--ink)}
.theme ul{list-style:none;display:grid;gap:14px}
.theme li{position:relative;padding-left:18px;font-size:16px;line-height:1.6;color:var(--dim)}
.theme li::before{content:"";position:absolute;left:0;top:.55em;width:2px;
height:calc(100% - .9em);min-height:14px;background:var(--ink)}
.theme strong{color:var(--ink);font-weight:600}
.theme em{font-style:italic}
.theme code{font-family:var(--mono);font-size:.9em;color:var(--ink)}
.theme a{color:var(--ink);text-decoration:underline;text-underline-offset:2px}
.pager{display:flex;justify-content:space-between;gap:16px;padding:26px 0 0;
font:400 12.5px/1 var(--mono);letter-spacing:.06em}
.pager a{color:var(--dim);text-decoration:none;border-bottom:1px solid var(--faint);padding-bottom:3px}
.pager a:hover{color:var(--ink);border-color:var(--ink)}
@media(max-width:600px){
.rowhead,.row{grid-template-columns:96px 1fr;gap:4px 14px}
.rowhead .n,.row .n{display:none}
.pager{font-size:11.5px}}

main{position:relative;z-index:2;flex:1;display:flex;align-items:center;padding:24px 40px 40px}
.hero{width:100%;max-width:min(58vw,840px);margin-left:clamp(0px,5vw,110px)}
.kicker{display:block;margin-bottom:22px;font:600 11px/1 var(--sans);letter-spacing:.2em;
text-transform:uppercase;color:var(--dim)}
h1{font:800 clamp(44px,7.2vw,104px)/.94 var(--sans);letter-spacing:-.055em;text-wrap:balance}
h1 .a{display:block;color:var(--dim)}
h1 .b{display:block;color:var(--ink)}
.lead{margin:32px 0 0;max-width:46ch;font-size:clamp(16px,1.5vw,19px);line-height:1.55;color:var(--dim)}
.lead b{color:var(--ink);font-weight:600}

form{margin:40px 0 0;display:flex;align-items:stretch;gap:14px;max-width:520px}
.field{flex:1;min-width:0;display:flex;align-items:center;border-bottom:1.5px solid var(--faint);
transition:border-color .2s}
.field:focus-within{border-color:var(--ink)}
input{width:100%;padding:12px 2px;border:0;background:transparent;color:var(--ink);
font:400 17px/1.2 var(--sans)}
input::placeholder{color:var(--faint)}
input:focus{outline:0}
button[type=submit]{flex:0 0 auto;padding:14px 26px;border:1.5px solid var(--ink);cursor:pointer;
background:var(--ink);color:var(--bg);font:700 13px/1 var(--sans);letter-spacing:.14em;
text-transform:uppercase;transition:background .16s,color .16s}
button[type=submit]:hover{background:transparent;color:var(--ink)}
.meta{margin:20px 0 0;font:400 13px/1.6 var(--mono);color:var(--dim);
display:flex;flex-wrap:wrap;gap:4px 20px}
.msg{margin:10px 0 0;font:400 13px var(--mono);min-height:20px;color:var(--ink)}
.msg.ok::before,.msg.err::before{content:"\\2192 ";white-space:pre}

.receipt{margin:34px 0 0;display:inline-flex;align-items:center;gap:14px;
border:1.5px solid var(--faint);padding:12px 16px;font:400 15px/1 var(--mono);
color:var(--ink);max-width:100%;overflow:hidden}
.receipt span{overflow:hidden;text-overflow:ellipsis}
.receipt .chip{flex:0 0 auto;border:1.5px solid var(--ink);padding:5px 9px;
font:700 11px/1 var(--mono);letter-spacing:.18em}
.spec{margin:30px 0 0;display:grid;gap:10px;max-width:52ch;
font:400 13.5px/1.6 var(--mono);color:var(--dim)}
.spec b{color:var(--ink);font-weight:400}
.action{display:inline-block;margin:32px 0 0;padding:14px 26px;border:1.5px solid var(--ink);
background:var(--ink);color:var(--bg);text-decoration:none;font:700 13px/1 var(--sans);
letter-spacing:.14em;text-transform:uppercase;transition:background .16s,color .16s}
.action:hover{background:transparent;color:var(--ink)}

footer{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:6px 24px;padding:22px 40px;
border-top:1px solid var(--hair);font:400 11px/1 var(--mono);letter-spacing:.14em;
text-transform:uppercase;color:var(--dim)}
footer button{all:unset;cursor:pointer;letter-spacing:.14em;color:var(--dim)}
footer button:hover{color:var(--ink)}

@media(max-width:1024px){.stream{width:min(52vw,460px)}
.hero{max-width:min(66vw,720px);margin-left:0}}
@media(max-width:760px){
.stream{left:0;width:auto;z-index:0}
.streamIn{-webkit-mask-image:none;mask-image:none}
.hero{max-width:none;margin-left:0}
.ln{padding:6px 20px;font-size:11.5px}
.ln .h{flex:0 0 96px}
.bar{padding:20px}
main{padding:16px 20px 32px}
footer{padding:18px 20px}
h1{letter-spacing:-.04em}
form{flex-direction:column;gap:20px;align-items:stretch}
button[type=submit],.action{width:100%;text-align:center}
.plate{background:radial-gradient(112% 60% at 50% 52%,var(--bg) 0 40%,transparent 88%),
linear-gradient(var(--veil),var(--veil))}}
@media(prefers-reduced-motion:reduce){
.track,.bar b::before,.grain,.gl,.crt{animation:none}
.gl{display:none}}
`;
}

// Sample intake shown as the ambient background stream. Static on purpose:
// it illustrates the bar, it is not a live feed.
const STREAM = [
  ["@Alibaba_Qwen", "Qwen3.8-Max goes open-weights next week - 2.4T params", 1],
  ["@thread", "10 prompts that will change your life (a thread)", 0],
  ["@vc_takes", "AI will be a $10T market by 2030", 0],
  ["@UnslothAI", "Qwen3.8-27B runs local on 17GB RAM/VRAM", 1],
  ["@aihype", "AGI is 6 months away, and here is why", 0],
  ["@enterprise", "We are excited to announce our new AI partnership", 0],
  ["@promptguru", "The ONLY prompt template you will ever need", 0],
  ["@dexhorthy", "Tell Opus to write in ASD-STE100 to kill the slop", 1],
  ["@newsbot", "AI startup raises $40M Series B", 0],
  ["@influencer", "Nobody is talking about this AI tool", 0],
  ["@webinar", "Join our AI transformation webinar on Thursday", 0],
  ["@mattpocockuk", "/zoom-out skill forces a summary when it rambles", 1],
  ["@memes", "when the model hallucinates and you ship it anyway", 0],
  ["@survey", "78% of executives say AI is a top priority", 0],
  ["@launch", "Introducing our AI-powered analytics dashboard", 0],
  ["@paper", "Harness engineering determines agent reliability", 1],
  ["@clickbait", "This changes EVERYTHING for developers", 0],
  ["@rebrand", "Same product, now with AI", 0],
  ["@repost", "Great thread by @someone - must read", 0],
  ["@alex_prompter", "Agent memory: four flat markdown files, zero DBs", 1],
  ["@growth", "How we 10x'd our output with AI (a thread)", 0],
  ["@NateSilver538", "Models get more stubborn as context fills - compact earlier", 1],
  ["@adtech", "AI-generated creative that converts", 0],
  ["@listicle", "7 AI tools you are not using yet", 0],
];

function baseScript() {
  const rows = STREAM.map(
    ([h, t, p]) =>
      `<div class="ln${p ? " pass" : ""}"><span class="h">${escapeHtml(h)}</span>` +
      `<span class="t">${escapeHtml(t)}</span><span class="v">${p ? "PASS" : "CULL"}</span></div>`
  ).join("");
  return (
    `var B=${JSON.stringify(rows)};document.getElementById('track').innerHTML=B+B;` +
    `var H=document.documentElement;` +
    `try{if(localStorage.getItem('mode')==='light')H.classList.add('light')}catch(e){}` +
    `document.getElementById('inv').addEventListener('click',function(){` +
    `H.classList.toggle('light');` +
    `try{localStorage.setItem('mode',H.classList.contains('light')?'light':'dark')}catch(e){}});`
  );
}

export function landingPage(site = {}) {
  const main = `<div class="hero">
<h1><span class="a">Most AI news is noise.</span><span class="b">We send the rest.</span></h1>
<p class="lead">One email a day on coding agents, open weights and harness engineering &mdash; held to one bar: <b>could this change how you work?</b></p>
<form id="f" action="/subscribe" method="post" novalidate>
<span class="field"><input id="email" name="email" type="email" placeholder="you@example.com" autocomplete="email" aria-label="Email address"></span>
<button type="submit">Subscribe</button>
</form>
<p class="meta"><span>Yesterday: 412 in, 6 out</span><span>Double opt-in</span><span>One click to leave</span></p>
<p class="msg" id="msg" role="status" aria-live="polite"></p>
</div>`;
  const script =
    `var f=document.getElementById('f'),m=document.getElementById('msg');` +
    `f.addEventListener('submit',function(e){e.preventDefault();` +
    `var email=f.email.value.trim();m.className='msg';m.textContent='';` +
    `if(\!email){m.className='msg err';m.textContent='Enter an email address.';return}` +
    `fetch('/subscribe',{method:'POST',headers:{'content-type':'application/json'},` +
    `body:JSON.stringify({email:email})}).then(function(r){` +
    `return r.json().then(function(d){return{ok:r.ok,d:d}})}).then(function(x){` +
    `if(\!x.ok){m.className='msg err';m.textContent=x.d.error||'Something went wrong.';return}` +
    `m.className='msg ok';m.textContent='Confirmation link sent. Check your inbox.';f.email.value=''` +
    `}).catch(function(){m.className='msg err';m.textContent='Network error. Try again.'})});`;
  return shell(main, "AI News Digest", 200, script, "", site);
}

// One layout for every terminal state: confirmed, expired, failed, 404.
export function statusPage({ kicker, a, b, receipt, chip, spec, action, title, status = 200, site = {} }) {
  const main = `<div class="hero">
<span class="kicker">${kicker}</span>
<h1><span class="a">${a}</span><span class="b">${b}</span></h1>
${receipt ? `<div class="receipt"><span>${receipt}</span>${chip ? `<em class="chip">${chip}</em>` : ""}</div>` : ""}
${spec ? `<div class="spec">${spec.map((l) => `<p>${l}</p>`).join("")}</div>` : ""}
${action ? `<a class="action" href="${action.href}">${action.label}</a>` : ""}
</div>`;
  return shell(main, title, status, "", "", site);
}

export function notFound(site = {}) {
  return statusPage({
    kicker: "404",
    a: "Nothing here.",
    b: "Culled, you could say.",
    spec: ["That address does not exist on this site."],
    action: { href: "/", label: "Go to the start" },
    title: "Not found",
    status: 404,
    site,
  });
}

/**
 * One week of issues. `prevWeek`/`nextWeek` are week keys or null; the caller
 * computes them arithmetically, so rendering never needs to know what exists.
 */
export function archiveWeekPage({ weekKey, issues, prevWeek, nextWeek, site = {} }) {
  const rows = issues.length
    ? issues
        .map(
          (i) =>
            `<a class="row" href="/archive/${escapeHtml(i.date)}">` +
            `<span class="d">${escapeHtml(i.date)}</span>` +
            `<span class="t">${escapeHtml(i.lead || "Issue")}</span>` +
            `<span class="n">${i.items == null ? "" : Number(i.items)}</span></a>`
        )
        .join("")
    : `<p class="empty">No issues that week.</p>`;

  const nav =
    `<nav class="pager">` +
    (prevWeek ? `<a href="/archive/${prevWeek}">&larr; ${weekLabel(prevWeek)}</a>` : `<span></span>`) +
    (nextWeek ? `<a href="/archive/${nextWeek}">${weekLabel(nextWeek)} &rarr;</a>` : `<span></span>`) +
    `</nav>`;

  const main = `<div class="doc">
<span class="kicker">Archive &middot; ${escapeHtml(weekKey)}</span>
<h1><span class="a">Every issue we sent.</span><span class="b">Nothing held back.</span></h1>
<p class="lead">${weekLabel(weekKey)}. Each issue is what survived that day&rsquo;s filter.</p>
<div class="rows"><div class="rowhead"><span class="d">Date</span><span class="t">Lead theme</span><span class="n">Items</span></div>${rows}</div>
${nav}
<a class="action" href="/">Subscribe</a>
</div>`;
  return shell(main, `${weekLabel(weekKey)} — AI News Digest`, 200, "", "doc", site);
}

/** A single issue. `prev`/`next` are dates within the same week, or null. */
export function archiveIssuePage({ date, sections, weekKey, prev, next, site = {} }) {
  const body = sections
    .map(
      (s) =>
        `<section class="theme"><span class="chip">${escapeHtml((s.label || "Digest").toUpperCase())}</span>` +
        `<h2>${escapeHtml(s.title)}</h2><ul>` +
        (Array.isArray(s.items) ? s.items.map((it) => `<li>${renderInline(it, WEB)}</li>`).join("") : "") +
        `</ul></section>`
    )
    .join("");

  const nav =
    `<nav class="pager">` +
    (prev ? `<a href="/archive/${prev}">&larr; ${prev}</a>` : `<span></span>`) +
    `<a href="/archive/${weekKey}">${weekLabel(weekKey)}</a>` +
    (next ? `<a href="/archive/${next}">${next} &rarr;</a>` : `<span></span>`) +
    `</nav>`;

  const main = `<div class="doc">
<span class="kicker">Issue &middot; ${escapeHtml(date)}</span>
<h1><span class="a">Most AI news is noise.</span><span class="b">Here is the rest.</span></h1>
<div class="issue">${body}</div>
${nav}
<a class="action" href="/">Get tomorrow&rsquo;s issue</a>
</div>`;
  return shell(main, `${date} — AI News Digest`, 200, "", "doc", site);
}
