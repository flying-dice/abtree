---
id: 1778362009-content-addressed-snapshot-store
title: Content-Addressed Tree Snapshot Store
status: draft
author: Starscream
created: 2026-05-09
reviewed_by:
---

## Summary

Execution documents currently embed the full JSON-serialised `ParsedTree` in their `snapshot` field, duplicating it for every execution of the same tree. This change introduces a content-addressed snapshot store at `.abtree/snapshots/` where each file is named by the SHA-256 etag of the `ParsedTree` content. Execution documents store only the etag. Identical trees across any number of executions produce exactly one snapshot file.

## Requirements

- New snapshot directory at `SNAPSHOTS_DIR` (default `.abtree/snapshots/`), overridable via `ABTREE_SNAPSHOTS_DIR` using the same `expandHome` + `resolve` pattern as `EXECUTIONS_DIR`. Directory created via `ensureDir(SNAPSHOTS_DIR)` at startup alongside the existing `ensureDir(EXECUTIONS_DIR)` call.
- Snapshot files named `{etag}.json` where `etag` is the lowercase hex SHA-256 of `JSON.stringify(ParsedTree)`.
- `ExecutionRow.snapshot` stores the etag string, not inline JSON. Field name unchanged.
- `TreeSnapshotStore.put(parsed)` is idempotent: if the file exists, return the etag without writing. Writes are atomic (temp + rename).
- `TreeSnapshotStore.get(etag)` throws `Missing snapshot: {etag}` if the file is absent. No silent fallback.
- Snapshot files are never mutated after creation.
- Execution documents with inline JSON in `snapshot` (detected: value starts with `{`) are lazily migrated on first read: extract JSON → compute etag → write snapshot file (if absent) → rewrite execution document with etag only.

## Technical Approach

### Etag computation (`src/snapshots.ts`)

```ts
import { createHash } from "node:crypto";

export function computeEtag(parsed: ParsedTree): string {
  return createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
}
```

`JSON.stringify` order is deterministic here: `ParsedTree` is constructed by `validate.ts` with fixed key-insertion order, and both V8 and Bun preserve insertion order for non-integer string keys. This assumption must be revisited if `ParsedTree`'s structure or the runtime changes.

### `TreeSnapshotStore` API (`src/snapshots.ts`)

```ts
export const TreeSnapshotStore = {
  put(parsed: ParsedTree): string,  // write-if-absent via existsSync, return etag
  get(etag: string): ParsedTree,    // read or throw "Missing snapshot: {etag}"
};
```

`has()` is not part of the public API; existence is checked inside `put()` via `existsSync`.

### Path constant (`src/paths.ts`)

```ts
export const SNAPSHOTS_DIR = process.env.ABTREE_SNAPSHOTS_DIR
  ? resolve(expandHome(process.env.ABTREE_SNAPSHOTS_DIR))
  : join(ABTREE_DIR, "snapshots");
```

### Snapshot callsites in `src/commands.ts`

Four callsites — one write, three reads:

| Callsite | Line | Change |
|---|---|---|
| `cmdExecutionCreate` | 39 | `JSON.stringify(treeDef)` → `TreeSnapshotStore.put(treeDef)` |
| `cmdExecutionReset` | 80 | `JSON.parse(doc.snapshot)` → `TreeSnapshotStore.get(doc.snapshot)` |
| `cmdNext` | 91 | `JSON.parse(doc.snapshot)` → `TreeSnapshotStore.get(doc.snapshot)` |
| `cmdSubmit` | 217 | `JSON.parse(doc.snapshot)` → `TreeSnapshotStore.get(doc.snapshot)` |

`src/tree.ts` has no direct snapshot access; it receives the parsed tree as a parameter from `commands.ts` and requires no changes.

### Lazy migration (`src/repos.ts`)

Appended to `readDoc()` after the existing `migrateRuntime` pass:

```ts
function migrateSnapshot(doc: ExecutionDoc): ExecutionDoc {
  if (!doc.snapshot.startsWith("{")) return doc; // already an etag
  const parsed: ParsedTree = JSON.parse(doc.snapshot);
  const etag = TreeSnapshotStore.put(parsed);
  const migrated = { ...doc, snapshot: etag };
  writeDoc(migrated); // atomic write
  return migrated;
}
```

Order in `readDoc()`: `migrateRuntime` → `migrateSnapshot`. Both are idempotent; this order ensures `migrateSnapshot` always rewrites a fully runtime-migrated document.

## Affected Systems

- `src/paths.ts` — `SNAPSHOTS_DIR` constant; `ensureDir` call.
- `src/snapshots.ts` — new module: `TreeSnapshotStore`, `computeEtag`.
- `src/types.ts` — `ExecutionRow.snapshot` comment updated.
- `src/repos.ts` — `readDoc()` gains `migrateSnapshot` after `migrateRuntime`.
- `src/commands.ts` — four snapshot callsites updated (see table above).
- `src/tree.ts` — no changes required.
- `index.test.ts` — new acceptance tests; `ABTREE_SNAPSHOTS_DIR` override added to test env setup.

## Acceptance Criteria

- Two executions created from the same tree: exactly one file in `.abtree/snapshots/`, two in `.abtree/executions/`.
- Changing tree YAML content and creating a third execution: a second snapshot file appears with a distinct etag.
- Reading an execution whose `snapshot` is inline JSON: read succeeds, snapshot file written, execution document rewritten with etag, subsequent reads return `snapshot` as a 64-character hex string.
- Reading an execution whose snapshot file has been deleted: throws `Missing snapshot: {etag}` with no fallback.
- `abtree execution reset <id>` reinitialises `` correctly via `TreeSnapshotStore.get()`.
- All existing tests pass without modification.
- `ABTREE_SNAPSHOTS_DIR` env override directs the snapshot store to the specified path; test suite sets this to avoid polluting `.abtree/snapshots/`.

## Risks & Considerations

- **Orphaned snapshots.** Deleting an execution document leaves its snapshot file on disk. Not a correctness risk; a future `abtree gc` command can sweep unreferenced files.
- **Canonical JSON stability.** Adding a field to `ParsedTree` changes the etag for future executions. Existing execution documents are unaffected: those still carrying inline JSON are migrated on first read (snapshot store gets the pre-change tree); those already migrated reference their own etag unchanged.
- **Key-order determinism.** The etag depends on `JSON.stringify` producing identical output for structurally identical `ParsedTree` objects. V8 and Bun preserve insertion order for string keys; `validate.ts` constructs `ParsedTree` in a fixed order. A runtime upgrade or change to `validate.ts` key order causes same-content trees to produce different etags — not a data-loss risk, but a storage-efficiency regression (duplicate snapshot files).
- **Test isolation.** The test harness overrides `ABTREE_EXECUTIONS_DIR`. Without a matching `ABTREE_SNAPSHOTS_DIR` override, snapshot files accumulate in the project `.abtree/snapshots/` during test runs. Both overrides must be set in test setup.
- **Concurrent writes.** Two processes calling `put()` for the same etag simultaneously: temp + rename is safe — both copies are identical and the last rename wins.

## Open Questions

- **`abtree execution get` snapshot visibility.** Currently returns the full document including inline snapshot JSON. Post-migration it will return only the etag. The in-scope default is etag-only — consistent with how the field is stored and sufficient for diagnosing which tree version an execution was created against. If inline resolution is needed for debugging, a `--resolve` flag should be filed as a separate follow-up, not bundled here. Codeowner sign-off required before shipping.

