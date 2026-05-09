# CLI reference

Every command outputs JSON. That's deliberate — abtree is meant to be driven by another agent, and JSON is its native input.

## Trees

### `abt tree list`

Lists every tree in `.abt/trees/`. Returns an array of slugs.

```sh
$ abt tree list
[
  "hello-world",
  "code-review",
  "deploy"
]
```

## Flows

### `abt flow create <tree-slug> <summary>`

Create a new flow from a tree. The summary is a human label — kebab-cased, it becomes part of the flow ID.

```sh
$ abt flow create hello-world "first run"
{
  "id": "first-run__hello-world__1",
  "tree": "hello-world",
  "summary": "first run",
  "local": { ... },
  "global": { ... }
}
```

### `abt flow list`

List every flow with status and phase.

```sh
$ abt flow list
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

### `abt flow get <flow-id>`

Full flow document: metadata, snapshot, cursor, `$LOCAL`, `$GLOBAL`.

### `abt flow reset <flow-id>`

Reset a flow to its initial state. Status returns to `running`, all `$LOCAL` keys revert to their tree defaults. Useful for re-running a flow after fixing a tree.

## Execution loop

### `abt next <flow-id>`

Get the next step. Returns one of:

```json
{ "type": "evaluate", "name": "...", "expression": "..." }
{ "type": "instruct", "name": "...", "instruction": "..." }
{ "status": "done" }
{ "status": "failure" }
```

### `abt eval <flow-id> <true|false>`

Submit the result of an `evaluate` request. The agent reads the expression, decides whether it holds against current state, and reports back.

### `abt submit <flow-id> <success|failure|running>`

Submit the result of an `instruct` request.

- `success` advances the cursor.
- `failure` marks the action failed; the runtime backs out by branch rules.
- `running` keeps the flow in performing state — useful when the work takes time and you want to ack-and-continue later.

## State

### `abt local read <flow-id> [path]`

Read from `$LOCAL`. With no path, returns the whole scope. With a dot-notation path, returns one value.

```sh
$ abt local read first-run__hello-world__1 greeting
{ "path": "greeting", "value": "Good morning, Alice!" }
```

### `abt local write <flow-id> <path> <value>`

Write a value at the given path. Values are JSON-parsed when possible — `true`, `42`, `"hello"`, `[1,2,3]` all work.

### `abt global read <flow-id> [path]`

Read from `$GLOBAL`. Read-only via the CLI.

## Help

### `abt --help`

Prints the full execution protocol — the same content an LLM driving abtree needs to know. Designed for an agent that runs `--help` first to learn the loop.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | User error (missing flow, invalid input, bad arguments). |

The JSON output is always written to stdout. Errors go to stderr.
