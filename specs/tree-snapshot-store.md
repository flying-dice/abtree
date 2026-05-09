---
id: 1778362009-tree-snapshot-store
title: Tree Snapshot Store
status: draft
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

Execution documents embed the full JSON-serialised `ParsedTree` in their `snapshot` field, duplicating the same payload for every execution of the same tree. This change introduces a content-addressed snapshot store at `.abtree/snapshots/`, where each file is named by the lowercase hex SHA-256 etag of the `ParsedTree` content. Execution documents store only the etag. Identical trees across any number of executions produce exactly one snapshot file.

## Requirements

- `SNAPSHOTS_DIR` (default `.abtree/snapshots/`) is overridable via `ABTREE_SNAPSHOTS_DIR` using the same `expandHome` + `resolve` pattern as `EXECUTIONS_DIR`. `ensureDir(SNAPSHOTS_DIR)` is called at startup in `index.ts` alongside the existing `ensureDir(EXECUTIONS_DIR)` and `ensureDir(TREES_DIR)` calls.
- Snapshot files are named `{etag}.json` where `etag` is the lowercase hex SHA-256 of `JSON.stringify(parsed)`.
- `ExecutionRow.snapshot` stores the etag string.
- `TreeSnapshotStore.put(parsed)` is idempotent: short-circuits via `existsSync` if the file already exists; writes are atomic via temp + rename, mirroring `writeDoc` in `src/repos.ts:65-71`.
- `TreeSnapshotStore.get(etag)` throws `Missing snapshot: {etag}` if the file is absent. No silent fallback.
- Snapshot files are immutable post-creation (the etag is the identity).
- Test harness sets `ABTREE_SNAPSHOTS_DIR` alongside `ABTREE_EXECUTIONS_DIR` so test runs do not pollute the project `.abtree/snapshots/` directory.

## Technical Approach

### Etag computation (`src/snapshots.ts`)

```ts
import { createHash } from "node:crypto";
import type { ParsedTree } from "./types.ts";

export function computeEtag(parsed: ParsedTree): string {
  return createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
}
```

`ParsedTree` is `{ local, global, root }` — plain serialisable data, no methods or non-JSON values (`src/types.ts:65-69`). `JSON.stringify` is treated as canonical: `validate.ts` constructs `ParsedTree` in a fixed key-insertion order, and both V8 and Bun preserve insertion order for non-integer string keys. Any change to `ParsedTree`'s shape or to `validate.ts` key order alters the etag for structurally identical trees — a storage-efficiency regression (duplicate snapshot files), not a correctness issue.

### `TreeSnapshotStore` API (`src/snapshots.ts`)

```ts
export const TreeSnapshotStore = {
  put(parsed: ParsedTree): string,  // write-if-absent, return etag
  get(etag: string): ParsedTree,    // read or throw "Missing snapshot: {etag}"
};
```

`has()` is **not** part of the public API. Existence is checked inside `put()`; no caller has a use for `has()` independently.

### Path constant (`src/paths.ts`)

```ts
export const SNAPSHOTS_DIR = process.env.ABTREE_SNAPSHOTS_DIR
  ? resolve(expandHome(process.env.ABTREE_SNAPSHOTS_DIR))
  : join(ABTREE_DIR, "snapshots");
```

### Snapshot callsites in `src/commands.ts`

Four callsites — one write, three reads. `src/tree.ts` has no direct snapshot access; it receives the parsed tree as a parameter from `commands.ts`.

| Callsite | Line | Change |
|---|---|---|
| `cmdExecutionCreate` | 39 | `snapshot: JSON.stringify(treeDef)` → `snapshot: TreeSnapshotStore.put(treeDef)` |
| `cmdExecutionReset` | 80 | `JSON.parse(doc.snapshot)` → `TreeSnapshotStore.get(doc.snapshot)` |
| `cmdNext` | 91 | `JSON.parse(doc.snapshot)` → `TreeSnapshotStore.get(doc.snapshot)` |
| `cmdSubmit` | 217 | `JSON.parse(doc.snapshot)` → `TreeSnapshotStore.get(doc.snapshot)` |

### Directory layout

```
.abtree/
  executions/
    hello-world__hello-world__1.json   ← snapshot: "a3f9..."
    hello-world__hello-world__2.json   ← snapshot: "a3f9..."  (same etag)
    hello-world__hello-world__3.json   ← snapshot: "c71b..."  (different tree version)
  snapshots/
    a3f9<...64 hex chars...>.json      ← ParsedTree JSON
    c71b<...64 hex chars...>.json      ← ParsedTree JSON
```

## Affected Systems

- `src/paths.ts` — add `SNAPSHOTS_DIR`.
- `src/snapshots.ts` — new module: `TreeSnapshotStore`, `computeEtag`.
- `src/types.ts` — `ExecutionRow.snapshot` comment notes the field stores an etag.
- `src/commands.ts` — four snapshot callsites updated (see table).
- `index.ts` — add `ensureDir(SNAPSHOTS_DIR)` at startup.
- `index.test.ts` and `tests/` — add `ABTREE_SNAPSHOTS_DIR` override in test env setup; new acceptance tests covering dedup, distinct etags on tree change, missing-file error, and the reset path.

## Acceptance Criteria

- Two executions created from the same tree: exactly one file in the snapshot directory, two in the execution directory; both execution files reference the same etag.
- Modifying the tree YAML and creating a third execution produces a second snapshot file with a distinct etag.
- Reading an execution whose snapshot file has been deleted: throws `Missing snapshot: {etag}` with no fallback.
- `abtree execution reset <id>` reinitialises `local` correctly via `TreeSnapshotStore.get()`.
- `ABTREE_SNAPSHOTS_DIR` env override directs all reads and writes to the specified path.
- Test suite sets `ABTREE_SNAPSHOTS_DIR` so test runs leave the project `.abtree/snapshots/` directory untouched.
- All existing tests pass without modification beyond the env-override addition.

## Risks & Considerations

- **Orphaned snapshots.** Deleting an execution document leaves its snapshot file on disk. Not a correctness risk; a future `abtree gc` command can sweep unreferenced files.
- **Canonical JSON stability.** Changing `ParsedTree`'s shape or `validate.ts` key order alters the etag for structurally identical trees. Existing snapshot files are unaffected (immutable); new executions of the same tree post-change just produce a new etag and a duplicate snapshot file. Storage-efficiency regression only.
- **Test isolation.** Without an `ABTREE_SNAPSHOTS_DIR` override, snapshot files accumulate in the real project `.abtree/snapshots/` during test runs. Both `ABTREE_EXECUTIONS_DIR` and `ABTREE_SNAPSHOTS_DIR` must be set in test setup.
- **Concurrent writes.** Two processes calling `put()` for the same etag simultaneously: temp + rename is safe — both copies are byte-identical and the last rename wins.

## Open Questions

- **`abtree execution get` snapshot visibility.** The field returns only the etag, which is consistent with how it is stored and sufficient for diagnosing which tree version an execution was created against. If inline resolution is wanted for debugging, a `--resolve` flag should be filed as a separate follow-up, not bundled here.
