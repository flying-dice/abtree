---
id: 1778362001-three-scopes-flow-document
title: Runtime State and Execution Document Anatomy
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

An execution's persistent state is a single JSON document at `<EXECUTIONS_DIR>/<execution-id>.json`. The document has three state scopes — `local`, `global`, `runtime` — with strict separation of concerns: `local` is user-writable workflow state, `global` is read-only world data set at creation, `runtime` is the tick engine's internal bookkeeping (cursor position, retry counts, per-node status). The CLI's `local read` / `local write` only ever touch `doc.local`; the runtime field is unreachable from public commands.

## Requirements

- Execution document is one JSON file per execution at `<EXECUTIONS_DIR>/<execution-id>.json`. Atomic write via temp + rename.
- Three scopes: `local`, `global`, `runtime`. Top-level metadata (`id`, `tree`, `summary`, `status`, `snapshot`, `cursor`, `phase`, `created_at`, `updated_at`) sits alongside the scopes.
- `local` is freely read/written by the agent via `abtree local read` / `abtree local write`. Persists across retries and resumption.
- `global` is read-only via the CLI (`abtree global read`). Set once at execution creation from the tree's `state.global` block.
- `runtime` is **internal only**. Never exposed by `local read`, never mutable by `local write`. Holds:
  - `node_status` — `success` / `failure` per node path.
  - `step_index` — cursor within an action's `steps[]`.
  - `retry_count` — times the runtime has consumed a retry on a node with `retries:` config.
- An execution ID matches `^[a-z0-9_-]+__[a-z0-9_-]+__\d+$`. Anything else fails before any file open.
- Reads of legacy execution documents (predating the `runtime` field) lazily migrate `_node_status__*` and `_step__*` keys out of `local` into `runtime`. The migration is idempotent.

## Technical Approach

### Schema

```ts
interface ExecutionDoc {
  id: string;
  tree: string;
  summary: string;
  status: "running" | "complete" | "failed";
  snapshot: string;             // JSON-encoded NormalizedNode tree
  cursor: string;               // JSON-encoded { path: number[]; step: number } | "null" | "[]"
  phase: "idle" | "performing" | "evaluating";
  created_at: string;           // ISO 8601
  updated_at: string;           // ISO 8601
  local:   Record<string, unknown>;
  global:  Record<string, unknown>;
  runtime: RuntimeState;
}

interface RuntimeState {
  node_status: Record<string, NodeStatus>;   // keys: dot-joined paths, e.g. "0", "1.0", "2.1.0"
  step_index:  Record<string, number>;
  retry_count: Record<string, number>;
}
```

### Path encoding in `runtime`

Tree positions are encoded as dot-joined integer arrays. The root path `[]` becomes the empty string `""`. `[0, 1, 2]` becomes `"0.1.2"`. Keys are stored in flat dictionaries — no nested-object walking, unlike `local`'s dot-notation paths which are walked.

### File I/O

- `Bun.file(...).json()` for reads (via `readFileSync` + `JSON.parse` to keep things sync for simpler error handling).
- `writeFileSync(${path}.tmp)` then `renameSync(tmp, path)` for atomic writes — POSIX rename is atomic within the same directory.
- Corrupt JSON throws `Corrupt execution file: ${id}`. `list()` skips corrupt files silently with stderr noise.

### CLI surface

| Command | Touches |
|---|---|
| `abtree local read <execution> [path]` | `doc.local` only |
| `abtree local write <execution> <path> <value>` | `doc.local` only |
| `abtree global read <execution> [path]` | `doc.global` only |
| `abtree execution get <execution>` | Returns the entire document (including `runtime`) — useful for debugging. |
| `abtree next` / `eval` / `submit` | Mutates `runtime`, sets `cursor` / `phase` / `status`. |

The asymmetry between `local read` (scope-locked) and `execution get` (full document) is deliberate: `execution get` is a dump for inspection; `local read` is the operational interface the agent uses inside an execution.

### Retry counter persistence

When a node with `retries: N` fails, the runtime increments `runtime.retry_count[path]` and wipes `runtime.node_status` and `runtime.step_index` keys whose path is `path` itself or a descendant. Retry counts are NOT wiped during the reset — they accumulate across the lifetime of the execution.

### Lazy migration

Execution documents created before the `runtime` field existed have `_node_status__*` and `_step__*` keys mixed in with user data in `local`. On every `readDoc(id)`, if `runtime` is undefined, `migrateRuntime` walks `local`, lifts keys with those prefixes into the new structure, normalises the path encoding (underscores → dots), and writes the result. Idempotent: `runtime` defined → no-op.

## Affected Systems

- `src/types.ts` — `ExecutionDoc`, `RuntimeState`, `NodeStatus`.
- `src/repos.ts` — `ExecutionStore` (lazy `migrateRuntime`, `getRuntime*` / `setRuntime*` helpers, `resetRuntimeSubtree`, `incrementRuntimeRetryCount`).
- `src/tree.ts` — `getNodeResult` / `setNodeResult` / `getStepIndex` / `setStepIndex` route through the runtime helpers; `maybeRetry` reads/writes `retry_count` and triggers `resetRuntimeSubtree`.
- `src/commands.ts` — `cmdLocalRead` / `cmdLocalWrite` / `cmdGlobalRead` only touch `doc.local` / `doc.global`.

## Acceptance Criteria

- Driving any execution to completion: `abtree local read` returns user-written keys only, no `_node_status__*` or `_step__*` leaked.
- `abtree execution get` returns the full document including the `runtime` field.
- A retry-driven execution (e.g. `counter-demo`) shows `runtime.retry_count` populated; `local` shows only user data.
- Loading a legacy execution that has `_node_status__*` keys in `local`: the next read returns `local` without those keys and `runtime.node_status` populated.
- A killed mid-execution can be resumed: cursor / phase / runtime state are all on disk; `abtree next <execution>` picks up where it left off.
- Atomic write resilience: a power loss mid-write leaves either the old file or the new file, never a half-written one (verified by the temp+rename pattern).

## Risks & Considerations

- **Schema drift between releases.** Adding new top-level fields is fine (existing flows ignore them); removing fields would break old flows. Lazy migration is the escape hatch.
- **Path-encoding mismatch.** `local` uses dot-walked nested objects; `runtime` uses flat dot-joined keys. Conflating them in code would break things subtly. Helpers are clearly separated (`getLocal` vs `getRuntimeStatus`).
- **JSON file growth.** Long-running flows accumulate `runtime.node_status` and `step_index` entries proportional to nodes touched. Acceptable for typical tree sizes; would matter at trees with thousands of nodes.
- **Concurrent writes.** Out of scope — flows are single-agent workloads. No file locking.

## Open Questions

None. Schema is stable; lazy migration handles legacy.
