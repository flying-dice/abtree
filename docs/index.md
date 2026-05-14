---
layout: home
title: abtree — Behaviour Trees for AI Agents and Agentic Workflows
titleTemplate: false
description: Treat agent instructions like the software they are. Clear steps, predictable behavior, real answers when something goes wrong. abtree is an open-source runtime for AI agents — deterministic, durable, resumable, and driven from a CLI that works with Claude, ChatGPT, or any shell-capable agent.

hero:
  name: "abtree"
  text: '<s>Hoping.</s> <span class="accent">Behaving.</span>'
  image:
    src: /abtree-mark.svg
    alt: abtree
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: How it works
      link: /concepts/how-it-works
---

## One instruction at a time

Agents start guessing when they try to do too much. Hide the full plan, ask for a single instruction, and allow your agent to focus on the present. The agent only ever sees the next step. The plan stays in the tree, not in the prompt.

<div class="attention-split">
  <div class="attention-panel attention-before">
    <div class="attention-tag">CLAUDE.md · 487 lines</div>
    <pre>1. First, check the git status. Confirm a clean tree.
2. Read the existing tests. Note their style.
3. Locate the file containing the function to refactor.
4. Identify single-responsibility violations. Score each.
5. Draft a refactor plan and present to the user.
6. Apply the refactor, splitting concerns into modules.
7. Update the imports across the codebase.
8. Run the test suite. Verify everything stays green.
9. Re-score the codebase against the SRP criteria.
10. Confirm violations resolved. Loop if any remain.
11. Run a multi-agent code review on the diff.
12. Compose a before-vs-after report. Save to disk.
13. ...</pre>
  </div>
  <div class="attention-arrow" aria-hidden="true">→</div>
  <div class="attention-panel attention-after">
    <div class="attention-tag">abtree next</div>
    <pre><span class="attention-kind">instruct</span>
<span class="attention-action">Score_SRP</span>
Score the codebase for Single
Responsibility violations. Save
the ranked list to <span class="attention-var">$LOCAL.violations</span>.</pre>
  </div>
</div>

## Observability built in

Never guess where your agent got stuck. The runtime shows the tree in real time, logging each step. So you can see exactly what ran, what was skipped, and how far it got.

<TreeSvg src="/example.svg" :height="520" />

## YAML. JSON. TypeScript.

Whether you prefer code first or plain text, the TypeScript DSL gives composability and IDE support; YAML and JSON give a no tooling approach.

<AbtreeDsl />

## Share with the tools you love

Publish to npm, share through GitHub or bring your own tooling.

<InstallDemo />

## Hand over to your agent

Claude Code, ChatGPT, or any shell-capable agent, the brief is the same. Paste it. The agent understands and walks the tree until the end.

```text
Install the npm package @abtree/srp-refactor, then drive the workflow against this repo:

  abtree --help
  abtree execution create ./node_modules/@abtree/srp-refactor "Refactor the worst SRP violation in src/"
```

> For the long-form walkthrough — install the CLI, add a tree, drive it from your agent — see [Get started](/getting-started).

## From local to fleet

Whether running locally or with a fleet of agents, the engine, DSL, and protocol stay the same.

- ✓ **Core engine** — Deterministic execution, one step at a time. Resumable and replayable.
- ✓ **DSL** — Author workflows in YAML, JSON, or TypeScript that compile to one tree shape.
- ✓ **CLI tool** — Drive a workflow from any shell or agent with `next`, `eval`, and `submit`.
- → **STDIO MCP server** — Native protocol for local agents; skip the CLI plumbing.
- … **HTTP MCP server** — Host central workflows any fleet of agents can reach.

> MCP is the [Model Context Protocol](https://modelcontextprotocol.io/) — the wire format agents already speak.

## Dive in

[Get started](/getting-started) · [Discover trees](/registry) · [View on GitHub](https://github.com/flying-dice/abtree)