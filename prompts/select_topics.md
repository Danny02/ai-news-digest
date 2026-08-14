# Topic selection prompt

Input: the condensed phase-1 post list (`scripts/condense_phase1.py`).
Output: `runs/topics.json` — 3 to 5 topics worth explaining.

## The bar

Pick a topic only if it could plausibly **change what the reader runs or how
they run it**. The reader uses the Pi coding agent daily and writes their own
extensions.

**In:**
- Model releases people are actually arguing about, and *why* (price cuts,
  benchmark shifts, open weights, local-run feasibility).
- Agent orchestration patterns, prompting techniques, context/compaction
  learnings.
- Tools, skills, extensions, MCP servers the reader could adopt.
- Convergent experience reports ("model X got worse") — several independent
  people saying the same thing is itself the signal.

**Out:**
- Routine point releases nobody discusses.
- Funding, org drama, personnel news, crypto.
- Engagement bait ("17 free guides", "10x engineer in one weekend").
- Anything off-domain, however viral.

## Prefer convergence

A topic said once is noise. A topic three independent accounts raise in two
days is signal. Weight the number of distinct voices above raw like counts.

## Query construction

Every clause you add multiplies the constraints and can collapse the result set
to zero. Build the query in this order and stop as soon as it is specific
enough.

**Step 1 - write the anchor.** The shortest phrase that names the topic
unambiguously, with spelling variants OR'd together.

- Product or version: `("Qwen3.8" OR "Qwen 3.8")`, `("GPT-5.6" OR "GPT 5.6")`
- Concept: `("agent harness" OR "harness engineering")`, `"context engineering"`

**Step 2 - decide whether the anchor alone is enough.** It usually is. Ship it.

**Step 3 - add a second clause only if the anchor is a common English word or
phrase that would match unrelated posts.** If you do add one, keep it to three
or four terms.

- Needed: `harness` alone also matches horses -> `"agent harness"` instead
  (fix by sharpening the anchor, not by adding a clause).
- Needed: `"Opus 5" (worse OR verbose OR slop)` - `"Opus 5"` alone returns
  every mention including praise, and the topic is specifically the complaints.
- Not needed: `("Qwen3.8" OR "Qwen 3.8")` - the version string is already unique.

**Never** add `since:`, `lang:`, or `-filter:` - phase 2 appends those.

### Verified outcomes

| Query | Result |
|-------|--------|
| `("Qwen3.8" OR "Qwen 3.8")` | 30 hits - anchor alone, ideal |
| `"Opus 5" (worse OR verbose OR slop OR regression)` | 30 hits - strong anchor tolerates a second clause |
| `("agent harness" OR "harness engineering")` | 30 hits - sharpened anchor, no second clause |
| `("GPT-5.6") (Luna OR Sol OR production OR coding OR compare OR vs)` | **0 hits** - second clause too long |
| `("context window" OR "context rot") (degrade OR forget OR stubborn OR compact)` | **26 weak hits** - should have been `"context engineering"` alone |
| `(skill OR skills) (Codex OR agent) (transfer OR portable OR share)` | **junk** - three generic clauses, matched marketing spam |

## Self-check before you emit

Run this against every query you wrote. If any answer is wrong, fix the query
and check again.

1. How many parenthesised clauses does it have? **Two is the maximum.** Three
   or more: delete clauses until two remain.
2. If it has two clauses, is the anchor a specific product, version, or
   multi-word term of art? If the anchor is generic, **sharpen the anchor and
   drop the second clause** instead.
3. Does the second clause have more than four terms? Cut it down.
4. Would the anchor alone have worked? If yes, **use the anchor alone.**
5. Does the query contain `since:`, `lang:`, or `-filter:`? Remove them.
6. Is every term one a real person would type in a post about this topic - not
   a category label you invented (`portability`, `ecosystem`, `landscape`)?

## Output format

```json
[
  {
    "slug": "gpt-5.6-luna-price-cut",
    "why": "80% permanent price cut confirmed by OpenAI staff; changes which model is cheapest for daily agent work",
    "voices": ["thsottiaux", "simonw", "Angaisb_"],
    "query": "(\"GPT-5.6\" OR \"GPT 5.6\" OR \"5.6 Luna\")"
  }
]
```
