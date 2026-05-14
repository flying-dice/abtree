---
description: Five-minute walkthrough to install abtree, hand a behaviour tree to your agent, and watch it drive a workflow end-to-end.
---

# Get started

A five-minute walkthrough: install abtree, hand a tree to your agent, and watch it drive. For the vocabulary behind the moving parts, see [Why behaviour trees?](/concepts/).

::: tip Terms used below
`$LOCAL` is the per-execution blackboard, `instruct` is an action step that asks the agent to do work, and `evaluate` is an action step that asks the agent to judge a precondition. All three are defined in the [Concepts](/concepts/) tier.
:::

## 1. Install abtree

::: code-group

```sh [macOS / Linux]
curl -fsSL https://github.com/flying-dice/abtree/releases/latest/download/install.sh | sh
```

```powershell [Windows]
irm https://github.com/flying-dice/abtree/releases/latest/download/install.ps1 | iex
```

:::

Verify the install:

```sh
abtree --version
```

You see a version number. If you do not, restart your terminal so the new `PATH` takes effect.

## 2. Set up a workspace

```sh
mkdir my-abtree-demo && cd my-abtree-demo
bun add @abtree/hello-world         # or npm/pnpm install
```

`hello-world` is a small tree: classify the time of day, then pick the matching greeting from a four-way selector. It exercises three of the four behaviour-tree primitives — `sequence`, `selector`, and `action` — in a few dozen lines. The package installs the tree file at `node_modules/@abtree/hello-world/main.json`.

## 3. Hand it off to your agent

In Claude Code, ChatGPT, or any agent that runs shell commands, send:

```text
Run the abtree hello-world tree end-to-end. Start by running
'abtree --help' to learn the execution protocol, then create an execution with
'abtree execution create ./node_modules/@abtree/hello-world/main.json "first run"'
and drive it through every step until you see status: done.
```

That is the entire human-side interaction. The agent reads the protocol from `--help`, creates an execution, and drives the loop autonomously.

## 4. Watch the agent drive the loop

Each turn, the agent calls one command and reads its JSON response.

The first `abtree next` on any execution is a runtime-level gate that hands the agent the execution protocol — every execution starts here, regardless of which tree it runs:

```json
{
  "type": "instruct",
  "name": "Acknowledge_Protocol",
  "instruction": "Read the runtime protocol below in full..."
}
```

The agent reads the protocol and acknowledges:

```sh
abtree submit first-run__abtree-hello-world__1 success
```

After the gate, `abtree next` returns the tree's first real step:

```json
{
  "type": "instruct",
  "name": "Determine_Time",
  "instruction": "Check the system clock to get the current hour..."
}
```

The agent does the work — checks the clock, classifies the hour as `morning` — then writes the result and submits:

```sh
abtree local write first-run__abtree-hello-world__1 time_of_day "morning"
abtree submit first-run__abtree-hello-world__1 success
```

The next call returns an `evaluate`:

```json
{
  "type": "evaluate",
  "name": "Morning_Greeting",
  "expression": "$LOCAL.time_of_day is \"morning\""
}
```

The agent reads the expression, decides it holds, and answers:

```sh
abtree eval first-run__abtree-hello-world__1 true
```

The loop repeats — `next` → do the work or judge the precondition → `submit` or `eval` — until:

```json
{ "status": "done" }
```

The agent only ever sees the next request.

## 5. Read the execution diagram

abtree regenerates an SVG diagram at `.abtree/executions/first-run__abtree-hello-world__1.svg` (relative to the cwd you ran `abtree` from) after every state change. Open it in any browser or image viewer; green nodes succeeded, red nodes failed, uncoloured nodes were never ticked.

For the `hello-world` run above, the cursor advanced through the root sequence (`Hello_World` → `Determine_Time` → `Choose_Greeting`) and the selector chose `Morning_Greeting` after its `evaluate` precondition held — the afternoon, evening, and default branches were never entered.

## What that gives you

Your agent drove a structured workflow without a 2,000-line system prompt, without a JSON schema in its context, and without chain-of-thought. The tree handed it exactly one task at a time, and only let it advance when the task was complete.

That is the core idea: **deterministic structure for non-deterministic agents.**

## Next

- [Why behaviour trees?](/concepts/) — the problem they solve.
- [State](/concepts/state) — `$LOCAL` and `$GLOBAL`, the two scopes the runtime exposes.
- [Writing trees](/guide/writing-trees) — author your own tree, step by step.
- [CLI reference](/guide/cli) — every command, every flag.
