# Spec: JSON Flow Store

Replace the SQLite database with per-flow JSON files in `.abt/flows/`.

## Motivation

SQLite is opaque, binary, and requires a running connection. JSON files are
diffable, committable, and readable without tooling — a better fit for a
repo-local execution store where inspectability matters.

## Current State

Three SQLite tables in `.abt/abt.db`:

| Table | Purpose |
|-------|---------|
| `flows` | Flow metadata: id, tree, summary, status, snapshot, cursor, phase, timestamps |
| `flow_local` | Per-flow key/value local scope |
| `flow_global` | Per-flow key/value global scope |

Accessed via `FlowRepo`, `LocalRepo`, `GlobalRepo` in `src/repos.ts`.
Database initialised in `src/db.ts`.

## Target State

Each flow is a single JSON file at `.abt/flows/{flow-id}.json`.
The mermaid diagram remains at `.abt/flows/{flow-id}.mermaid` (unchanged).
`abt.db`, `abt.db-shm`, `abt.db-wal` are removed entirely.

### Flow file schema

```ts
{
  id:         string           // e.g. "test-run__hello-world__1"
  tree:       string           // tree slug
  summary:    string           // human label
  status:     "running" | "complete" | "failed"
  snapshot:   string           // JSON-serialised tree structure (unchanged)
  cursor:     string           // JSON-serialised cursor (unchanged)
  phase:      "performing" | "evaluating"
  created_at: string           // ISO 8601
  updated_at: string           // ISO 8601
  local:      Record<string, unknown>   // flat or nested — written/read as-is
  global:     Record<string, unknown>
}
```

All fields currently spread across three tables collapse into one document.

## Changes Required

### `src/db.ts` — delete

Remove entirely. No SQLite initialisation, no migrations, no WAL config.
Export only the path constants and `ensureDir` (currently used by mermaid):

```ts
// src/paths.ts  (rename db.ts → paths.ts)
export const TREES_DIR = ".abt/trees";
export const FLOWS_DIR = ".abt/flows";

export function ensureDir(dir: string): void { ... }
```

### `src/repos.ts` — replace

Replace the three SQLite repo classes with a single `FlowStore` that reads
and writes JSON files. Public interface must be a drop-in replacement for the
existing call sites in `commands.ts`.

```ts
// FlowStore replaces FlowRepo + LocalRepo + GlobalRepo

FlowStore.findById(id): FlowDoc | null
FlowStore.list(): FlowDoc[]
FlowStore.countByPrefix(prefix): number
FlowStore.create(doc: Omit<FlowDoc, "created_at" | "updated_at">): FlowDoc
FlowStore.update(id, patch: Partial<FlowDoc>): FlowDoc

// Scope helpers (replaces LocalRepo / GlobalRepo)
FlowStore.getLocal(id, path?): unknown
FlowStore.setLocal(id, path, value): void
FlowStore.getGlobal(id, path?): unknown
FlowStore.setGlobal(id, path, value): void
FlowStore.deleteLocal(id): void
FlowStore.deleteGlobal(id): void
```

`getLocal`/`setLocal` use dot-notation path resolution (same logic as the
current `flattenObject`/value retrieval). Reading with no `path` returns the
entire scope object.

File I/O: read with `Bun.file().json()`, write with `Bun.write()` with
`JSON.stringify(doc, null, 2)`.

### `src/commands.ts` — update imports and call sites

Replace every `FlowRepo.*`, `LocalRepo.*`, `GlobalRepo.*` call with the
equivalent `FlowStore.*` call. No behavioural changes — only the storage
backend changes.

Remove the `initDb()` call in `index.ts`.

### `index.ts` — remove `initDb()`

```diff
-import { initDb } from "./src/db.ts";
+import { ensureDir } from "./src/paths.ts";

-initDb();
+ensureDir(".abt/flows");
+ensureDir(".abt/trees");
```

### `.gitignore` — add SQLite artefacts

```
*.db
*.db-shm
*.db-wal
```

Remove the existing `*.db-shm` / `*.db-wal` entries and consolidate to `*.db`.

### `.abt/abt.db` — remove from repo

```sh
git rm .abt/abt.db
```

The existing `test-run__hello-world__1` flow must be exported to JSON before
the DB is removed (see Migration section below).

## Migration of Existing Data

The committed `abt.db` contains one flow: `test-run__hello-world__1`.
Before deleting the DB, export it to JSON:

1. Read the flow row from `flows` table.
2. Read all rows from `flow_local` for that flow_id.
3. Read all rows from `flow_global` for that flow_id.
4. Reconstruct the `FlowDoc` and write to `.abt/flows/test-run__hello-world__1.json`.

This can be done as a one-shot script (`scripts/migrate-db.ts`) run once
before the DB is removed, or by hand given there is only one flow.

## Out of Scope

- Multi-process safety / file locking. Flows are single-agent workloads; 
  concurrent writes are not a concern.
- Querying flows by field values other than `id`. Current `list` returns all;
  filtering happens in-process.
