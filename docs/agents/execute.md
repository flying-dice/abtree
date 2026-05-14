---
title: Execution protocol
description: Contract for an agent driving an abtree execution — the request/response loop, the four response shapes, and the strict read-from-store rule that keeps the gate uncorrupted.
---

# Execution protocol

abtree is a durable behaviour tree engine. Executions bind a tree to a piece of work and persist as JSON documents in `.abtree/executions/`, with two state scopes:

- `$LOCAL` — per-execution blackboard (read/write).
- `$GLOBAL` — world model (read-only).

Internal bookkeeping (cursor, retry counts, per-node status) lives in a `runtime` field on the execution document — invisible to `abtree local read` and not mutable via `abtree local write`. The engine owns it.

::: warning Strict
Never read tree files directly. All interaction goes through this CLI.
:::

## Routing

```text
No arguments         → execution list; resume an existing execution or pick a tree
<execution-id>       → resume that execution
<tree-file-path>     → create a new execution (remaining args = summary)
list                 → show all executions
```

## Create an execution

```text
abtree execution create <path-to-tree-file> <summary>
abtree local write <execution> change_request "<request>"
abtree next <execution>   ← begin execution loop
```

`<path-to-tree-file>` is a literal absolute or relative path to a `.json`, `.yaml`, or `.yml` tree file. No slug lookup, no `package.json` inference — point at the file you want to run.

## Drive the loop

Call `abtree next <execution>` to get the next request. Repeat until done.

### Response: `evaluate`

```json
{ "type": "evaluate", "name": "...", "expression": "..." }
```

Procedure — do **not** skip steps:

1. Parse the expression. Identify every `$LOCAL.<path>` and `$GLOBAL.<path>` it references.
2. For each referenced path, call:

   ```text
   abtree local  read <execution> <path>     (for $LOCAL refs)
   abtree global read <execution> <path>     (for $GLOBAL refs)
   ```

   Record the actual returned value. Do not skip this step even if you wrote the value yourself one command ago.

3. Apply the expression's truth condition against those actual values and only those values. No inference from context, memory, or "obvious" assumptions.
4. Call `abtree eval <execution> true|false [--note "<one sentence>"]`.

::: warning Strict
Skipping step 2 corrupts the gate. The store is the source of truth, not your context. Even when the answer feels obvious, read it.
:::

**Optional: explain your decision.** Pass `--note "<one sentence>"` (CLI) or `note:` (MCP) to record *why* you submitted what you did — name the values from `$LOCAL` / `$GLOBAL` that drove the call. The engine ignores the content; the note is recorded in `execution.trace` for later review of how the agent reasoned through the tree. Skip it on trivial transitions; include it whenever the choice was non-obvious.

### Response: `instruct`

```json
{ "type": "instruct", "name": "...", "instruction": "..." }
```

Procedure:

1. Read the instruction in full.
2. Perform the work named. Use real tools — file I/O, web search, shell commands, sub-agents — as the instruction directs.
3. Write any produced values to `$LOCAL` via `abtree local write`.
4. Call `abtree submit <execution> success|failure|running [--note "<one sentence>"]`. Use `running` only when waiting on something external (a human approval, a long-running tool). Do not use `running` to skip an instruct.

::: warning Strict
Every value written to `$LOCAL` must come from an explicit source named in the instruction (a tool, a command, a `$LOCAL`/`$GLOBAL` path, or a literal fallback). If the source is ambiguous, call `abtree submit <execution> failure`. Do not infer, guess, or invent.
:::

**Optional: explain your decision.** Pass `--note "<one sentence>"` (CLI) or `note:` (MCP) to record what you did and why you marked the action success/failure/running. The note is recorded in `execution.trace` for later review. A `running` note is especially useful — capture *what* you are waiting on. The same field is available on the protocol acknowledgement; a rejection note explains why you walked away from the tree.

### Response: `done` or `failure`

```json
{ "status": "done" }
{ "status": "failure" }
```

Tree terminated. Report the outcome to the human.

## Finding trees

Trees ship as installable node packages — browse [Discover trees](/registry) and `bun add` / `pnpm add` / `npm install` the ones you need, then run them by path to the file they expose, e.g.:

```text
abtree execution create ./node_modules/@abtree/hello-world/main.json "<summary>"
```

Project-local trees can live anywhere in the working tree; pass the path to their `.json`/`.yaml`/`.yml` file directly.

## State commands

```text
abtree local  read  <execution> [path]         Read from $LOCAL
abtree local  write <execution> <path> <val>   Write to $LOCAL
abtree global read  <execution> [path]         Read from $GLOBAL
```

## Reporting (per action)

```text
[execution-id] ✓ Action_Name → success|failure
```
