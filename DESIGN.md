---
name: AI News Digest
description: A monochrome daily digest of AI signal, where grey is the noise and white is what survived the filter.
colors:
  canvas: "#000000"
  ink: "#ffffff"
  dim: "#7a7a7a"
  faint: "#3a3a3a"
  hairline: "#1e1e1e"
  stream-noise: "#333333"
  stream-pass: "#8f8f8f"
  veil: "rgba(0,0,0,0.58)"
  scan: "rgba(255,255,255,0.03)"
  light-canvas: "#ffffff"
  light-ink: "#000000"
  light-dim: "#6b6b6b"
  light-faint: "#c4c4c4"
  light-hairline: "#e6e6e6"
  light-stream-noise: "#d2d2d2"
  light-stream-pass: "#7d7d7d"
  email-body: "#b8b8b8"
  email-muted: "#7a7a7a"
  email-rule: "#1e1e1e"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(44px, 7.2vw, 104px)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.055em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(16px, 1.5vw, 19px)"
    lineHeight: 1.55
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.2em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "13px"
    letterSpacing: "0.14em"
rounded:
  all: "0"
spacing:
  xs: "6px"
  sm: "14px"
  md: "22px"
  lg: "40px"
components:
  wordmark:
    textColor: "{colors.ink}"
    typography: label
  statement-headline:
    textColor: "{colors.dim}"
    typography: display
  stream-row:
    textColor: "{colors.stream-noise}"
    typography: mono
  pass-bar:
    backgroundColor: "{colors.ink}"
    width: "2px"
---

# Design System: AI News Digest

## Overview

**Creative North Star: "Signal and Noise"**

The product exists to throw things away. Roughly four hundred posts go in each
day and six come out, so the design states that rejection instead of decorating
around it. There is one contrast and it does all the work: **grey is the noise,
white is the signal.** Every level of hierarchy — headline, theme, item,
label — is a position on that single axis.

The web page puts the reader inside the noise: a generated field of unreadable
text marks, a CRT surface, and a live column of intake scrolling past with most
lines struck through. The email is the opposite state — the noise is gone, and
what is left sits on black behind a white bar. Same world, two ends of the
filter.

**Key Characteristics:**
- Monochrome. No accent colour exists anywhere in the system.
- Flat. No shadows, no glass, no glow, no rounded corners; hairlines and
  negative space carry structure.
- Statement typography — a two-line headline that splits grey from white.
- A 2px white bar is the mark of something that passed.
- Plain, literal, technical voice; no hype, no exclamation for effect.

## Colors

The palette is greyscale only. It is defined twice, as a dark set and its
inversion, and the two are equal citizens — the page ships an **Invert**
control and remembers the choice in `localStorage`. Dark is the default.

### Primary
- **Ink** (#ffffff dark / #000000 light): the signal. Reserved for what
  survived — the second headline line, theme titles, bold emphasis, code
  tokens, links, the pass bar, and the button fill.

### Secondary
- **Dim** (#7a7a7a dark / #6b6b6b light): the noise, and every supporting
  voice — the first headline line, lead paragraphs, meta rows, footers. Both
  values clear 4.5:1 against their own canvas, so "quiet" never means
  "unreadable".

### Tertiary (surface set)
- **Faint** (#3a3a3a / #c4c4c4) — resting input underline, receipt border.
- **Hairline** (#1e1e1e / #e6e6e6) — footer rule and, in the email, the rule
  above every theme.
- **Stream noise** (#333333 / #d2d2d2) — culled lines in the intake column.
- **Stream pass** (#8f8f8f / #7d7d7d) — passed lines and their leading bar.
- **Veil** (rgba(0,0,0,0.58) / rgba(255,255,255,0.7)) — flat wash that holds
  the background layers back from the type.
- **Scan** (rgba(255,255,255,0.03) / rgba(0,0,0,0.035)) — CRT scanlines and
  the rolling refresh bar.

### Neutral
- **Canvas** (#000000 / #ffffff): the page and the email background.

The email uses a reduced set, defined in `scripts/render_email.py`: `INK`
#ffffff, `BODY` #b8b8b8, `MUTED` #7a7a7a, `RULE` #1e1e1e on a #000000 canvas.
Body text is #b8b8b8 rather than the web's brighter ramp because email clients
apply their own contrast handling and a slightly softer body survives it.

### Named Rules

**The Noise/Signal Rule.** Grey states the noise, white states the signal, and
nothing else is allowed to state either. This is why the headline splits across
two colours mid-sentence: the design makes the claim before the reader finishes
reading it.

**The No-Colour-Theme Rule.** A theme is never identified by colour. It is told
apart by its mono label and the hairline above it. This is deliberate rather
than austere — it means no part of the digest depends on an email client
rendering an accent correctly.

**The Two-Pixel Bar Rule.** A 2px white bar means "this passed the filter". It
leads passed rows in the web intake stream and every item line in the email,
and the `PASS` chip on the confirmation screen is the same statement in words.
It is never used as ornament.

## Typography

**Display Font:** system sans stack (`-apple-system`, `'Segoe UI'`, Roboto,
Helvetica, Arial) — no webfont, because the email strips external fonts and the
page must not wait on one.
**Body Font:** the same system stack.
**Mono Font:** `ui-monospace` / SF Mono — carries labels, dates, the intake
stream, spec lines, footers and code tokens.

**Character:** the split is structural. Sans is used for statements a human
makes; mono is used for machine readout — what was scanned, when it ships, what
the address is. The scale is deliberately extreme: a 104px headline sits
directly above 13px mono, with almost nothing in between.

### Hierarchy
- **Display** (800, clamp(44px, 7.2vw, 104px), 0.94, -0.055em): the two-line
  statement headline. Line one dim, line two ink.
- **Lead** (400, clamp(16px, 1.5vw, 19px), 1.55, dim with ink bold): one
  sentence under the headline, max 46ch.
- **Kicker / label** (600, 11px, 0.2em, uppercase, dim): the wordmark, the
  status-page kicker, the cadence readout.
- **Mono readout** (400, 13px / 13.5px, 0.14em where tracked): intake rows,
  meta row, spec lines, footer.
- **Email headline** (800, 34px, 1.02, -0.04em) and **email theme title**
  (800, 19px/26px, -0.025em, ink) over **email body** (15px/23px, #b8b8b8).

### Named Rules

**The Size-Spread Rule.** Hierarchy is read from size and weight, never from
colour temperature or decoration. The steps are wide and few — 11 / 13 / 17 /
104 on the page, 11 / 15 / 19 / 34 in the email — so a reader can place any
element in the hierarchy at a glance.

## Layout

**Web:** a full-height flex column — a thin top bar, a centred hero band, a
hairline footer. The hero is left-weighted at `max-width: min(58vw, 840px)`
with `margin-left: clamp(0px, 5vw, 110px)`, which leaves the right side of the
viewport free for the intake stream at `min(44vw, 560px)`. The two columns
never overlap; below 1024px the stream narrows, and below 760px it drops behind
the content full-width and the hero goes edge to edge.

**Email:** a single 600px column, centred on black, 36px top padding. The
header is wordmark + date on one row, then the statement, then one line of
lead. The body is a stack of theme blocks separated by hairlines, each 26px
above and 30px below its content.

## Elevation & Depth

There is no elevation. Nothing casts a shadow and nothing floats.

Depth on the page is **atmospheric**, built from four fixed layers stacked
under the content: the generated mark texture (`/bg.jpg`, served by the worker
from `worker/src/bg.js`), a plate combining a flat veil with a radial clearing
that keeps a clean bed for the type, the CRT surface, and the intake stream.
The texture is inset 64px from the top and 58px from the bottom so it never
touches the wordmark or the footer, and it is masked away from the headline and
form.

The CRT surface is four effects: 1px scanlines on a 3px pitch, a refresh bar
rolling top to bottom every 6.6s, three tear slices that stay idle roughly 90%
of their cycle then displace horizontally for a few frames (5.7s, 8.3s and
11.1s, deliberately coprime so they never sync), and a slow brightness flicker
on the texture. Tear slices carry the same mask as the texture, so a glitch can
never cross the headline or the form.

All of it is progressive: `prefers-reduced-motion: reduce` freezes every
animation and removes the tear layers entirely, leaving a static composition
that loses nothing but the atmosphere. The email carries none of these layers.

## Shapes

Rectangles. `border-radius` is zero everywhere — the form field, the buttons,
the receipt, the chip, the email blocks. Edges are stated with 1px hairlines,
1.5px borders on interactive elements, and the 2px pass bar. The only curve in
the system is the letterforms.

## Components

### Wordmark
- **Style:** "AI News Digest" in 11px sans, 600, 0.2em tracking, uppercase,
  ink, preceded by a 7px solid square that blinks on a 3.4s step cycle.
- **Role:** the only brand mark. There is no logo.

### Statement Headline
- **Structure:** two spans, `.a` dim and `.b` ink, each a block.
- **Role:** carries the page's whole argument. Landing: "Most AI news is
  noise." / "We send the rest." Confirmation: "You cleared the bar." / "First
  issue tomorrow."

### Subscribe Form
- **Field:** no box — a 1.5px faint bottom border that goes ink on focus.
  17px input, no rounding.
- **Button:** solid ink fill, canvas-coloured 13px uppercase label at 0.14em,
  1.5px ink border. Hover inverts to transparent fill with ink text.
- **Below it:** one mono meta row (intake count, double opt-in, one click to
  leave) and a live region for the response.

### Intake Stream Row
- **Structure:** mono handle (104px), post text, and a `PASS` / `CULL` verdict.
- **Culled:** stream-noise colour with a 1px line-through.
- **Passed:** stream-pass colour, no strike, led by the 2px bar.
- **Behaviour:** the column scrolls on a 34s loop, masked to fade at top,
  bottom and toward the headline. It is a fixed sample, not a live feed.

### Receipt and PASS Chip
- **Receipt:** the confirmed address in 15px mono inside a 1.5px faint border,
  overflowing to an ellipsis on narrow screens.
- **Chip:** the word `PASS` in 11px mono at 0.18em inside a 1.5px ink border —
  the reader is told, in the product's own vocabulary, that they got through.

### Status Page
- **Structure:** one layout serves confirmed, expired, failed and 404 — kicker,
  two-line statement, optional receipt, an optional mono spec list, and at most
  one action button.
- **Rule:** the failure states never blame the reader; "Our side broke. / Not
  your address."

### Email Theme Block
- **Structure:** a 1px #1e1e1e rule, then a mono uppercase chip in #7a7a7a,
  then an 800-weight 19px title in #ffffff, then the item rows.
- **Rule:** the chip and the rule are the only theme identifiers.

### Email Item Row
- **Structure:** a table row of three cells — a 2px cell filled #ffffff, a 16px
  spacer, and the text at 15px/23px in #b8b8b8.
- **Why a table cell:** a background-coloured cell is the only rule shape that
  renders reliably at this width in Outlook.
- **Inline styles:** bold is #ffffff at 700, code is mono 0.92em #ffffff,
  italic is #b8b8b8, and links are #ffffff underlined at 2px offset. Every item
  line carries at least one `[author](url)` source link to the real post.
- **Rendering rule:** the renderer stashes links to placeholders *before* the
  bold/italic/underscore passes, so an underscore inside a handle or URL
  (e.g. `@Alibaba_Qwen`) is never eaten by the italic regex.

## Do's and Don'ts

### Do:
- **Do** keep every value greyscale. If a hex is not R=G=B, it does not belong.
- **Do** split the headline grey-to-white; that split is the brand.
- **Do** reserve the 2px bar for things that passed the filter.
- **Do** hold body text at 4.5:1 or better in both the dark and light sets.
- **Do** treat the texture, CRT and stream as removable atmosphere — the page
  must still read with all three gone.

### Don't:
- **Don't** introduce an accent colour, not even for a status or an error.
- **Don't** identify a theme by colour; use its label and rule.
- **Don't** add shadows, rounding, glass or glow to any surface.
- **Don't** put the texture, animation or masks in the email — it is
  table-based with inline styles and must survive Outlook and Gmail flattening.
- **Don't** let the background layers touch the wordmark, the footer, or the
  headline's clean bed.
