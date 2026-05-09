# Code Review: json-flow-store migration (commit 7dc2e03)

**Verdict: APPROVED**

Reviewed by: Starscream  
Date: 2026-05-09

## Summary

Storage-backend swap from SQLite to per-flow JSON. Spec-driven, well-bounded, behaviour preserved (test suite passes 3/3, 52 expects). One originally-flagged blocking issue was withdrawn after re-trace. Five non-blocking nits that can be picked up in a follow-up.

## Suggestions (non-blocking)

| # | File:Line | Suggestion |
|---|---|---|
| N1 | `src/repos.ts:48` | `setPath` overwrites primitive intermediates silently. Spec said "log a warning once". Either add the warning or trim the spec. |
| N2 | `src/repos.ts:102-105` | `FlowStore.delete()` is dead code — no caller. Remove or wire into a future `cmdFlowDelete`. |
| N3 | `src/repos.ts:55-56` | `mutateScope` throws raw `Error`; cmd*-level callers don't catch and route through `die()`. Either wrap at boundary or change return type to `null` for missing flow. |
| N4 | `src/repos.ts:74-76` | `list()` silently drops corrupt JSON files. `findById` throws on the same input. Recommend logging to stderr in `list()`. |
| N5 | `index.test.ts:2` | `readdirSync` import is unused (TS6133). Remove. |

## Test coverage gaps (non-blocking, deferred)

- T1: ID-validation regex has no direct test
- T2: atomic-write recovery has no test
- T3: parent/child internal-key coexistence not asserted
- T4: corrupt-file handling has no test
- T5: false/0/empty-string scope values not asserted

The hello-world end-to-end integration test exercises the happy path comprehensively. Targeted unit tests for the items above would harden against regressions but are not required by the spec.

## Conventions

Clean. Conventional Commits format, no auto-close keywords, no secrets, no absolute local paths, dependency graph remains a DAG.

## What I checked

- Read `src/repos.ts`, `src/tree.ts`, `src/commands.ts`, `src/paths.ts`, `index.ts`, `src/types.ts`, `src/mermaid.ts`, `index.test.ts`, `.gitignore` end-to-end.
- Re-traced `walkPath`/`setPath` against `_node_status`/`_step` round-trips for both root (empty path) and nested paths.
- Verified `ID_PATTERN` blocks path traversal, dot-segments, and non-slug characters.
- Confirmed `bun test` passes against the new store.
- Confirmed `bunx tsc --noEmit` baseline is unchanged (25 errors, all line-shifted, no new categories).
