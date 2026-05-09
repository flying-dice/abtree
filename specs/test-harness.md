---
id: 1778362004-deterministic-recorded-step-harness
title: Deterministic Test Harness
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

A YAML-driven test harness that exercises the abtree CLI without a live LLM. Each test case is a recorded sequence of expected `next` responses paired with canned `local write` / `submit` / `eval` calls. Cases live in `tests/cases/*.yaml`, fixtures in `tests/trees/`, and the harness in `tests/harness.ts`. One `bun:test` per case is registered automatically by `tests/abtree.test.ts`.

## Requirements

- Tests run via `bun test`. CI invokes the same.
- Each test case is a single YAML file in `tests/cases/`. The file's name (sans extension) becomes the test name.
- A case specifies: the tree to use, optional initial `$LOCAL` state, an ordered list of expected steps + canned responses, and a final assertion (status, optional `$LOCAL`, optional runtime retry counts).
- Trees come from one of two places per case: `bundled: ["fragments/pass.yaml"]` (copy from the repo's `.abtree/trees/`), or `files: { "name.yaml": "..." }` (defined inline in the case YAML), or `tests/trees/<name>.yaml` (shared fixtures).
- The harness builds an isolated workspace per case under `tmpdir()` so cases never touch each other or the repo's real `.abtree/`.
- A failing assertion throws and the bun:test wrapper marks the case failed.

## Technical Approach

### Spec shape

```ts
type TestCase = {
  description?: string;
  tree: string;                                         // tree slug (no .yaml)
  files?:  Record<string, string>;                      // inline files (path → contents)
  bundled?: string[];                                   // copy from .abtree/trees/
  initial?: { local?: Record<string, unknown>; global?: ... };
  steps:    TestStep[];
  final: {
    status:  "done" | "failure";
    local?:  Record<string, unknown>;
    runtime?: { retry_count?: Record<string, number> };
  };
};

type TestStep =
  | { type: "instruct"; name: string; write?: Record<string, unknown>; submit?: ... }
  | { type: "evaluate"; name: string; result: boolean };
```

### Per-case workflow

1. **Workspace.** `mkdtempSync` under tmpdir; create `.abtree/trees/`.
2. **Trees.** Copy `bundled[]` from repo, write `files{}` inline, fall back to `tests/trees/<name>.yaml` if neither names the requested tree.
3. **Flow.** `abtree flow create <tree> "harness"`; capture the returned ID.
4. **Initial state.** For each `initial.local` key, `abtree local write`.
5. **Walk.** For each step:
   - `abtree next <flow>`. Assert the response's `type` and `name` match the spec.
   - On `instruct`: write any `step.write` keys, then `abtree submit <flow> <step.submit ?? "success">`.
   - On `evaluate`: `abtree eval <flow> <step.result>`.
6. **Final.** `abtree next <flow>`. Assert response `status` matches `final.status`.
7. **Final $LOCAL.** Each `final.local` key is read via `abtree local read <flow>` and compared.
8. **Retry counts.** `abtree flow get <flow>` produces the full doc; `runtime.retry_count[path]` is compared against `final.runtime.retry_count`.
9. **Cleanup.** `rmSync(tmp, { recursive: true })` in a `finally` block.

### CLI invocation

`spawnSync("bun", [path/to/index.ts, ...args])` per call. JSON parsing of stdout; stderr surfaced on failure.

The harness deliberately spawns the CLI rather than importing the cmd functions in-process, because it tests the same surface a real agent would drive: argv parsing, flow-id validation, JSON output, exit codes.

### Test registration

```ts
// tests/abtree.test.ts
const casesDir = join(import.meta.dir, "cases");
for (const file of readdirSync(casesDir).sort()) {
  if (!file.endsWith(".yaml")) continue;
  test(file.replace(".yaml", ""), async () => {
    await runCase(join(casesDir, file));
  });
}
```

One `bun:test` per file. Sorting by filename gives deterministic ordering.

### Coverage shipped at v1

| Case | What it asserts |
|---|---|
| `01-sequence-success` | Sequence advances both children, ends `done`. |
| `02-sequence-aborts-on-failure` | False evaluate aborts the parent sequence; flow ends `failure`. |
| `03-selector-first-wins` | First passing branch wins; later branches never evaluated. |
| `04-selector-falls-through` | A→fail, B→fail, C (no evaluate) wins by default. |
| `05-retries-success-on-fourth-attempt` | `retries: 3` retries until counter exceeds threshold; verifies `runtime.retry_count[""] === 3`. |
| `06-retries-exhausted` | All 4 attempts fail; status `failure`; retry counter at 3. |
| `07-ref-resolves-fragment` | Inline-defined split tree; `$ref` to fragment is inlined; both nodes tick correctly. |
| `08-cyclic-ref-fails-cleanly` | Cyclic `$ref`: flow creates without stack overflow; tick on the cyclic edge returns `failure`. |

## Affected Systems

- `tests/harness.ts` — `runCase(specPath)`, helpers, types.
- `tests/abtree.test.ts` — auto-registers one bun:test per `.yaml` in cases/.
- `tests/trees/` — shared fixture trees referenced by name.
- `tests/cases/*.yaml` — test recordings.
- `index.test.ts` — pre-existing hello-world end-to-end integration test, kept alongside.
- `.gitlab-ci.yml` — `test` stage runs `bun test` against both the harness suite and the legacy integration test.

## Acceptance Criteria

- `bun test` runs all cases; every case is one named pass/fail line.
- Adding a new `tests/cases/<n>.yaml` is picked up automatically — no test-registry edits.
- A case with `bundled: ["fragments/pass.yaml"]` pulls the file from `.abtree/trees/` at the repo root.
- A case with `files: { "tree.yaml": "..." }` runs against an inline-defined tree without touching the repo.
- A case asserting `runtime.retry_count[""] === 3` fails when retries don't fire correctly (regression coverage for the retries feature).
- The full suite runs in well under a minute on local hardware (current: ~15 s for 11 tests).

## Risks & Considerations

- **Spawn overhead.** Each case spawns `bun index.ts` for every CLI call (~10–15 calls per case). Adds latency but isolates test failures cleanly. Acceptable for the current case count; if it becomes too slow, the harness could be refactored to import the cmd functions in-process at the cost of test fidelity.
- **YAML drift.** Cases hand-write the expected step `name` field. Renaming a node in a tree requires updating the matching cases. Acceptable; the failures are loud and obvious.
- **No timing assertions.** The harness can't catch "this step took too long" issues — only correctness. abtree itself doesn't have time-sensitive semantics, so this is fine.
- **No multi-flow assertions.** Each case is one flow. Multi-flow scenarios (concurrent flows, list operations) aren't covered. Defer until a real need.

## Open Questions

- Should the harness also assert the mermaid file's contents? Currently we don't — the mermaid is regenerated on every state change but its contents are tested implicitly by render-correctness in the hello-world integration test. A future case could read `<flow-id>.mermaid` and assert specific node colours.
