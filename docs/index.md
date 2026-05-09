---
layout: home

hero:
  name: "abtree"
  text: "Behaviour trees for AI agents"
  tagline: "Define agent workflows as YAML trees. The runtime hands the agent one step at a time, verifies the result, and persists the cursor — so workflows stay reproducible no matter how big they get."
  image:
    src: /abtree-mark.svg
    alt: abtree
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Why behaviour trees?
      link: /concepts/

features:
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 9v6"/><path d="M18 9v3a3 3 0 0 1-3 3H6"/></svg>'
    title: One step at a time
    details: Agents see only the next instruction, not the full plan. No 2,000-line prompts. No "jumping ahead". No skipped invariants.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><rect x="3" y="6" width="18" height="12"/><path d="M3 11h18M7 15h2M12 15h2"/></svg>'
    title: Durable by default
    details: Every flow persists as a JSON document. Resume work hours or weeks later — the cursor remembers where you left off.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>'
    title: Visual execution traces
    details: Every state change regenerates a Mermaid diagram. Green for success, red for failure. See exactly what your agent did and where it stopped.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M9 4v4M15 4v4M3 11h6l1 5 4-12 1 7h6"/></svg>'
    title: Framework-agnostic
    details: A CLI any agent can drive. Works with Claude, ChatGPT, local models — anything that can run a shell command.
---

## What is abtree?

Modern LLMs follow Markdown instructions remarkably well — until workflows grow. Then two things go wrong:

1. **Instruction fatigue.** A long system prompt loses focus. Agents skim, skip steps, hallucinate fields.
2. **Non-determinism.** Decisions left to the model produce different paths on every run.

abtree borrows the structural reliability of game AI and robotics — **behaviour trees** — and adapts them for agents. You define the workflow as a tree of small, focused steps. The runtime hands the agent **one step at a time**, evaluates the result against an **explicit invariant**, and persists the cursor.

The agent stays focused. The path stays predictable. The state survives.

[Get started in five minutes →](/getting-started)
