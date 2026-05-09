# Getting started

A five-minute walkthrough: install abtree, run the bundled `hello-world` tree, and see the live execution diagram.

## Install

::: code-group

```sh [macOS / Linux]
curl -fsSL https://github.com/flying-dice/abtree/releases/latest/download/install.sh | sh
```

```powershell [Windows]
irm https://github.com/flying-dice/abtree/releases/latest/download/install.ps1 | iex
```

:::

Verify:

```sh
abt --version
```

You'll see a version number. If you don't, restart your terminal so the new `PATH` takes effect.

## Concepts in 60 seconds

Before you run anything, three words worth knowing:

- **Tree** — a YAML file describing a workflow. Lives in `.abt/trees/`.
- **Flow** — one execution of a tree, bound to a piece of work. Persists as JSON in `.abt/flows/`.
- **Step** — the smallest unit. Either an `evaluate` (a precondition the agent confirms) or an `instruct` (work the agent performs).

You drive a flow with three commands: `abt next` to ask "what now?", `abt eval` to answer an evaluate, `abt submit` to acknowledge an instruct. That's the whole loop.

## Run the hello-world tree

`hello-world` is a small workflow that greets a user based on the time of day, then enriches the greeting with weather and news. It demonstrates all four behaviour-tree primitives in fifteen lines.

### 1. Set up a workspace

```sh
mkdir my-abtree-demo && cd my-abtree-demo
mkdir -p .abt/trees
curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abt/trees/hello-world.yaml \
  -o .abt/trees/hello-world.yaml
```

Confirm the tree is visible:

```sh
abt tree list
```

### 2. Create a flow

```sh
abt flow create hello-world "first run"
```

You'll get a flow document back, including an ID like `first-run__hello-world__1`. Save that ID — every subsequent command takes it as the first argument.

### 3. Drive the loop

```sh
abt next first-run__hello-world__1
```

Output:

```json
{
  "type": "instruct",
  "name": "Determine_Time",
  "instruction": "Check the system clock to get the current hour..."
}
```

Do what the instruction says — check the time, classify it as morning/afternoon/evening — then store the result and submit:

```sh
abt local write first-run__hello-world__1 time_of_day "morning"
abt submit first-run__hello-world__1 success
```

Now `abt next` again. You'll get an `evaluate` step asking whether `$LOCAL.time_of_day is "morning"`. Answer:

```sh
abt eval first-run__hello-world__1 true
```

Continue: `next` → do the work / answer the evaluate → `submit` or `eval`. Repeat until you see:

```json
{ "status": "done" }
```

### 4. See what happened

Open `.abt/flows/first-run__hello-world__1.mermaid` in any Mermaid renderer (GitHub renders them inline; VS Code has a preview extension). Every node you reached is **green**. Branches the runtime skipped are **uncoloured**.

The cursor advanced through the sequence. The selector chose the morning branch — the others were never entered. Both context-gathering actions ran in parallel. Every action passed its `evaluate` invariant before its `instruct` ran.

## What just happened

You drove a structured workflow without writing a system prompt, without a JSON schema in your context, without chain-of-thought. The tree handed you exactly one task at a time and only let you advance when you proved you completed it.

That's the core idea: **deterministic structure for non-deterministic agents.**

## Next

- [Why behaviour trees?](/concepts/) — the problem they solve
- [State, branches, and actions](/concepts/state) — how the building blocks fit together
- [Writing your own trees](/guide/writing-trees) — YAML structure walkthrough
- [CLI reference](/guide/cli) — every command, every flag
