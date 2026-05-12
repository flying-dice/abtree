---
layout: home
title: abtree — Behaviour Trees for AI Agents and Agentic Workflows
titleTemplate: false
description: Open-source behaviour tree runtime for AI agents and autonomous agentic workflows. Build deterministic, durable, resumable LLM agent workflows in YAML, JSON, or TypeScript and drive them from the CLI — works with Claude, ChatGPT, and any LLM.

hero:
  name: "abtree"
  text: "Behaviour trees for AI agents"
  tagline: "Define agent workflows as YAML, JSON, or TypeScript. The runtime hands the agent one step at a time and persists the cursor — so workflows stay reproducible no matter how big they get."
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
    title: Hand the agent one step at a time
    details: The runtime returns the next instruction and only the next instruction. No 2,000-line prompts, no skipped invariants, no agent shortcutting the order of operations.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><rect x="3" y="6" width="18" height="12"/><path d="M3 11h18M7 15h2M12 15h2"/></svg>'
    title: Persist every cursor move
    details: Every execution persists to disk after every state change. Kill the process, restart the agent hours or weeks later, and the runtime resumes from the same step.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>'
    title: Render the trace as a diagram
    details: Every state change regenerates a Mermaid diagram. Green for success, red for failure. See exactly which path the agent took and where it stopped.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M9 4v4M15 4v4M3 11h6l1 5 4-12 1 7h6"/></svg>'
    title: Drive it from any agent
    details: Expose the runtime through a CLI any shell-capable agent can call. Works with Claude, ChatGPT, local models, and anything else that runs a subprocess.
---

<AbtreeContrast />

<AbtreeDemo />

<div class="hide-on-touch">

## See an execution

Every state change refreshes an SVG of the tree. Children render in declaration order — the diagram mirrors execution flow, sequences in emerald, parallels in amber, actions in blue, and each card carries its own success or failure pip.

<TreeSvg src="/example.svg" :height="520" />

</div>

## Author in TypeScript

- Maintain complex workflows with the TypeScript DSL.
- Build composable trees with full type safety on locals, globals, and wiring.
- Compile to JSON or YAML and ship through everyday tools — [npm](https://www.npmjs.com/), [GitHub](https://github.com/), or anywhere else.

The TypeScript DSL is one authoring path among three (YAML, JSON, TypeScript); see [Writing trees](/guide/writing-trees) for the tutorial that builds the bundled `hello-world` from scratch.

<AbtreeDsl />

## What abtree is

abtree is a runtime. It reads a JSON, YAML, or TypeScript-compiled behaviour-tree file and, each time the agent asks to progress, returns the next instruction — one step at a time.

Your agent drives the execution through three commands:

- `abtree next` — ask the runtime what to do.
- `abtree eval` — answer a precondition (`true` or `false`).
- `abtree submit` — report the outcome of an instruction.

Each call returns JSON, advances the cursor, and persists the execution to disk. The agent only ever sees the next step.

<AbtreeCta />
