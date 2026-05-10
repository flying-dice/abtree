# Hands-off cleanup + improve-codebase cycle

## Context

User is going hands-off and wants two distinct passes, in order, each ending in its own commit:

1. **Pre-improvement cleanup**: leave the repo lint-clean and test-clean, then expand the social-style integration test surface (subprocess-driven, behaviour-asserting — NOT change-detector unit tests against internals). The point of the commit before phase 2 is to mark the baseline so the improve-codebase cycle's diff stays interpretable.
2. **improve-codebase cycle**: build the binary, drive `improve-codebase` end-to-end against the full repo, iterating refactors until `Cycle_Verdict → Cycle_Passed`. Commit the result.

User's directives that shape the plan:

- "All clean" includes pre-existing lint debt in `docs/.vitepress/theme/*.vue` and `.claude/settings.local.json`.
- Tests must stay social: drive the CLI as a subprocess, assert observable behaviour. No mocking internals, no asserting on private state.
- Coverage focus: parallel composite, protocol-gate edge cases, selector failure paths, CLI error paths.
- improve-codebase scope is the full repo. The driving agent self-approves both human gates (`scope_confirmed`, `triage_approved`).
- Each phase ends in an explicit commit with a clear "pre-improvement" / "improve-codebase cycle" tag in the message.

## Phase 1 — Cleanup + coverage

### 1a. Lint to zero

Current state (from `bunx biome check`):

- 6 errors / 14 warnings, all outside files this session has touched.
- Autofixable: `.claude/settings.local.json` formatter; unused vars in `AbtreeContrast.vue` (lines 150, 151) and `AbtreeDemo.vue` (lines 265, 268, 271, 274, 390, 423).
- Manual: 7 `noNonNullAssertion` violations in `docs/.vitepress/theme/AbtreeDemo.vue` (lines 362, 363, 364×2, 375×2). Fix by replacing each `frame.X!` with a guard (`if (!frame.X) return;` or `frame.X ?? defaultValue`) — these are inside callbacks where the parent already filters by presence, so the assertion is redundant rather than load-bearing.

Sequence:

1. `bunx biome check --write` (repo-wide) — handles formatter + unused vars.
2. Manually resolve the 7 non-null assertions in `AbtreeDemo.vue`.
3. `bunx biome check` must report 0 errors / 0 warnings.

### 1b. Coverage expansion (social tests only)

All new tests follow the established subprocess pattern. Two seams:

- **Harness specs** (`tests/cases/NN-*.yaml` driving `tests/trees/<slug>/TREE.yaml` fixtures via `tests/harness.ts`) — for tree-walk behaviour.
- **`index.test.ts` integration tests** — for CLI-shape behaviour (errors, gate edges, command surface).

Reuse `tests/harness.ts`'s `runCase()` and `tests/trees-schema.test.ts`'s loader (already validates every fixture) — do not introduce a parallel test driver.

New harness specs and fixtures:

| Spec | Fixture | Behaviour asserted |
|------|---------|--------------------|
| `09-parallel-all-succeed.yaml` | `tests/trees/parallel-basic/TREE.yaml` | Parallel with three child actions; all succeed; tree reaches done. |
| `10-parallel-one-fails.yaml` | `tests/trees/parallel-fails-on-child/TREE.yaml` | Parallel with one gated child that evaluates false; tree ends in failure (parallel = success iff all succeed). |
| `11-selector-first-fails-second-succeeds.yaml` | `tests/trees/selector-first-fails/TREE.yaml` | Selector where first child's evaluate is false and second's instruct succeeds; tree reaches done. |

New integration tests in `index.test.ts` (each spawns the CLI, no internal imports):

- **protocol gate, submit failure** — `next` returns `Acknowledge_Protocol`; `submit failure` yields `protocol_rejected`; subsequent `next` reports the execution as failed (not a fresh gate).
- **protocol gate, submit running** — `submit running` is acknowledged; the next `next` re-emits the same `Acknowledge_Protocol` instruct (idempotent re-ask).
- **next on non-existent execution** — exits non-zero with `Execution '...' not found`.
- **eval on non-existent execution** — exits non-zero with not-found.
- **submit on non-existent execution** — exits non-zero with not-found.
- **execution create with unknown tree slug** — exits non-zero with `Tree '...' not found`.
- **eval when not in evaluating phase** — after acking the protocol gate, `eval <id> true` exits non-zero with `not in evaluating phase`.
- **submit when not in performing phase** — after a gate ack, `submit <id> success` on the next idle phase exits non-zero with `not in performing phase`.
- **local write fallback to string** — `local write <id> note "not-json"` stores the literal string (current `JSON.parse` catch branch in `cmdLocalWrite`); read-back returns it verbatim.
- **global read full scope** — `global read <id>` (no path) returns the seeded `$GLOBAL` object as JSON; with a dot-path it returns the leaf value.

These touch behaviour the project already promises but doesn't pin. Each test spawns `bun index.ts` and asserts on stdout/stderr/exit — same shape as existing tests in `index.test.ts`.

### 1c. Verify + commit

1. `bun test` — expect existing 20 + ~13 new tests, all green.
2. `bunx biome check` — 0 errors, 0 warnings.
3. Commit message:

   ```
   test: pre-improvement coverage expansion + repo-wide lint clean

   Snapshot of test/lint state taken before driving the improve-codebase
   tree against the repo. Adds social integration tests for parallel
   nodes, selector failure paths, protocol-gate edge cases, and CLI
   error surfaces. All harness/subprocess style — no internal mocks.
   ```

## Phase 2 — Build + improve-codebase run

### 2a. Build

```
bun scripts/build.ts
```

Produces `./abtree` (single binary, current platform). Already working — used in this session for smoke testing.

### 2b. Drive improve-codebase end-to-end

Setup (state inputs the tree expects):

```
./abtree execution create improve-codebase "full repo improvement cycle"
# → returns <id>
./abtree local write <id> change_request "improve quality across the entire repo (src/, tests/, docs/, scripts/, .abtree/)"
./abtree global write <id> test_command "bun test"   # writable via direct edit if `global write` not exposed; verify
./abtree next <id>
```

Note: the seeded `$GLOBAL.test_command` value in the tree YAML is descriptive ("the command that runs the project's full regression test suite…") rather than literal. Confirm the actual `bun test` command lands in `$GLOBAL` before `Verify_Baseline` evaluates — if `abtree global write` isn't a CLI command (only `global read` is exposed today), edit the execution doc directly under `.abtree/executions/<id>.json` to set `global.test_command = "bun test"` before resuming. Document the chosen path in the commit message.

Drive the loop autonomously. Self-approval points:

- `Check_Intent.scope_confirmed` → `true` (full-repo scope).
- `Triage_Approval_Gate.triage_approved` → `true` after the agent has reviewed its own triage.

For each refactor item the tree yields:

- Apply changes, write tests if behaviour-changing.
- `Regression_Test` step gates on `bun test` passing.
- `Reassess_Metric` gates on the per-item `current_score >= current_item.threshold` (default 0.7 per metric).
- If an item fails its 2-attempt budget, set `stage_halt = true` only as a last resort; record in `failed_log`.

Termination: `Cycle_Verdict → Cycle_Passed`. If `Cycle_Partial` triggers, that is still a "done" state — the tree is "passing without issues" in the sense that the cycle ran to completion under its own rules. The commit message must surface which verdict landed.

### 2c. Commit

After `abtree next <id>` returns `{"status":"done"}` and `bun test` is green and `bunx biome check` is clean:

```
refactor: improve-codebase cycle on full repo (verdict: <pass|partial>)

Drove .abtree/trees/improve-codebase end-to-end against the repo.
Baseline scores → final scores: <delta per metric>. <N> items applied
from done_log; <M> items in failed_log (if any).
```

## Critical files

- `tests/harness.ts` — reused as the driver for new harness specs.
- `tests/cases/` — new specs land here (numbered after the existing 01–08 series).
- `tests/trees/` — new fixtures land here, each in its own folder per the new layout.
- `index.test.ts` — new integration tests appended to the existing file.
- `docs/.vitepress/theme/AbtreeDemo.vue`, `AbtreeContrast.vue` — manual lint fixes.
- `.abtree/trees/improve-codebase/TREE.yaml` — read-only reference; do not modify the tree itself, only drive it.
- `.abtree/executions/<id>.json` — possibly hand-edited to seed `$GLOBAL.test_command` if no `global write` CLI exists.

## Verification

End of phase 1:

- `bun test` → all green (existing + new).
- `bunx biome check` → 0 errors, 0 warnings.
- `git log -1` → message tagged "pre-improvement".

End of phase 2:

- `./abtree execution get <id>` → `status: complete`.
- `bun test` → still green.
- `bunx biome check` → still clean.
- `git log -1` → message records cycle verdict + delta.
- `git diff <pre-improvement-sha>..HEAD --stat` → makes the improve-codebase cycle's blast radius reviewable.