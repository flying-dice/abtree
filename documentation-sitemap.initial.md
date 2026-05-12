---
private: true
generated_by: docs-maintainer
generated_at: 2026-05-12 17:30
---

# Documentation sitemap

This is the docs-maintainer's working document for the abtree documentation set. It is private — not a published page — and is overwritten on every Build_Sitemap pass and amended inline as Apply_Suggestions runs.

## Tier map

### Orientation (top-level pages)

- `docs/index.md` — Homepage hero introducing abtree, the four feature pillars, and the core CLI verbs.
- `docs/getting-started.md` — Five-minute walkthrough: install abtree, run the bundled hello-world, see the diagram.
- `docs/motivation.md` — Positions abtree against monolithic skill files; explains durable execution.

### Education (guides and conceptual explainers)

- `docs/concepts/index.md` — Why behaviour trees solve long prompts and non-determinism; structural separation of what / when.
- `docs/concepts/branches-and-actions.md` — Introduces the sequence / selector / parallel / action primitives and how the runtime walks them.
- `docs/guide/writing-trees.md` — Step through the YAML schema: layout, fields, state, composites, action shape, retries, naming, worked example, validation.
- `docs/guide/using-trees.md` — Install a published abtree tree, set up the agent skill, run the workflow.
- `docs/concepts/state.md` — Define the two state scopes (`$LOCAL` and `$GLOBAL`) and the CLI commands that read and write them.
- `docs/guide/fragments.md` — Split a tree across files using `$ref`; resolution semantics, cycles, refactor workflow.
- `docs/guide/designing-workflows.md` — Reference material for an LLM helping a human design a new abtree tree.
- `docs/guide/testing.md` — The `@abtree/test-tree` workflow: spec format, fixtures, pretend mode, running a test, the REPORT artefact.

### Reference (lookup pages)

- `docs/guide/cli.md` — Enumerate every abtree CLI command, flag, output shape, environment variable, exit code.
- `docs/registry.md` — Searchable catalog of published behaviour-tree packages with submission instructions.
- `docs/agents/execute.md` — Protocol contract for an agent driving an abtree execution.
- `docs/guide/inspecting-executions.md` — Decode the JSON execution document and Mermaid diagram; field reference; debug a stuck execution.
- `docs/agents/author.md` — Reference for an agent authoring a tree.
- `docs/agents/schema.md` — Point at the canonical JSON Schema sources; editor integration; CI validation.

## Per-page detail

### docs/index.md
- Tier: orientation
- Purpose: Homepage hero introducing abtree, the four feature pillars, and the core CLI verbs.
- Audience: new user, evaluator
- Scores: clarity 0.85 | impact 1.0 | SRP 0.75
- Issues:
  - Title case drift in feature card titles vs STYLEGUIDE.md sentence-case rule.
  - Scare-quoted phrase 'jumping ahead' violates Microsoft style.
  - 'the cursor remembers' anthropomorphises the runtime (STYLEGUIDE.md line 94).
  - Rhetorical-question heading 'What is abtree?' violates style.
  - Product positioning drift: 'CLI tool' here vs 'runtime' in motivation.md.
  - 'Author in TypeScript' block introduces a surface not covered elsewhere.
  - Decorative emoji in footer violates STYLEGUIDE.md.
  - Feature cards not parallel in construction.
- Status: pending

### docs/getting-started.md
- Tier: orientation
- Purpose: Five-minute walkthrough: install abtree, run hello-world, see the diagram.
- Audience: new user
- Scores: clarity 0.8 | impact 0.98 | SRP 0.65
- Issues:
  - 'Concepts in 60 seconds' duplicates `/concepts/*` content — tier creep.
  - Page mixes install + concepts + tutorial + debrief — SRP-low.
  - Bold on 'CLI' violates first-occurrence-only bold rule.
  - Past-tense heading 'What just happened' breaks present-tense rule.
  - Numbered sequence 1-4 then unnumbered headings breaks rhythm.
  - Long inlined mermaid block could be replaced with the existing SVG.
- Status: pending

### docs/motivation.md
- Tier: orientation
- Purpose: Positions abtree against monolithic skill files; explains durable execution.
- Audience: new user, evaluator
- Scores: clarity 0.92 | impact 0.92 | SRP 0.85
- Issues:
  - 'It won't.' anthropomorphises and reads as commentary.
  - Blockquote-as-callout pattern inconsistent with rest of site.
  - 'Why durable execution matters' duplicates `/index.md` content.
  - No 'Next' link section — every other orientation page has one.
- Status: pending

### docs/concepts/index.md
- Tier: education
- Purpose: Why behaviour trees solve long prompts and non-determinism; structural separation of what / when.
- Audience: new user, integrator
- Scores: clarity 0.9 | impact 0.85 | SRP 0.9
- Issues:
  - Idiom-ish 'a liability', 'starts to'.
  - Coinage 'instruction fatigue' undefined and unused elsewhere.
  - Em-dash misuse line 42.
  - Page doesn't name the four primitives — readers must click two links to see sequence / selector / parallel / action.
- Status: pending

### docs/concepts/state.md
- Tier: education
- Purpose: Define `$LOCAL` and `$GLOBAL` scopes and the CLI commands that read and write them.
- Audience: new user, integrator
- Scores: clarity 0.88 | impact 0.85 | SRP 0.6
- Issues:
  - SRP mismatch: concept + CLI reference in one page — strip to one example or link out.
  - No contrasting transition between `$LOCAL` and `$GLOBAL` definitions.
  - Italics on 'set' inconsistent with markdown conventions.
  - 'sees a sentence' anthropomorphises.
  - Colloquial 'bites'.
  - 'world model' introduced but not propagated.
  - Final 'Next' doesn't backlink to `/concepts/`.
- Status: pending

### docs/concepts/branches-and-actions.md
- Tier: education
- Purpose: Introduce sequence / selector / parallel / action primitives and how the runtime walks them.
- Audience: new user, integrator
- Scores: clarity 0.92 | impact 0.88 | SRP 0.75
- Issues:
  - 'How the loop runs' is reference-flavoured — belongs in `/guide/cli` or a runtime page.
  - Two-beat marketing pacing slightly out of register.
  - Placeholder shorthand `{ Morning_Greeting }` is not valid YAML and undefined.
  - Voice slips between addressing the agent and describing the runtime.
  - Stray marketing fragment 'Reproducible execution.'.
  - Phrasing drift with `/guide/designing-workflows.md`.
  - No mention of `retries:` despite being treated as first-class elsewhere.
- Status: pending

### docs/guide/using-trees.md
- Tier: education
- Purpose: Install a published abtree tree, set up the agent skill, run the workflow.
- Audience: integrator
- Scores: clarity 0.85 | impact 0.85 | SRP 0.8
- Issues:
  - Three package-manager invocations stacked as one block — use `::: code-group`.
  - Same stacked-managers problem repeats lower in the page.
  - Wide bullet list for alternative sources could fold to one line.
  - Only `claude` named, despite the site claiming abtree is agent-agnostic.
  - 'registry' link text vs 'Discover Trees' nav label — pick one.
  - Drift with `/guide/inspecting-executions.md` on whether `.svg` is part of the artefact set.
- Status: pending

### docs/guide/writing-trees.md
- Tier: education
- Purpose: Step through YAML schema; layout, fields, state, composites, action shape, retries, naming, worked example, validation.
- Audience: tree author
- Scores: clarity 0.88 | impact 0.85 | SRP 0.55
- Issues:
  - H1 'Writing your own tree' vs nav 'Writing trees' vs intro 'walks through the YAML structure' — three framings.
  - Page is education + schema reference — needs split.
  - Major duplication with `/agents/author.md` (file shape, primitives table, retries, `$ref`, worked example).
  - Major duplication with `/guide/designing-workflows.md`.
  - Parenthetical-then-recommendation should be a tip admonition.
  - 'parallel example' appended; inline it.
  - Validation section shallower than `/agents/author.md` equivalent.
- Status: pending

### docs/guide/fragments.md
- Tier: education
- Purpose: How to split a tree across files using `$ref`; resolution semantics, cycles, refactor workflow.
- Audience: tree author (mid / advanced)
- Scores: clarity 0.92 | impact 0.65 | SRP 0.9
- Issues:
  - Heading 'Why split' reads as a typo — should be 'Why split a tree'.
  - Period-inside-quotes is a US convention; STYLEGUIDE.md says British.
  - Colloquial 'blowing the stack'.
  - Link text doesn't match destination title.
  - Bold on 'just a node' violates first-occurrence-only rule.
- Status: pending

### docs/guide/designing-workflows.md
- Tier: education
- Purpose: Reference material for an LLM helping a human design an abtree tree.
- Audience: LLM assistant, advanced author
- Scores: clarity 0.7 | impact 0.7 | SRP 0.35
- Issues:
  - 496 lines covering 7 distinct concerns — must split.
  - Tier mismatch: positioned as reference but teaches and prescribes process.
  - Massive duplication with `/guide/writing-trees.md` and `/concepts/branches-and-actions.md`.
  - Heavy intra-page duplication of idiom shapes.
  - Self-contradiction: 'Use retries instead' vs 'Use selector-of-passes instead' on the same anti-pattern.
  - Heading rhetoric inconsistent.
  - Audience-shift: addresses an LLM in a doc set that elsewhere addresses the human tree author.
  - Worked design uses '# ...' lines as YAML — sketches, not valid.
  - Contradicts itself on 'No native loops' vs `retries: N` as a loop.
  - 10-step design process — the most useful chunk — buried 80% down the page.
- Status: pending

### docs/guide/testing.md
- Tier: education
- Purpose: Describe `@abtree/test-tree` workflow: spec format, fixtures, pretend mode, running a test, the REPORT artefact.
- Audience: tree author writing regression specs
- Scores: clarity 0.85 | impact 0.6 | SRP 0.85
- Issues:
  - `@abtree/test-tree` unbacticked at first mention.
  - Colloquial 'aren't ceremony', 'load-bearing'.
  - Bullet starting 'And' breaks parallel construction.
  - Period inside quote (US convention).
  - Three commands in one block hard to copy.
  - 'registry' vs 'Discover Trees' label drift.
  - 'pretend mode' and 'BDD' introduced without bold or definition.
  - Spec format described in prose where a schema table would scan faster.
- Status: pending

### docs/guide/inspecting-executions.md
- Tier: reference
- Purpose: Decode JSON execution document and Mermaid diagram; field reference; debug stuck executions.
- Audience: tree author debugging, integrator
- Scores: clarity 0.92 | impact 0.6 | SRP 0.85
- Issues:
  - Inline definition of 'blackboard' belongs at first mention in `/concepts/state.md`.
  - 'three colour states tell you everything' uses hyperbole.
  - 'Tells you' column header drift with 'Meaning' elsewhere.
  - 'still trying alternatives' lightly anthropomorphises.
  - Common-situations colon-list pattern doesn't scan well — promote to h3.
- Status: pending

### docs/guide/cli.md
- Tier: reference
- Purpose: Enumerate every abtree CLI command, flag, output shape, environment variable, exit code.
- Audience: integrator, agent driving abtree
- Scores: clarity 0.92 | impact 0.75 | SRP 0.95
- Issues:
  - Motivation sentence in a reference page — strip.
  - Prompt convention inconsistent (`$` vs no `$`).
  - No cross-link to `/agents/execute`.
  - Response shape JSON would scan as a table.
  - Missing reference for `abtree install skill`.
  - Missing reference for `abtree docs schema`.
  - Missing reference for `abtree render`.
  - Missing reference for `abtree execution reset` and `abtree execution get`.
  - Missing flags for `abtree upgrade` (`--check`, `--version`, `--yes`).
  - Missing exit code documentation across commands.
- Status: pending

### docs/registry.md
- Tier: reference
- Purpose: Searchable catalog of published behaviour-tree packages; submission instructions.
- Audience: integrator, tree publisher
- Scores: clarity 0.85 | impact 0.7 | SRP 0.7
- Issues:
  - Two distinct concerns (catalog + publisher instructions) bundled.
  - Placeholder drift: `<pkg-name>` here vs `<pkg>` elsewhere.
  - Title-case 'Discover Trees' violates sentence-case rule.
  - Nav, sidebar, and h1 all use title case.
- Status: pending

### docs/agents/execute.md
- Tier: reference
- Purpose: Protocol contract for an agent driving an abtree execution.
- Audience: LLM agent
- Scores: clarity 0.85 | impact 0.85 | SRP 0.9
- Issues:
  - No description frontmatter.
  - Title 'Execution Protocol' is title case.
  - All-caps 'STRICT' and 'DO NOT' shouting.
  - 'Never read tree files' missing rationale.
  - Project-local tree concept owned by three pages — centralise.
- Status: pending

### docs/agents/author.md
- Tier: reference
- Purpose: Reference for an agent authoring a tree.
- Audience: LLM agent
- Scores: clarity 0.82 | impact 0.55 | SRP 0.7
- Issues:
  - Title 'Tree Authoring Guide' is title case.
  - No description frontmatter.
  - Major duplication with `/guide/writing-trees.md`.
  - Duplication with `/agents/schema.md`.
  - Admonition label case inconsistent (`tip` vs `STRICT`).
  - Primitives table is the third duplicate.
  - Two phrasings of 'state persists across retries'.
  - Validation row cites a test file (implementation detail).
  - 'Reporting' format documented only on agents pages.
- Status: pending

### docs/agents/schema.md
- Tier: reference
- Purpose: Point at the canonical JSON Schema sources; editor integration; CI validation.
- Audience: tree author wiring LSP / CI
- Scores: clarity 0.95 | impact 0.4 | SRP 0.95
- Issues:
  - No description frontmatter.
  - Stale reference to `.gitlab-ci.yml` for a GitHub-hosted repo.
  - Page ends abruptly with implementation detail — no 'Next' pointer.
- Status: pending

## Narrative arc

The intended reader journey: a new user lands on `docs/index.md` (orientation) and gets the value proposition in 90 seconds, then crosses to `docs/getting-started.md` for a five-minute, hands-on first run, with `docs/motivation.md` available as the deeper "why" companion. Once the reader is convinced, the education tier teaches the vocabulary: `docs/concepts/index.md` introduces behaviour trees, `docs/concepts/branches-and-actions.md` names the four primitives, and `docs/concepts/state.md` adds the blackboard. With that mental model, the reader moves to the guides — `docs/guide/writing-trees.md` to author a tree, `docs/guide/using-trees.md` to consume one, `docs/guide/fragments.md` to refactor at scale, `docs/guide/testing.md` to add regression coverage, and `docs/guide/designing-workflows.md` for design-process advice. Once they ship, the reference tier supports them: `docs/guide/cli.md` for command lookups, `docs/guide/inspecting-executions.md` for debugging, `docs/registry.md` for discovery, and the `docs/agents/*` triple as the protocol contract their agent reads. The arc is currently legible but broken in two specific places: `docs/getting-started.md` inlines concept content that should live in education, and `docs/guide/designing-workflows.md` carries reference-shaped material that the rest of the education tier defers to.
