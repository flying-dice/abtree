---
description: Why use behaviour trees for AI agents — the same hierarchical decision structure used by game AI and robotics, applied to LLM workflows. Names the four primitives so the rest of the documentation can lean on them.
---

# Why behaviour trees?

A **behaviour tree** is a hierarchical structure for organising decisions. It was invented for video-game AI — the kind of NPCs that have to choose between *patrol*, *attack*, *flee*, or *call for backup* without breaking immersion. From there it spread to robotics, where reliability matters more than cleverness.

abtree brings the same idea to LLM agents.

A behaviour tree in abtree is built from four primitives: three composite types — `sequence`, `selector`, `parallel` — and one leaf type, `action`. The composites coordinate control flow; the actions are the units of work the agent performs. The rest of the concept tier expands on each one.

<AbtreeContrast />

## The problem

You can describe almost any workflow to a modern LLM in a single Markdown document. The document mostly works. Then it does not.

The two failure modes:

### 1. Prompt drift

A long system prompt is supposed to tell the agent everything: the format of the answer, the order of operations, the failure cases, the edge cases. Model attention is finite. As prompts grow past a few hundred lines, agents:

- Skip steps they "remember" from earlier.
- Confuse the order of operations.
- Forget invariants stated up front.
- Hallucinate fields you defined.

The usual fix is to repeat yourself. The prompt grows. The problem worsens.

### 2. Non-determinism

Even when the agent reads every word, decisions are made probabilistically. Run the same task twice and you can get different choices. For exploratory work, that is fine. For workflows where reproducibility matters — code review, deployments, structured data extraction — it is a liability.

## The fix: a formal logic layer

A behaviour tree separates **what to do** from **when to do it**. The tree defines the structure: what runs first, what runs in parallel, what counts as success, when to fall back. The agent only sees the current step.

Three things change:

1. **The agent's working set shrinks** to one instruction at a time. No more 2,000-line prompt to skim.
2. **Decisions become explicit.** A `selector` says "try the morning branch first; if that fails, try afternoon." The agent does not choose. The runtime enforces the order; the agent receives the current step.
3. **Progress is verifiable.** Every action ends only after an `evaluate` invariant has been satisfied.

The next pages walk through the building blocks: [state](/concepts/state), then [branches and actions](/concepts/branches-and-actions). Take them in order — each builds on the previous.
