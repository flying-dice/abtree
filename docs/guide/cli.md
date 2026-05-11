---
description: Complete CLI reference for abtree — every command outputs JSON, designed to be driven by another agent. Executions, state, install.
---

# CLI reference

Every command outputs JSON. That's deliberate — abtree is meant to be driven by another agent, and JSON is its native input.

## Executions

### `abtree execution create <tree> <summary>`

Create a new execution from a tree. The summary is a human label — kebab-cased, it becomes part of the execution ID.

`<tree>` accepts either of:

- A **slug** that resolves under `.abtree/trees/<slug>/` (project-local) or `~/.abtree/trees/<slug>/` (user-global). The directory must have a `package.json` whose `main` points at the tree YAML; project-local wins on duplicate slugs.
- A **path** — a `.yaml`/`.yml` file, or a directory containing a `package.json` whose `main` points at one. `.` for cwd and absolute paths both work. Use this for repos where the project itself is the tree (`./TREE.yaml`) or to run an installed fragment (`./node_modules/<pkg-name>`).

```sh
$ abtree execution create hello-world "first run"
{
  "id": "first-run__hello-world__1",
  "tree": "hello-world",
  "summary": "first run",
  "local": { ... },
  "global": { ... }
}
```

### `abtree execution list`

List every execution with status and phase.

```sh
$ abtree execution list
[
  {
    "id": "first-run__hello-world__1",
    "tree": "hello-world",
    "summary": "first run",
    "status": "running",
    "phase": "performing"
  }
]
```

### `abtree execution get <execution-id>`

Full execution document: metadata, snapshot, cursor, `$LOCAL`, `$GLOBAL`.

### `abtree execution reset <execution-id>`

Reset an execution to its initial state. Status returns to `running`, all `$LOCAL` keys revert to their tree defaults. Useful for re-running an execution after fixing a tree.

## Execution loop

### `abtree next <execution-id>`

Get the next step. Returns one of:

```json
{ "type": "evaluate", "name": "...", "expression": "..." }
{ "type": "instruct", "name": "...", "instruction": "..." }
{ "status": "done" }
{ "status": "failure" }
```

### `abtree eval <execution-id> <true|false>`

Submit the result of an `evaluate` request. The agent reads the expression, decides whether it holds against current state, and reports back.

### `abtree submit <execution-id> <success|failure|running>`

Submit the result of an `instruct` request.

- `success` advances the cursor.
- `failure` marks the action failed; the runtime backs out by branch rules.
- `running` keeps the execution in performing state — useful when the work takes time and you want to ack-and-continue later.

## State

### `abtree local read <execution-id> [path]`

Read from `$LOCAL`. With no path, returns the whole scope. With a dot-notation path, returns one value.

```sh
$ abtree local read first-run__hello-world__1 greeting
{ "path": "greeting", "value": "Good morning, Alice!" }
```

### `abtree local write <execution-id> <path> <value>`

Write a value at the given path. Values are JSON-parsed when possible — `true`, `42`, `"hello"`, `[1,2,3]` all work.

### `abtree global read <execution-id> [path]`

Read from `$GLOBAL`. Read-only via the CLI.

## Help

### `abtree --help`

Prints the full execution protocol — the same content an LLM driving abtree needs to know. Designed for an agent that runs `--help` first to learn the loop.

## Environment variables

| Variable | Effect |
|---|---|
| `ABTREE_EXECUTIONS_DIR` | Overrides the executions directory. Default: `.abtree/executions/` in the cwd. Accepts absolute paths, relative paths (resolved against cwd), or `~/`-prefixed paths. |

Use `ABTREE_EXECUTIONS_DIR` to keep execution state outside the repo (e.g. on a shared volume), or to point multiple repos at the same execution store:

```sh
export ABTREE_EXECUTIONS_DIR=~/.local/state/abtree-executions
abtree execution list   # all executions across every project, in one place
```

Trees are still loaded from `.abtree/trees/<slug>/` (cwd) and `~/.abtree/trees/<slug>/` (global) when you pass a slug, or from any path you point `execution create` at — only the executions directory is overridable.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | User error (missing execution, invalid input, bad arguments). |

The JSON output is always written to stdout. Errors go to stderr.
