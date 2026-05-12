---
private: true
generated_by: docs-maintainer
generated_at: 2026-05-12 19:30
cycle: 2
---

# Documentation sitemap

Working document for the abtree documentation set. Cycle 2 of the docs-maintainer workflow — the structural changes from cycle 1 have landed; the issues recorded here are the residual findings from the multi-agent review.

## Tier map

### Orientation

- `docs/index.md` — Homepage hero introducing abtree, the four feature pillars, and the core CLI verbs.
- `docs/getting-started.md` — Five-minute walkthrough: install abtree, run the bundled hello-world.
- `docs/motivation.md` — Positions abtree against monolithic skill files; explains why durable execution matters.

### Education

- `docs/concepts/index.md` — Why behaviour trees solve long prompts and non-determinism; names the four primitives.
- `docs/concepts/branches-and-actions.md` — Introduces sequence / selector / parallel / action and defines `tick`.
- `docs/concepts/state.md` — Defines `$LOCAL` and `$GLOBAL` scopes.
- `docs/guide/using-trees.md` — Install a published abtree tree, set up the agent skill, run the workflow.
- `docs/guide/writing-trees.md` — Tutorial: build the bundled `hello-world` tree from scratch.
- `docs/guide/fragments.md` — Split a tree across files using `$ref`.
- `docs/guide/design-process.md` — Ten-step process for designing a new abtree tree from a brief.
- `docs/guide/idioms.md` — Catalogue of reusable shapes.
- `docs/guide/anti-patterns.md` — Shapes that look like idioms but fail in practice.
- `docs/guide/testing.md` — The `@abtree/test-tree` workflow.
- `docs/guide/publishing-a-tree.md` — Package and list a tree on the registry.

### Reference

- `docs/guide/cli.md` — Every abtree CLI command, flag, output, environment variable, exit code.
- `docs/guide/inspecting-executions.md` — Decode the JSON execution document and Mermaid diagram.
- `docs/registry.md` — Catalogue of published behaviour-tree packages.
- `docs/agents/execute.md` — Protocol contract for an agent driving an abtree execution.
- `docs/agents/author.md` — Reference for the YAML field schema.
- `docs/agents/schema.md` — JSON Schema sources, editor integration, CI.

## Per-page detail

### docs/index.md
- Tier: orientation | Scores: clarity 0.95 | impact 1.0 | SRP 0.85
- Issues: none
- Status: stable

### docs/getting-started.md
- Tier: orientation | Scores: clarity 0.95 | impact 0.98 | SRP 0.95
- Issues:
  - R05: uses `$LOCAL`, `instruct`, `evaluate` before the concepts page introduces them — add a one-line gloss on first use, or reorder the sidebar so concepts come first.
- Status: amended

### docs/motivation.md
- Tier: orientation | Scores: clarity 0.95 | impact 0.92 | SRP 0.95
- Issues: none
- Status: stable

### docs/concepts/index.md
- Tier: education | Scores: clarity 0.95 | impact 0.85 | SRP 0.95
- Issues:
  - R18: line 41 "The tree does." anthropomorphises the data structure — rewrite to attribute behaviour to the runtime.
- Status: amended

### docs/concepts/state.md
- Tier: education | Scores: clarity 0.92 | impact 0.85 | SRP 0.85
- Issues:
  - R02: lines 51-53 still describe `abtree local read` / `local write` / `global read` as content rather than a one-line link to `/guide/cli`.
- Status: amended

### docs/concepts/branches-and-actions.md
- Tier: education | Scores: clarity 0.95 | impact 0.9 | SRP 0.95
- Issues:
  - R04: term `tick` is used throughout the site but never defined — add a bolded first-occurrence definition here.
  - R06: Next pointer skips `/guide/using-trees` (the next sidebar page).
- Status: amended

### docs/guide/using-trees.md
- Tier: education | Scores: clarity 0.95 | impact 0.85 | SRP 0.95
- Issues:
  - R11: missing a Next block pointing to `/guide/writing-trees`.
- Status: amended

### docs/guide/writing-trees.md
- Tier: education | Scores: clarity 0.92 | impact 0.85 | SRP 0.95
- Issues:
  - R07: Next pointer jumps to reference tier — should point to `/guide/fragments`.
- Status: amended

### docs/guide/fragments.md
- Tier: education | Scores: clarity 0.95 | impact 0.65 | SRP 0.95
- Issues:
  - R08: Next pointer skips `/guide/design-process` and `/guide/idioms`.
  - R16: line 94 `nerve-wracking` is an idiom — replace with `risky` or `error-prone`.
- Status: amended

### docs/guide/design-process.md
- Tier: education | Scores: clarity 0.9 | impact 0.85 | SRP 0.95
- Issues:
  - R12: lines 8-10 self-referential meta-commentary — rewrite as a Prerequisites callout or drop.
  - R13: line 95 rhetorical questions inside a numbered procedure step.
- Status: amended

### docs/guide/idioms.md
- Tier: education | Scores: clarity 0.7 | impact 0.8 | SRP 0.5
- Issues:
  - R01: Gotchas (239-273) and Naming conventions (324-333) are reference-shaped — extract to anti-patterns page or fold into per-idiom entries; move naming to `agents/author.md`.
  - R14: bold misused as inline section-label headers (lines 40, 42, 44, 75, 92, 94, 196, 204).
  - R15: hedged 'would' conditional on lines 40 and 92.
  - R19: comma inside quote at line 223 (US convention).
  - R20: walls of text at lines 171 and 193.
  - R09: Next pointer skips `/guide/testing`.
- Status: amended

### docs/guide/anti-patterns.md
- Tier: education | Status: amended (new page; extracted from `idioms.md` Gotchas).

### docs/guide/publishing-a-tree.md
- Tier: education | Status: amended (new page; extracted from `registry.md` Submit your own).

### docs/guide/testing.md
- Tier: education | Scores: clarity 0.92 | impact 0.6 | SRP 0.95
- Issues:
  - R17: `pretend mode` bolded twice (lines 8 and 92); first occurrence is correct, strip the second bold.
  - R21: opening sentence at line 8 is a 5-clause run-on — split into 2-3 short sentences.
- Status: amended

### docs/guide/inspecting-executions.md
- Tier: reference | Scores: clarity 0.95 | impact 0.6 | SRP 0.95
- Issues: none
- Status: stable

### docs/guide/cli.md
- Tier: reference | Scores: clarity 0.95 | impact 0.85 | SRP 0.95
- Issues: none
- Status: stable

### docs/registry.md
- Tier: reference | Scores: clarity 0.9 | impact 0.7 | SRP 0.7
- Issues:
  - R03: bundles catalog browsing with publish workflow — split publish steps to a new `/guide/publishing-a-tree.md` and link.
- Status: amended

### docs/agents/execute.md
- Tier: reference | Scores: clarity 0.92 | impact 0.85 | SRP 0.95
- Issues: none
- Status: stable

### docs/agents/author.md
- Tier: reference | Scores: clarity 0.92 | impact 0.7 | SRP 0.95
- Issues: none
- Status: stable

### docs/agents/schema.md
- Tier: reference | Scores: clarity 0.95 | impact 0.5 | SRP 0.95
- Issues:
  - R10: missing a forward Next pointer to `/registry`.
- Status: amended

### docs/agents/author.md (cycle-2 addition)
- Tier: reference | Status: amended — naming conventions table folded in from `idioms.md`.

## Narrative arc

The reader lands on `docs/index.md` for the elevator pitch and crosses to `docs/getting-started.md` for the five-minute first run, with `docs/motivation.md` available as the deeper "why". The education tier starts at `docs/concepts/index.md` (which names the four primitives in one sentence), then `branches-and-actions.md` (which defines `tick` and shows each primitive), then `state.md` (which defines `$LOCAL` / `$GLOBAL`). The guide tier teaches how to use, write, refactor, design, recognise, and test trees in that order. The reference tier — `cli.md`, `inspecting-executions.md`, `registry.md`, and the `agents/*` triple — supports the reader after they ship. Cycle 1 fixed the tier alignment; cycle 2 closes the remaining vocabulary gaps (defining `tick`), the broken Next-pointer chain across the education tier, and a handful of per-page style residuals.
