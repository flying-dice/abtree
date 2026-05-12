---
title: Motivation
description: What abtree replaces (monolithic skill files), what it is not (an orchestration framework), and why it positions itself against a single, well-defined problem.
---

# Motivation

If you give an AI agent a large skill file — a `CLAUDE.md`, a system prompt, a long markdown playbook — you hand it a document and hope it follows the steps consistently. It does not. The agent skips steps it remembers from earlier in its context, confuses the order of operations, and interprets the same instruction differently on every run. The file grows as you try to compensate. The problem worsens.

abtree replaces the skill file with a behaviour tree. Instead of handing the agent the whole document, the runtime hands it one step at a time, verifies the result, and advances the cursor. The agent only ever sees the next request.

| Before abtree | After abtree |
|---|---|
| A 400-line `CLAUDE.md` the agent reads once and interprets differently every run. | A tree the agent follows one step at a time. |
| No record of where the agent got to mid-run. | An execution document persists the cursor after every step. |
| Restarting the process restarts the workflow from scratch. | The next `abtree next` resumes from exactly where the agent left off. |

## What abtree is not

abtree is not a workflow orchestration framework. It does not compete with LangGraph, Temporal, or multi-agent platforms. If you need distributed workers, event-driven pipelines, or production observability infrastructure, those tools are the right fit.

abtree solves one problem: the large, ambiguously-ordered skill file your agent follows inconsistently.

## Why this matters

The cost of the skill-file approach is invisible until the workflow is large enough that the agent reliably forgets a step. abtree's contract is that every step the agent takes is mediated by the runtime — there is no path through the workflow that bypasses the cursor. That property is what the homepage refers to as **deterministic structure for non-deterministic agents**, and the rest of the documentation explains how to apply it to your own workflows.

## Next

- [Get started](/getting-started) — install abtree and run the bundled `hello-world` tree in five minutes.
- [Why behaviour trees?](/concepts/) — the conceptual frame that the rest of the documentation assumes.
