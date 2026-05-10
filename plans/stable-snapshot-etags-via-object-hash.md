---
id: 1778371337-stable-etag-via-object-hash
title: Stable Snapshot Etags via object-hash
status: draft
author: Jonathan Turnock
created: 2026-05-10
reviewed_by: Jonathan Turnock
---

## Summary

Replace the JSON.stringify-based sha256 etag in `src/snapshots.ts` with the `object-hash` library, which sorts object keys recursively before hashing. This eliminates the latent bug where two `ParsedTree` values that are deeply equal can produce different etags depending on the property insertion order of the in-memory representation. The on-disk snapshot store layout is unchanged; only the algorithm producing the filename changes.

## Requirements

- `computeEtag(parsed)` returns the same 64-char lowercase hex string for any two `ParsedTree` values that are deep-equal, where deep-equality means: the same scalar field values, the same `children` arrays in the same order, and the same set of object keys at every level — independent of the key insertion order in either object literal.
- The on-disk layout (`<SNAPSHOTS_DIR>/<etag>.json`) and the public `TreeSnapshotStore.put` / `TreeSnapshotStore.get` signatures are unchanged.
- The three existing snapshot-store tests in `index.test.ts` (etag matches `/^[0-9a-f]{64}$/`, two executions of the same tree share one snapshot file, deleting the snapshot file makes reads fail) all pass without edits to their assertions.
- A new test asserts key-order invariance: two `ParsedTree` literals with identical content but different top-level key ordering produce the same etag.

## Technical Approach

1. **Add the dependency.** Add `object-hash` to `dependencies` in `package.json`. The package ships its own typings (`index.d.ts`) since v3, so `@types/object-hash` is not needed. Pin a version (e.g. `^3.0.0`); `bun install` updates `bun.lock`.
2. **Swap the implementation in `src/snapshots.ts`.**
   - Remove `import { createHash } from "node:crypto"`.
   - Add `import objectHash from "object-hash"`.
   - Replace `computeEtag`'s body with `return objectHash(parsed, { algorithm: "sha256", encoding: "hex" })`. Function signature `(parsed: ParsedTree): string` is unchanged.
3. **No call-site edits.** `TreeSnapshotStore.put` / `.get` are unchanged. `commands.ts` (4 sites) and `mermaid.ts` (1 site) treat the etag as opaque.
4. **Add the invariance test.** Append one test to `index.test.ts` that imports `computeEtag` directly from `src/snapshots.ts`, builds two minimal `ParsedTree` objects with reordered top-level keys (`{ local, global, root }` vs `{ root, global, local }`), and asserts equal etags. No CLI subprocess required.

## Affected Systems

- `src/snapshots.ts` — `computeEtag` body and imports.
- `package.json` (and `bun.lock`, regenerated) — new runtime dependency.
- `index.test.ts` — one new test case for key-order invariance.

## Acceptance Criteria

- `bun install` exits 0 with `object-hash@^3` resolved in `bun.lock`.
- `grep -n "createHash" src/snapshots.ts` returns no matches; `grep -n "object-hash" src/snapshots.ts` returns one import line.
- `bun test` passes. The three pre-existing snapshot-store tests in `index.test.ts` are green without modification (etag-format regex, snapshot-sharing, missing-snapshot-error).
- The new key-order-invariance test passes.
- `bun run scripts/build.ts` (single-target) produces a working binary (smoke check that `object-hash` bundles into the compiled output).

## Risks & Considerations

- **Etag values change for any user with on-disk state.** Existing executions whose persisted `snapshot` field references a previous etag will fail on the next tick with the existing `Missing snapshot: <etag>` error. This is the same error path already covered by the snapshot-deletion test, so behaviour is well-defined; no silent corruption is possible. Action: mention the snapshot-cache invalidation in the release notes.
- **Performance.** `object-hash` walks the object rather than calling `JSON.stringify`. For the trees in this repo (largest fully-resolved snapshot is well under 100 KB) this is negligible and not worth benchmarking.
- **Supply chain.** `object-hash` is small, widely used, MIT-licensed, with no runtime dependencies.

## Open Questions

None.
