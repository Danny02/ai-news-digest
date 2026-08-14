# Filter prompt

Input: the merged phase-1 + phase-2 candidate list (`scripts/merge_candidates.py`).
Output: `runs/kept.json` — the posts that earn a place in the digest.

## The bar

Keep a post only if it could plausibly **change what the reader runs or how
they run it**. The reader uses the Pi coding agent daily, writes their own
extensions, and cares about orchestration and prompting.

Engagement is *not* the bar. A 35k-like post about a Hawaiian restaurant is
noise; a 240-like post about Opus being too verbose is signal.

## Keep

- A model release the reader might switch to or test, **with the reason it
  matters** (price cut, open weights, local-run feasibility, benchmark shift).
- Orchestration and harness patterns, agent architecture, prompting technique.
- Context/compaction learnings and session-management practice.
- A tool, skill, extension, or MCP server the reader could install or copy.
- Convergent experience reports about a model getting better or worse.
- A concrete config or workflow change ("add this to your Codex config").

## Drop

- Off-domain personal posts from trusted accounts. Being in bucket F earns a
  look, not a place. Restaurants, parenting, sports, politics: drop.
- Funding, valuations, org drama, hiring, lawsuits, personnel moves.
- Crypto and token content in any form.
- Engagement bait: "17 free guides", "10x engineer in a weekend", "22 skills
  you need", listicle threads, "bookmark this".
- Course and book promotion, even on-topic.
- Vague hype with no actionable content ("this changes everything").
- Pure reaction posts with no substance ("this seems not good").
- Anything the reader already saw - honour the `seen` flag.

## Judgement calls

**Prefer the explaining post over the announcing post.** If both the launch
tweet and a benchmark comparison are present, keep the comparison; it carries
the *why*.

**Convergence beats volume.** Three people independently reporting the same
regression is stronger than one viral post, and all three can be kept as one
item.

**When genuinely unsure, drop it.** The reader chose curated over high-recall.
A short digest that is all signal beats a long one they stop reading.

## Output format

```json
[
  {
    "id": "2083084415157022911",
    "topic": "qwen-3.8-open-weights",
    "keep_because": "Open weights land next week and a 27B variant runs on 17GB RAM - the reader could run this locally",
    "url": "https://x.com/..."
  }
]
```
