---
id: 1778362007-eight-bundled-workflows
title: Bundled Trees
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

abtree ships eight ready-to-use behaviour trees in `.abtree/trees/`. Each demonstrates a different combination of primitives and idioms — from the pedagogical (`hello-world`) to the workflow-grade (`technical-writer`, `implement`). Together they exercise every shape the runtime supports: sequence / selector / parallel / action / `$ref` / runtime retries / spec-approved gates / human-approval gates.

## Requirements

- Every bundled tree validates and is listable via `abtree tree list`.
- Each tree's purpose is documented in the tree's `description` field and on the docs site at `/examples`.
- The set covers the canonical combinations of BT primitives and abtree-specific idioms.
- Trees that consume an upstream artefact (an approved spec, an MR diff, etc.) name the prerequisite explicitly in their description and in the examples-page entry.
- Multi-file trees use `$ref` to factor out reusable fragments under `.abtree/trees/fragments/`.

## Bundled trees

| Slug | Demonstrates | Prerequisite |
|---|---|---|
| `hello-world` | All four BT primitives in fifteen lines: a `sequence` root, a `selector` for time-of-day greeting, a `parallel` for context gathering, leaf `action`s. | none |
| `counter-demo` | `$ref` (split across files) plus runtime `retries: 3`. State starts at counter=0, threshold=3; pass 4 wins. Minimal reproduction of the bounded code-then-test idiom. | none |
| `refine` | Spec-authoring workflow: analyse a one-line change request, draft a spec, critique as Staff Engineer, save to `specs/<slug>.md`. Produces a `reviewed_by:` empty draft for codeowner approval. | none |
| `implement` | Implement a feature from an approved spec. Plan → critique → online lookup → optional architect escalation (gated by complexity score) → write code. | refine output (an approved spec) |
| `code-review` | Review an MR for correctness, test coverage, conventions. Three review passes; approves or requests changes via the available review tool. | an MR ref / commit SHA |
| `backend-design` | Design and build a backend service from an approved spec. Architectural critique gates the build. | refine output |
| `frontend-design` | Design and build a frontend component from an approved spec. Aesthetic-direction critique gates the build. | refine output |
| `technical-writer` | Document a topic. Styleguide check (load existing or draft + human approval gate), intent assessment, docs survey, write/review with `retries: 2` (3 total attempts) gated on structure/flow/atomicity. | none (drafts a styleguide if absent) |

## Idioms exercised

| Idiom | Demonstrated by |
|---|---|
| Linear sequence | hello-world (root sequence) |
| if/elif/else via selector | hello-world (Choose_Greeting), refine, implement |
| Concurrent fan-out via parallel | hello-world (Gather_Context) |
| Bounded retries via `retries:` | counter-demo, technical-writer (Write_And_Review) |
| Multi-file split via `$ref` | counter-demo (counter-demo.yaml + fragments/pass.yaml) |
| Spec-approved gate (`reviewed_by` precondition) | implement, backend-design, frontend-design |
| Human-approval gate (`evaluate: $LOCAL.<flag> is true`) | technical-writer (Human_Approval_Gate) |
| Complexity-scored optional escalation | implement (Consult_Opus_If_Complex selector) |

## Technical Approach

### Authoring conventions

All bundled trees follow the rules in `tree-yaml-format.md`:
- Filename and `name` are kebab-case and match.
- Node names are PascalCase with underscores.
- Action steps prefer `evaluate` first as a precondition gate, then `instruct` for the work.
- `$LOCAL` keys and `$GLOBAL` keys are listed in `state` even when they default to `null`.

### Audience targeting

The `description` line on each tree is the entry an LLM sees when pattern-matching a user's request against the available trees. Conventions:

- One sentence, declarative, no trailing period.
- Names the verb ("Document a topic", "Review an MR for correctness", "Design and implement a frontend") so the LLM can match against the user's intent.

### Examples-page documentation

Each tree has a section in `docs/examples.md`:

```
## <Tree name>

<Preamble describing what it does and any prerequisites.>

**Files**
- <main yaml> — main
- <fragment yaml> — sub-workflow (if applicable)

**Install**
```sh
mkdir -p .abtree/trees && curl -fsSL ... -o .abtree/trees/<file>.yaml
```

**Run with Claude**
```sh
claude "Use the abtree <slug> tree to ..."
```
```

The "Run with Claude" snippet is the literal prompt a user can paste into their agent to drive the execution.

### Test coverage

`tests/cases/` exercises the primitives and idioms each bundled tree relies on. Specific bundled trees aren't end-to-end tested individually — that would require seeding the spec/MR prerequisites — but their building blocks are covered. The exception: `hello-world` has its own end-to-end test in `index.test.ts` because it has no prerequisites and exercises all four primitives.

## Affected Systems

- `.abtree/trees/*.yaml` — eight bundled trees.
- `.abtree/trees/fragments/pass.yaml` — single shared fragment for `counter-demo`.
- `docs/examples.md` — per-tree section.
- `AGENT.md` and `SKILL.md` — name the bundled trees in their "available trees" sections.
- `tests/cases/*.yaml` — covers the primitives the trees use.

## Acceptance Criteria

- `abtree tree list` returns every bundled slug.
- `abtree execution create <slug> "smoke"` succeeds for every bundled slug (no validation errors).
- Each tree's `description` field is non-empty and one sentence.
- Each tree has a corresponding section in `docs/examples.md`.
- The four prerequisite-bearing trees (`implement`, `backend-design`, `frontend-design`) name their dependency on `refine` in their examples-page entry.
- The hello-world integration test (`index.test.ts`) drives the `hello-world` tree to `done` status.

## Risks & Considerations

- **Tree-version drift.** The bundled trees evolve; users who copied them locally have a frozen version. There's no migration mechanism. Acceptable; trees are short and re-curl-able.
- **Tree-specific prompt drift.** The `instruct` prose is what the agent does. Phrasing affects quality. There's no automated regression test for prose quality — only the structural test (does the execution advance?). Acceptable trade-off; prose changes are reviewable via diff.
- **Code-review tree's "via the MCP" reference.** Soft suggestion in the instruct rather than a hard dependency. Documented; matches the broader "no MCP today, but the trees can opt in if one is loaded" stance.
- **`refine` produces a spec but doesn't guarantee codeowner approval.** Downstream trees (`implement` etc.) refuse to start unless `reviewed_by` is set, surfacing a clean failure. Documented in the spec-approved-gate idiom.

## Open Questions

- Should there be a "deploy" or "release" tree shipped? Common workflow shape; pattern overlaps with `implement` + post-merge tasks. Defer until a real need surfaces.
- The `refine` tree's spec format is a fixed Markdown template. Should this be parameterisable (e.g. for projects with a different spec template)? Defer; templates can be project-local trees that override the bundled `refine`.
