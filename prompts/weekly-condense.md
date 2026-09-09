# Weekly AI News Digest — condense task

Input: `runs/weekly-<GGGG-Www>.json`, the published archive JSON for the
completed previous ISO week. Each issue has a `date`, `subject`, and `sections`
whose `items` are the daily markdown bullets. Use only this archived material.
Do not fetch, search, research, or invent a source.

Before writing, read `skills/ai-news-digest/SKILL.md` and reuse its voice:
plain literal English, short active sentences, substance first, honest
uncertainty, and an implication for how the reader should work when one exists.
This is the same reader and the same markdown section shape as the daily digest.

## Selection rules

1. Group by subject across the whole week, never by day. A topic is one story
   or connected subject assembled from all of its daily appearances.
2. Rank topics in this order: recurrence across at least two days; consequence,
   meaning it changes what a reader should do or believe; and source spread
   across independent accounts.
3. Resolve ties toward the later day.
4. Reserve one topic slot for a single-day item that scores highly on
   consequence. A Friday bombshell must not be dropped only because it did not
   recur.
5. Keep at most five topics, with at most four bullets in each topic.

## Final-state and source rules

- A story that ran for several days becomes one bullet in its final state. Give
  it at most two links: the link that broke the story and the link that changed
  the picture.
- Exception: when the reversal is itself the news, say that explicitly in the
  bullet instead of hiding the change.
- Within a kept topic, prefer bullets with a primary or first-hand link over
  commentary.
- Drop pure reaction bullets.
- Keep a counter-report when it contradicts the main claim.
- Every story bullet must carry at least one real source link from the archive.
  Never invent or alter a URL. Preserve the author and URL in markdown
  `[author](url)` form.

## Headings and output

Write headings fresh at week level as claims, not labels. Do not reuse daily
headings, because the pruned weekly groups do not line up with daily grouping.
Follow this existing rule verbatim from `prompts/summary.md`:

> Pick a short heading per group that is a claim, not a label

Write `drafts/weekly-<GGGG-Www>.md`. The filename must stay `weekly-...`, never
`digest-...`, so the daily sender's `drafts/digest-*.md` glob cannot select this
edition.

Use this shape:

```markdown
# AI news digest — <GGGG-Www>

## A short claim about the first topic
- One final-state claim with a real [author](https://source.example/post).

## A short claim about the next topic
- One claim with a primary [author](https://source.example/post).

## Full week
- Read the complete week in the [archive](https://ai-news.nullzwo.dev/archive/<GGGG-Www>).
```

The `Full week` block is a footer, not a sixth topic, and does not count toward
the five-topic cap. It must be the final block and its archive link must be the
last link in the edition. Keep every story bullet on one physical line. Keep
all headings and bullets in the same section shape used by the daily digest.
