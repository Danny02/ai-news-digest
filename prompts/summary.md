# Summary prose prompt

Input: `runs/kept.json` (each item: text, author, likes, url, keep_because, topic).
Output: the digest — email body, ready to send.

## Reader

One developer who runs the Pi coding agent daily and writes their own
extensions. They already know the basics; do not explain fundamentals. They
want to know **what changed and whether it affects how they work**.

## Format

- **Header**: the date, one line. No preamble, no unsubscribe blurb, no fluff.
- **Grouped by topic**, not by account. Use the item's `topic` field. Pick a
  short heading per group that is a claim, not a label ("Opus 5: people are
  souring on it" beats "Opinions").
- **Every kept item gets a mention.** Fold near-duplicates into one line rather
  than dropping them.
- **One source link per item, always.** Write each bullet with its source as
  `[author](url)` using the item's `url` field, at least once per bullet (more
  if it merges several posts). The renderer turns these into cyan.
- **One bullet = one physical line.** The renderer parses lines starting with
  `- ` and joins soft-wrapped continuation lines, so do NOT rely on wrapping:
  keep each bullet short enough to hold on one line. A bullet that wraps in
  the source risks being truncated mid-phrase.
- Under each heading, **one line per post**: what it says (the actionable
  content), plus the author + source link.
- Keep the total **around 500 words** (reader's choice: the fuller version
  reads well as a morning scan). Be spare within that. If a heading's group is
  slim, merge it into a nearby one rather than a one-item section.

## Voice

- Plain, literal English. Short sentences. Active voice.
- Lead each line with the substance, not the wrapper.
- No "exciting", "amazing", "game-changing", "huge". No exclamation marks for
  effect. No emoji except where it carries a factual pattern.
- State uncertainty honestly ("several people report X", "one person claims").

## What each kept item contributes

- If `keep_because` names a concrete action (a config change, a skill to copy,
  a model to test), surface that action as the point.
- If it is an experience report, give the claim and the number of agreeing
  voices if that was the reason it was kept.
- A model version you mention once; spell it consistently.

## Output

```markdown
# AI news digest — 2026-08-03

## Opus 5: several people are souring on it
- _Measured, not claimed:_ **#4 on the Frontend Arena** ([arena](https://x.com/arena/status/2084108703729615026)).
- The fix: an ASD-STE100 CLAUDE.md line plus a /zoom-out skill ([mattpocockuk](https://x.com/mattpocockuk/status/2084753070437609606)).

## Harness engineering is the week's theme
- ...
```

### Required output rules (break any and the email is broken)

1. **Every bullet carries a `[author](url)` source link.**
2. **One bullet = one physical line.** Do not soft-wrap a bullet across source
   lines.
3. Use `_italics_` (renderer handles it; do not hand-write underscores).
4. URL must be the item's real `url` from `kept.json` — never invented.
5. Links are reserved from the italic pass, so a `_` inside a handle/URL is
   safe — but do not wrap the URL in extra characters.
```
