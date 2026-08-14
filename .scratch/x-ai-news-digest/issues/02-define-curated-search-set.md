# 02 — Define the curated search set

Status: resolved
Type: grilling
Blocked by:

## Question

What exact query set should the job run each day against Desearch, such that
the results match the "would-change-my-setup" bar?

Work this with the reader one question at a time (grilling), not by guessing.
Surface:

- Which topics/angles to search (big talked-about model releases, agent tools,
  orchestration patterns, prompting techniques, Pi-extension ideas, learnings).
- Which specific accounts/curators are worth querying directly (`from:`).
- Which terms and engagement floors most reliably signal "people actually talk
  about this" versus routine noise. Engagement operators (`min_faves:`,
  `min_retweets:`) are the main lever for the "is it talked about" test —
  confirm Desearch passes them through.
- The filter rules that drop noise before the summary is written.

The output is the concrete query list + filter spec the job uses. Keep the
query count small: each request costs money, and a tight set beats a broad one
under the curated-not-high-recall preference.

## Answer

**A two-pass agentic search, not a static query list.** Decided by grilling
with live Desearch results in front of the reader. All queries below were run
against the real API and their output judged.

### Why two passes

A single sweep finds *that* something is talked about; it does not explain
*why*, which is the reader's stated interest ("why is this release so talked
about"). Verified live: pass 1 surfaced the DeepSeek-V4-Flash launch; a
follow-up query on that topic returned benchmark comparisons against GPT-5.6 /
Kimi-K3 / GLM-5.2, "2.5x faster than GLM", local-run hardware specs, and
market-share analysis. None of that was in the pass-1 result.

### Pass 1 — discovery sweep (fixed queries)

Common suffix: `lang:en -filter:retweets -filter:replies`

| # | Bucket | Query core | Floor |
|---|--------|-----------|-------|
| A | Model releases | `(DeepSeek OR GPT OR Claude OR Gemini OR Llama OR Qwen OR Mistral OR Kimi) (release OR launch OR announcing OR benchmark)` | `min_faves:3000` |
| B | Agent orchestration | `(agent OR agents OR subagent) (orchestration OR "multi-agent" OR workflow OR harness)` | `min_faves:800` |
| C | Prompting & context | `("context window" OR "system prompt" OR prompting OR "context rot" OR compaction) (agent OR LLM OR Claude OR Codex)` | `min_faves:500` |
| D | Coding-agent tools | `("Claude Code" OR Codex OR "coding agent" OR "AI IDE") (MCP OR extension OR skill OR plugin OR hook OR config)` | `min_faves:500` |
| E | Model experience | `(Opus OR Sonnet OR "GPT-5") (verbose OR "been using" OR learnings OR "switched to" OR worse OR better)` | `min_faves:500` |
| F | Trusted accounts | `(from:mattpocockuk OR from:dexhorthy)` | `min_faves:100` |

Bucket F is an explicit allow-list and deliberately runs a low floor: these
people are trusted, so their posts do not need crowd validation. **The list is
meant to grow** — adding a handle is the cheapest way to sharpen the digest.

Live validation of each bucket:
- A → DeepSeek-V4-Flash API launch, Karpathy's nanochat, Ng's OpenWorker.
- B → Anthropic's multi-agent harness post, Claude Code orchestration extract.
- C → "Loop Engineering" PDF, Matt Pocock on long-running agents.
- D → official Claude Code plugin, claude-code-best-practices (22k stars),
  the caveman token-saving trick.
- E → Theo on Opus 5 positioning, kimmonismus "the more I use it the worse I
  like it", anshuc on mobile-app performance. Exactly the "what do people
  actually experience" signal.
- F → Matt Pocock's skills repo, `/teach`, `/loop-me`, `/grill-me`.

### Pass 2 — follow-up dig (agent-issued, dynamic)

For each topic from pass 1 that clears the relevance bar, the agent composes a
targeted follow-up query naming the topic plus discourse terms, e.g.

```
"DeepSeek V4" OR "V4-Flash" (why OR because OR cheap OR price OR benchmark
 OR agent OR compare) min_faves:300 lang:en -filter:retweets
```

Cap the follow-ups (3–5 per run) to bound cost and keep the digest tight.

### Noise handling

**Wide net + model filter** (reader's choice). Engagement floors alone cannot
encode the "would-change-my-setup" bar — verified: viral fluff clears them
easily (a Claude-makes-a-video thread at 5.6k likes, an Apple 3D-scroll page at
4.4k). So pass 1 stays moderately wide and the summarising model does the
judgement call in ticket 05. Do **not** tighten the floors to fix noise; that
costs recall on smaller posts that genuinely matter.

### Cost

6 discovery requests + 3–5 follow-ups ≈ 10 requests/day ≈ 300/month ≈
**14 cents/month**. Billing is per request regardless of `count`, so always
request `count=30` (the verified safe maximum; 50 times out).
