# 05 — Design the summary prose authoring

Status: open
Type: grilling
Blocked by: (04)

## Question

How should the digest's written summary be produced, given the runner is a Pi
session (model access available)?

Work with the reader (grilling) to decide:

- Which Pi model / provider writes the digest.
- Length and format: a tight bulleted list grouped by theme, vs a short prose
  briefing, vs something else.
- Grouping: by topic, by the "would-change-my-setup" impact, or chronological.
- A fixed editing/authoring prompt that enforces the "would-change-my-setup"
  bar and drops noise before prose is written.
- Whether the reader reviews a draft or the job sends directly.

The output is the concrete authoring prompt + format spec the job uses. This
could fold into or inform ticket 02's overall pipeline design once the feed
set is settled.
