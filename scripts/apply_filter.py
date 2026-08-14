#!/usr/bin/env python3
"""Materialise the filter decision into runs/kept.json (fresh run 2026-08-04).

KEEP maps a candidates.json index to the reason it earns a place in the digest.
"""
import json
import pathlib

RUNS = pathlib.Path(__file__).resolve().parent.parent / "runs"

KEEP = {
    1: ("qwen-3.8", "Qwen3.8-Max (2.4T) goes open-weights next week - frontier class becomes self-hostable"),
    4: ("qwen-3.8", "Qwen3.8-27B runs locally on 17GB RAM/VRAM - inside a normal workstation"),
    8: ("qwen-3.8", "Ranked #4 on Frontend Code Arena, trailing only Opus 5 and Kimi K3 - quality measured externally"),
    6: ("qwen-3.8", "Qwen3.8 Max now available in OpenCode Go - direct tool adoption path"),
    28: ("qwen-3.8", "The open-source lineage: Kimi K3, MiniMax H3, DeepSeek V4, Qwen - by October open AI may 'win'"),
    39: ("qwen-3.8", "Looking forward to laptop-sized Qwen 3.8 - local model promise for a personal machine"),
    45: ("qwen-3.8", "Qwen3.8 Max removed from Artificial Analysis index - worth watching, signal of benchmark churn"),
    10: ("opus-5", "Anchor regression report: goes off-track, forgets, needs approval. Cross-source (model-experience + opus)"),
    16: ("opus-5", "Opus 5 verbosity making output unreadable - not just a takes-tweet, a work blocker"),
    49: ("opus-5", "Revive a /zoom-out skill to counter Opus 5 verbosity - a copyable mitigation"),
    32: ("opus-5", "Matthew Pocock's CLAUDE.md: always talk in ASD-STE100 - the exact prompt fix the reader already scripted"),
    52: ("opus-5", "Independent corroboration: Opus 5 worse than everything Anthropic shipped, approval-hungry"),
    60: ("opus-5", "Another voice: Opus 5 the worst Claude with expectations - more convergence"),
    3: ("harness", "Y Combinator open-sourced its internal multi-agent harness QM - a company-scale harness to learn from"),
    23: ("harness", "CS paper: harness engineering as the primary determinant of agent reliability - theory"),
    27: ("harness", "Lilian Weng (OpenAI) breakdown of harness design, workflow automation, file-system memory"),
    35: ("harness", "LangChain open-sourced deepagents - a finished harness (sub-agents, todo planning, virtual FS)"),
    24: ("harness", "Uncle Bob building a squad-leader harness - concrete orchestration pattern in the wild"),
    37: ("harness", "NVIDIA NOOA: OOP agents as a single Python class - a distinctive harness architecture"),
    15: ("agentic", "Karpathy's five shifts turning LLMs into agentic systems - the conceptual map"),
    47: ("context", "Agent memory as four markdown files, zero databases - directly copyable"),
    48: ("context", "Claude gets more stubborn as the context window fills - argues for compacting earlier"),
    53: ("context", "Anthropic published a per-model prompting playbook for the whole Claude lineup"),
    127: ("context", "Arize engineer: a year of context failures in 16 minutes - context engineering as discipline"),
    14: ("tools", "/watch-video skill: transcript, frame extraction, vision pass over recordings"),
    20: ("tools", "Claude Connectors (gmail, calendar, slack) also work inside Claude Code"),
    34: ("tools", "A 24/7 AI video editor built inside Claude Code - extension-as-product pattern"),
    62: ("tools", "In Pi, extensions subscribe to lifecycle events and register custom tools - directly relevant to the reader's own Pi extensions"),
    38: ("tools", "Pi consistently the best harness for cost and performance (Databricks, Shopify) - validates the reader's chosen runner"),
    40: ("gpt-5.6", "Two days of real sessions: Luna Max vs Sol Medium, arguing official benchmarks mislead"),
}


def main() -> None:
    candidates = json.loads((RUNS / "candidates.json").read_text())
    kept = []
    for index, (topic, reason) in sorted(KEEP.items()):
        if index >= len(candidates):
            print(f"WARN: index {index} out of range, skipping", file=__import__("sys").stderr)
            continue
        row = dict(candidates[index])
        row["topic"] = topic
        row["keep_because"] = reason
        kept.append(row)
    (RUNS / "kept.json").write_text(json.dumps(kept, indent=2))
    print(f"kept {len(kept)} of {len(candidates)} candidates")
    by_topic: dict[str, int] = {}
    for row in kept:
        by_topic[row["topic"]] = by_topic.get(row["topic"], 0) + 1
    for topic, count in sorted(by_topic.items(), key=lambda kv: -kv[1]):
        print(f"  {topic:<10} {count}")


if __name__ == "__main__":
    main()
