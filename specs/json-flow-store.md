---
id: 1778332214-quiet-sqlite-evict
title: JSON Flow Store
status: accepted
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

Replace the SQLite database (`.abt/abt.db`) with one JSON document per flow at `.abt/flows/{flow-id}.json`. SQLite is binary, opaque, and requires init; JSON files are diffable, committable, and readable with `cat`. Storage is the only thing that changes — execution semantics, the public CLI, and the mermaid diagram pipeline are untouched.

## Requirements

- One flow → one JSON file at `.abt/flows/{flow-id}.json`. Schema:
  ```ts
  {
    id: string
    tree: string
    summary: string
    status: "running" | "complete" | "failed"
    snapshot: string          // JSON-encoded tree (kept as string — no semantic change)
    cursor: string            // JSON-encoded cursor (kept as string — no semantic change)
    phase: "performing" | "evaluating"
    created_at: string        // ISO 8601
    updated_at: string        // ISO 8601, refreshed on every write
    local: Record<string, unknown>   // nested object, dot-notation paths walk it
    global: Record<string, unknown>
  }
  ```
- The mermaid file at `.abt/flows/{flow-id}.mermaid` continues to regenerate on every state change. Behaviour unchanged.
- A single `FlowStore` exposes the union of today's `FlowRepo` + `LocalRepo` + `GlobalRepo` interface. Call sites in `src/commands.ts`, `src/tree.ts`, `src/mermaid.ts` change only by import name and method name.
- `setLocal(id, path, value)` writes `value` at the dot-notation `path` into `local` (nested object), creating intermediate objects as needed. `getLocal(id, path)` walks the same path and returns the leaf, or `null` if any segment is missing. Same semantics for `global`.
- `getLocal(id)` (no path) returns the entire `local` object as-is. Same for `global`.
- `update(id, patch)` shallow-merges `patch` into the top-level fields only. Fields `local` and `global` are replaced wholesale if present in `patch`; piecewise mutations to those scopes go through `setLocal`/`setGlobal`.
- `initDb()` is removed from `index.ts`. On startup, `index.ts` calls `ensureDir(FLOWS_DIR)` and `ensureDir(TREES_DIR)`.
- The committed flow `test-run__hello-world__1` is exported to JSON before the SQLite database is deleted. Final values must be byte-equivalent to the prior database contents.
- `.abt/abt.db`, `.abt/abt.db-shm`, `.abt/abt.db-wal` no longer exist on disk or in the repo. `.gitignore` consolidates them under `*.db`.
- `bun:sqlite` is no longer imported anywhere in `src/` or `index.ts`.

## Technical Approach

1. **Rename `src/db.ts` → `src/paths.ts`.** Keep `TREES_DIR`, `FLOWS_DIR`, `ensureDir`. Drop `initDb`, the migrations array, the `Database` import, the WAL config.

2. **Replace `src/repos.ts`.** Single `FlowStore` object with static methods. Methods map 1:1 onto the existing surface so call sites are renames, not rewrites:
   | Old | New |
   |---|---|
   | `FlowRepo.findById(id)` | `FlowStore.findById(id)` |
   | `FlowRepo.listAll()` | `FlowStore.list()` |
   | `FlowRepo.countByPrefix(prefix)` | `FlowStore.countByPrefix(prefix)` |
   | `FlowRepo.create(doc)` | `FlowStore.create(doc)` |
   | `FlowRepo.update(id, patch)` | `FlowStore.update(id, patch)` |
   | `LocalRepo.getAll(id)` | `FlowStore.getLocal(id)` |
   | `LocalRepo.getValue(id, path)` | `FlowStore.getLocal(id, path)` |
   | `LocalRepo.setValue(id, path, v)` | `FlowStore.setLocal(id, path, v)` |
   | `LocalRepo.bulkSet(id, data)` | `FlowStore.replaceLocal(id, data)` |
   | `LocalRepo.deleteAll(id)` | `FlowStore.deleteLocal(id)` |
   | (same for global) | (same for global) |

   File I/O: `Bun.file(path).json()` for reads, `Bun.write(path, JSON.stringify(doc, null, 2))` for writes. Each mutation reads the file, mutates the in-memory document, refreshes `updated_at`, and writes the whole file back. `findById` returns `null` if the file does not exist (catch `ENOENT`).

   Path walking: a tiny `walkPath(obj, "a.b.c")` returns `obj?.a?.b?.c ?? null`. A `setPath(obj, "a.b.c", value)` creates intermediate `{}` along the way.

   `list()` reads `.abt/flows/*.json` via `fs.readdirSync` (or `Bun.Glob`), parses each, and returns the array. `countByPrefix` filters that array client-side.

3. **Update call sites.** Mechanical renames in `src/commands.ts`, `src/tree.ts`, `src/mermaid.ts`. Run `bunx tsc --noEmit` to find anything missed.

4. **Update `index.ts`.** Drop `import { initDb } from "./src/db.ts"`, drop `initDb()`, add `ensureDir(FLOWS_DIR); ensureDir(TREES_DIR);` from `./src/paths.ts`.

5. **Migrate the one existing flow.** Inline the export — no separate script. Open `abt.db` with `bun:sqlite` once, read the row from `flows`, the rows from `flow_local` / `flow_global`, assemble a `FlowDoc`, write to `.abt/flows/test-run__hello-world__1.json`. Done in the same commit that deletes the DB. The migration is run by hand from the commit author's machine — the repo never ships migration code.

6. **`.gitignore`.** Replace the two-line block:
   ```
   *.db-shm
   *.db-wal
   ```
   with:
   ```
   *.db
   *.db-shm
   *.db-wal
   ```
   (Keep all three: a future flow file at `something.db` is unlikely, but consolidating to `*.db` would mask `abt.db` if it ever got recreated by an old binary, so all three explicit lines stay.)

## Affected Systems

- `src/db.ts` → renamed to `src/paths.ts`, body shrunk
- `src/repos.ts` → fully replaced
- `src/commands.ts` → import + call site updates
- `src/tree.ts` → import + call site updates
- `src/mermaid.ts` → import + call site updates
- `index.ts` → drop `initDb`, add `ensureDir` calls
- `.gitignore` → add `*.db`
- `.abt/abt.db`, `.abt/abt.db-shm`, `.abt/abt.db-wal` → deleted
- `.abt/flows/test-run__hello-world__1.json` → new

## Acceptance Criteria

- `grep -r "bun:sqlite\|from.*db\.ts" src/ index.ts` returns no matches.
- `find .abt -name "*.db*"` returns no matches.
- `.abt/flows/test-run__hello-world__1.json` exists and its `local`, `global`, `cursor`, `phase`, `status`, `snapshot` fields match what `cmdFlowGet` returned for that flow before the migration. Captured pre-migration via `bun index.ts flow get test-run__hello-world__1 > /tmp/before.json` and verified field-by-field after.
- `bun test` passes — the existing hello-world integration test runs end-to-end against the JSON store.
- `bunx tsc --noEmit` produces no new diagnostics relative to current main.
- Running `bun index.ts flow create hello-world "smoke"` then advancing through one `next` / `submit success` cycle updates both `.abt/flows/{id}.json` and `.abt/flows/{id}.mermaid`.

## Risks & Considerations

- **Partial writes on crash.** A non-atomic `Bun.write` could truncate a JSON file if the process is killed mid-write. Acceptable: out-of-scope per the original spec, no production deployment, no concurrent writers. Mitigation deferred until a real loss event occurs.
- **Path semantics shift from flat to nested.** Today's `flattenObject` stores `{a: {b: 1}}` as a flat row `("a.b", 1)`. The JSON store stores it nested. `getLocal/setLocal` must walk paths through the nested structure. Covered by the existing hello-world integration test, which already exercises both the read and write paths.

## Open Questions

- None. Single-author repo, integration test gives a behavioural backstop, migration touches one flow with known expected values.
