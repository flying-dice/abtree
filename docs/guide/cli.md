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

Project-local wins on duplicate slugs — drop `~/.abtree/trees/code-review.yaml` for a default review flow, override it per-project by committing a `.abtree/trees/code-review.yaml` to the repo.

```sh
$ abtree tree list
[
  "hello-world",
  "code-review",
  "deploy"
]
```

## Flows

### `abtree flow create <tree-slug> <summary>`

Create a new flow from a tree. The summary is a human label — kebab-cased, it becomes part of the flow ID.

```sh
$ abtree flow create hello-world "first run"
{
  "id": "first-run__hello-world__1",
  "tree": "hello-world",
  "summary": "first run",
  "local": { ... },
  "global": { ... }
}
```

### `abtree flow list`

List every flow with status and phase.

```sh
$ abtree flow list
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

### `abtree flow get <flow-id>`

Full flow document: metadata, snapshot, cursor, `$LOCAL`, `$GLOBAL`.

### `abtree flow reset <flow-id>`

Reset a flow to its initial state. Status returns to `running`, all `$LOCAL` keys revert to their tree defaults. Useful for re-running a flow after fixing a tree.

## Execution loop

### `abtree next <flow-id>`

Get the next step. Returns one of:

```json
{ "type": "evaluate", "name": "...", "expression": "..." }
{ "type": "instruct", "name": "...", "instruction": "..." }
{ "status": "done" }
{ "status": "failure" }
```

### `abtree eval <flow-id> <true|false>`

Submit the result of an `evaluate` request. The agent reads the expression, decides whether it holds against current state, and reports back.

### `abtree submit <flow-id> <success|failure|running>`

Submit the result of an `instruct` request.

- `success` advances the cursor.
- `failure` marks the action failed; the runtime backs out by branch rules.
- `running` keeps the flow in performing state — useful when the work takes time and you want to ack-and-continue later.

## State

### `abtree local read <flow-id> [path]`

Read from `$LOCAL`. With no path, returns the whole scope. With a dot-notation path, returns one value.

```sh
$ abtree local read first-run__hello-world__1 greeting
{ "path": "greeting", "value": "Good morning, Alice!" }
```

### `abtree local write <flow-id> <path> <value>`

Write a value at the given path. Values are JSON-parsed when possible — `true`, `42`, `"hello"`, `[1,2,3]` all work.

### `abtree global read <flow-id> [path]`

Read from `$GLOBAL`. Read-only via the CLI.

## Help

### `abtree --help`

Prints the full execution protocol — the same content an LLM driving abtree needs to know. Designed for an agent that runs `--help` first to learn the loop.

## Environment variables

| Variable | Effect |
|---|---|
| `ABTREE_FLOWS_DIR` | Overrides the flows directory. Default: `.abtree/flows/` in the cwd. Accepts absolute paths, relative paths (resolved against cwd), or `~/`-prefixed paths. |

Use `ABTREE_FLOWS_DIR` to keep flow state outside the repo (e.g. on a shared volume), or to point multiple repos at the same flow store:

```sh
export ABTREE_FLOWS_DIR=~/.local/state/abtree-flows
abtree flow list   # all flows across every project, in one place
```

Trees are still loaded from `.abtree/trees/` (cwd) and `~/.abtree/trees/` (global) — only the flows directory is overridable.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | User error (missing flow, invalid input, bad arguments). |

The JSON output is always written to stdout. Errors go to stderr.
