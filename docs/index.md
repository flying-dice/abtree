---
layout: home
title: abtree — Behaviour Trees for AI Agents and Agentic Workflows
titleTemplate: false
description: Replace the skill file you hope your agent reads with a behaviour tree the runtime walks. abtree is an open-source runtime for AI agents — deterministic, durable, resumable, and driven from a CLI that works with Claude, ChatGPT, or any shell-capable agent.

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
      link: /concepts/
---

## Two steps.<br>Or twenty.

Whether you split your workflow into two coarse phases or twenty fine-grained checks, abtree treats each node the same. The runtime walks; the agent receives whatever instruction sits at the cursor.

<AbtreeContrast />

## New attention,<br>not new prompts.

Whether you're driving a five-step refactor or a hundred-step audit, today's agents read the whole skill file once and lose the rest to drift. abtree replaces it with a behaviour tree — a structure the runtime walks node by node. The agent only ever sees the next step. The plan stays in the tree, not in the prompt.

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

## One instruction.<br>At a time.

Whether the workflow is two steps or two hundred, abtree hands the agent a single request — `evaluate` this statement, or follow this `instruct`. The cursor advances only when the runtime is satisfied. Every move writes to disk. Context never accumulates. Attention never fades.

<AbtreeDemo />

## Every state change<br>is observible.

Whether you're auditing a passing run or chasing a stuck one, abtree regenerates a visual diagram after every cursor move. Green nodes ran and succeeded. Red nodes ran and failed.
<div class="hide-on-touch">

<TreeSvg src="/example.svg" :height="520" />

</div>

## YAML. JSON.<br>TypeScript.

Whether you prefer hand-authored data or code first, abtree compiles all three into the same tree shape. The TypeScript DSL gives composability and IDE support; YAML and JSON give the no-build path.

<AbtreeDsl />

## Trees ship<br>like libraries.

Whether you publish to npm, share through GitHub, or drop a tarball, abtree never sees the transport. Bring your own tooling. Point the runtime at a JSON or YAML file and it walks the tree.

<InstallDemo />

## Hand it<br>to your agent.

Whether you drive abtree from Claude Code, ChatGPT, or any shell-capable agent, the brief is the same. Paste it. The agent reads the runtime protocol with `abtree --help`, creates an execution, and walks the tree until the status is done. You watch.

```text
Run the @abtree/srp-refactor workflow against this repo.

First read the runtime protocol:
  abtree --help

Then create an execution and drive it:
  abtree execution create ./node_modules/@abtree/srp-refactor \
    "Refactor the worst SRP violation in src/"

Step through every prompt with `abtree next`, `abtree eval`, and
`abtree submit` until status: done.
```

For the long-form walkthrough — install the CLI, add a tree, drive it from your agent — see [Get started](/getting-started).

## The same model.<br>From laptop to fleet.

Whether one developer runs it locally or a fleet of agents drives thousands of workflows in parallel, the engine, DSL, and protocol stay the same. MCP is the [Model Context Protocol](https://modelcontextprotocol.io/) — the wire format agents already speak.

- ✓ **Core engine** — Deterministic execution, one step at a time. Resumable and replayable.
- ✓ **DSL** — Author workflows in YAML, JSON, or TypeScript that compile to one tree shape.
- ✓ **CLI tool** — Drive a workflow from any shell or agent with `next`, `eval`, and `submit`.
- → **STDIO MCP server** — Native protocol for local agents; skip the CLI plumbing.
- … **HTTP MCP server** — Host central workflows any fleet of agents can reach.

## Dive in.

[Get started](/getting-started) · [Discover trees](/registry) · [View on GitHub](https://github.com/flying-dice/abtree)