# CLI reference

Every command outputs JSON. That's deliberate — abtree is meant to be driven by another agent, and JSON is its native input.

## Trees

### `abtree tree list`

Lists every available tree as an array of slugs.

Trees are loaded from two locations:

| Location | Purpose |
|---|---|
| `.abtree/trees/` (cwd) | Project-local trees, committed alongside the code they apply to. |
| `~/.abtree/trees/` | User-global trees, available in every project. |

Project-local wins on duplicate slugs — drop `~/.abtree/trees/code-review.yaml` for a default review tree, override it per-project by committing a `.abtree/trees/code-review.yaml` to the repo.

```sh
$ abtree tree list
[
  "hello-world",
  "code-review",
  "deploy"
]
```

## Executions

### `abtree execution create <tree-slug> <summary>`

Create a new execution from a tree. The summary is a human label — kebab-cased, it becomes part of the execution ID.

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

Trees are still loaded from `.abtree/trees/` (cwd) and `~/.abtree/trees/` (global) — only the executions directory is overridable.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | User error (missing execution, invalid input, bad arguments). |

The JSON output is always written to stdout. Errors go to stderr.
