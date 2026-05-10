---
id: 20260510-hardened-cycle-execute
title: Hands-off cleanup + improve-codebase cycle
status: draft
author: Jonathan Turnock
created: 2026-05-10
reviewed_by:
---

## Summary

Two-phase, hands-off pipeline with one commit per phase. Phase 1 brings the repo to lint-clean and broadens social/integration test coverage (parallel composite, protocol-gate edges, selector failure paths, CLI error paths) without introducing change-detector unit tests; commit message tagged `pre-improvement`. Phase 2 builds the abtree binary and drives `improve-codebase` against the full repo with the driving agent self-approving the two human gates; commit message records the `Cycle_Verdict` outcome and per-metric deltas.

## Requirements

- **Phase 1**
  - `bunx biome check` exits 0 with no errors and no warnings repo-wide.
  - `bun test` exits 0 with the existing 20 tests plus 13 new ones (3 harness specs + 10 integration tests).
  - All new tests drive `bun index.ts` as a subprocess via `tests/harness.ts` or `index.test.ts`. No imports of `src/*` for assertion. No mocks. No reads or writes against private runtime fields.
  - New fixtures land under `tests/trees/<slug>/TREE.yaml`. They must satisfy `tests/trees-schema.test.ts`.
  - HEAD commit message contains the literal token `pre-improvement`.
- **Phase 2**
  - `./abtree` binary built via `bun scripts/build.ts`.
  - `improve-codebase` execution created. `change_request` set to a full-repo scope description. `$GLOBAL.test_command` is treated per the tree's existing convention: a directive read by the agent, not a literal command for the shell. The agent interprets the seeded directive and runs `bun test` against the repo. The `is set` evaluate gate is satisfied by the seeded prose value; no JSON editing of the execution doc.
  - Both human gates (`scope_confirmed`, `triage_approved`) are set to `true` by the driving agent only after it has explicitly stated its scope interpretation and reviewed its own triage. They are not auto-approved on receipt.
  - The tree drives to `{"status":"done"}`. Either `Cycle_Passed` or `Cycle_Partial` is acceptable. The verdict must be surfaced verbatim in the commit message; `Cycle_Partial` is not laundered as a clean pass.
  - After the tree reaches `done`, `bun test` exits 0 and `bunx biome check` exits 0 (post-condition imposed by this plan, beyond what the tree's per-item `Regression_Test` gate already enforces).
  - HEAD commit message records the verdict and per-metric baseline → final score deltas pulled from `$LOCAL.baseline_scores` and `$LOCAL.final_scores`.

## Technical Approach

**Phase 1 — lint to zero**

1. `bunx biome check --write` — handles the formatter pass on `.claude/settings.local.json` and the unused-variable fixables in `docs/.vitepress/theme/AbtreeContrast.vue` and `docs/.vitepress/theme/AbtreeDemo.vue`.
2. Manually rewrite the seven `noNonNullAssertion` violations in `AbtreeDemo.vue` (lines 362, 363, 364x2, 375x2). Each `frame.X!` is inside a callback whose parent already filters on `frame.X` truthiness. Rewrite as `if (!frame.X) return;` guards or `frame.X ?? <default>` so the assertion is structurally unnecessary, not just suppressed. Behaviour must remain observably identical.
3. Re-run `bunx biome check`. Must exit 0 with no errors or warnings.

**Phase 1 — coverage expansion (social only)**

Three new harness specs paired with new fixture trees:

- `tests/cases/09-parallel-all-succeed.yaml` + `tests/trees/parallel-basic/TREE.yaml` — parallel composite with three child actions, all succeed, tree reaches done.
- `tests/cases/10-parallel-one-fails.yaml` + `tests/trees/parallel-fails-on-child/TREE.yaml` — parallel with one gated child whose evaluate is false. Tree fails (parallel = success iff all succeed). Asserts that no short-circuit suppresses the other children.
- `tests/cases/11-selector-first-fails-second-succeeds.yaml` + `tests/trees/selector-first-fails/TREE.yaml` — selector first child evaluates false, second succeeds, tree reaches done. Distinct from existing `04-selector-falls-through.yaml` (which goes A->false, B->false, C->default).

Ten integration tests appended to `index.test.ts`:

1. Protocol gate `submit failure` -> `protocol_rejected`; subsequent `next` reports execution failed (not a re-prompt).
2. Protocol gate `submit running` -> idempotent re-emission of `Acknowledge_Protocol` on next `next`.
3. `abtree next <unknown-id>` exits non-zero with `Execution '...' not found`.
4. `abtree eval <unknown-id> true` exits non-zero with not-found.
5. `abtree submit <unknown-id> success` exits non-zero with not-found.
6. `abtree execution create unknown-slug "x"` exits non-zero with `Tree '...' not found`.
7. `abtree eval` while phase != `evaluating` exits non-zero with `not in evaluating phase`.
8. `abtree submit` while phase != `performing` exits non-zero with `not in performing phase`.
9. `abtree local write <id> note "not-json"` round-trips the literal string through `local read` (exercises `cmdLocalWrite`'s string fallback).
10. `abtree global read <id>` (no path) returns the seeded `$GLOBAL` object as JSON; with a dot-path returns the leaf value.

These pin behaviour the project already promises but does not lock down. Each test spawns the CLI; none reach into `src/*`. Reuses `tests/harness.ts`'s `runCase()` driver and the existing `abtree(...)` spawn helper in `index.test.ts` — no new test framework.

**Phase 2 — improve-codebase drive**

1. `bun scripts/build.ts` produces `./abtree` for the host platform.
2. `./abtree execution create improve-codebase "full repo improvement cycle"`.
3. `./abtree submit <id> success` to clear the protocol-ack gate.
4. `./abtree local write <id> change_request "improve quality across the entire repo (src/, tests/, docs/, scripts/, .abtree/)"`.
5. Drive the tree's evaluate/instruct loop:
   - `Check_Intent`: agent states its scope interpretation, then writes `scope_confirmed = true`.
   - `Verify_Baseline`: `$GLOBAL.test_command` is read; the seeded directive is interpreted as `bun test`; tests run; on green, `baseline_tests_pass = true`.
   - `Score_Quality_Metrics`: four parallel scoring passes write `score_dry`, `score_srp`, `score_coupling`, `score_cohesion`.
   - `Snapshot_Baseline -> Compile_Report -> Critique_Findings -> Lookup_Online -> Triage_Refactor_Queue`: synthesise and refine the queue.
   - `Triage_Approval_Gate`: agent reviews its triage out loud (or to a log), then writes `triage_approved = true`.
   - `Iterative_Refactor`: per-item refactor + regression test + reassessment, retries: 2 per item (3 attempts), retries: 50 outer (50-item cap).
   - `Final_Reassessment -> Cycle_Verdict`: tree picks `Cycle_Passed` or `Cycle_Partial`.
6. After `done`: re-run `bun test` and `bunx biome check`. Both must exit 0.
7. Commit. Message records the literal `Cycle_Verdict` outcome, per-metric `baseline -> final` numbers, and a one-line summary of `done_log` length plus `failed_log` length.

`stage_halt` is the manual brake. Set it only when an item is genuinely unsalvageable inside its 2-attempt budget — not as a shortcut for awkward refactors.

## Affected Systems

**Phase 1**

- `docs/.vitepress/theme/AbtreeContrast.vue`, `docs/.vitepress/theme/AbtreeDemo.vue` — lint cleanup (autofix + manual rewrites of non-null assertions).
- `.claude/settings.local.json` — formatter pass.
- `index.test.ts` — appended integration tests.
- `tests/cases/09-parallel-all-succeed.yaml`, `tests/cases/10-parallel-one-fails.yaml`, `tests/cases/11-selector-first-fails-second-succeeds.yaml` — new harness specs.
- `tests/trees/parallel-basic/TREE.yaml`, `tests/trees/parallel-fails-on-child/TREE.yaml`, `tests/trees/selector-first-fails/TREE.yaml` — new fixture trees.
- `tests/harness.ts`, `tests/trees-schema.test.ts` — reused unchanged.

**Phase 2**

- Diff is data-dependent: determined at runtime by `Triage_Refactor_Queue`. No preflight prediction is committed to the plan.
- `.abtree/executions/<id>.json` — created by `execution create`, mutated by tree progression. Not hand-edited.

## Acceptance Criteria

End of phase 1 (verified before commit):

- `bun test` exits 0; the new tests appear in the run.
- `bunx biome check` exits 0 with `Found 0 errors. Found 0 warnings.`.
- `tests/trees-schema.test.ts` passes — proves the new fixtures are valid.
- `git log -1 --pretty=%B` contains `pre-improvement`.

End of phase 2 (verified before commit):

- `./abtree execution get <id>` returns `status: complete`.
- `bun test` exits 0.
- `bunx biome check` exits 0.
- `git log -1 --pretty=%B` contains the literal `Cycle_Passed` or `Cycle_Partial`, the four-metric `baseline -> final` numbers, and `done_log`/`failed_log` counts.
- `git diff <pre-improvement-sha>..HEAD --stat` makes the cycle's blast radius reviewable as a single change.

## Risks & Considerations

- `Iterative_Refactor`'s outer retries: 50 + per-item retries: 2 is bounded but can drive a lot of edits in one cycle. The outer cap fails closed (queue not drained -> cycle ends in failure) — confirm `done` not `failure` before commit.
- `Cycle_Partial` is a legitimate `done` state. The user phrased phase 2 as "passing without issues"; the runtime definition of done covers both verdicts. The plan resolves this asymmetry by requiring the verdict to be in the commit message verbatim, so a partial outcome cannot be silently shipped as a pass.
- Lint cleanup in `AbtreeDemo.vue` rewrites assertions inside callbacks. The replacement guards must preserve observable behaviour — if a guard would change what the demo renders, prefer a `?? <default>` that reproduces the prior assumed value, and verify by running `bun docs:dev` if any doubt remains.
- Coverage targets exclude `docs author`/`docs schema` and `install skill` deliberately. Pinning their literal output is change-detector territory, which the user has steered away from.
- The `improve-codebase` cycle scoring depends on the agent's metric judgement; two runs with different agents would not produce identical refactor queues. The acceptance criteria gate on tree-level outcomes (verdict, tests green) rather than queue identity.

## Open Questions

None. Lint scope, improve-codebase scope, coverage focus, and gate self-approval were resolved in conversation before this plan was hardened.
