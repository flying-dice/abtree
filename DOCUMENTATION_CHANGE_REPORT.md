# Documentation change report — 2026-05-12 20:30

## Headline

- Pages reviewed: 18 (initial) → 19 (current after splits and creations).
- Suggestions applied: 33 (20 in cycle 1, 13 in cycle 2).
- CLI coverage: complete (29 / 29 surface items documented; `abtree render` correctly absent in both source and docs).
- Final review findings: 0.

The docs-maintainer ran two full cycles. Cycle 1 landed the structural and editorial sweep against an 18-page baseline. The multi-agent review found 21 residual issues. Cycle 2 applied 13 targeted fixes (some consolidating multiple findings on the same page) and the re-review came back empty.

## What changed

### Cycle 1 (20 suggestions)

- **S01** `docs/guide/designing-workflows.md` → split → Deleted; replaced with focused `docs/guide/design-process.md` (ten-step process) and `docs/guide/idioms.md` (reusable shapes). Retries-vs-selector-of-passes contradiction resolved canonically toward `retries: N`.
- **S02** `docs/guide/cli.md` → add → Added reference entries for `abtree install skill --variant --scope`, `abtree docs <subcommand>`, `abtree execution reset`, `abtree execution get`, and `abtree upgrade --check --version --yes`. Per-command exit codes documented.
- **S03** `docs/concepts/state.md` → split → CLI reference stripped; replaced with a link to `/guide/cli`.
- **S04** `docs/concepts/branches-and-actions.md` → split → "How the loop runs" removed; invalid `{ Morning_Greeting }` placeholders replaced with full YAML; `retries:` mention added.
- **S05** `docs/getting-started.md` → split → "Concepts in 60 seconds" removed; sections renumbered 1–5; bold-on-CLI and past-tense heading fixed.
- **S06** `docs/guide/writing-trees.md` → merge → Converted to a hello-world tutorial; YAML schema reference delegated to `agents/author.md`.
- **S07** `docs/registry.md` → rename → "Discover trees" (sentence case); `<pkg-name>` → `<pkg>`.
- **S08** `docs/agents/execute.md` → rename → "Execution protocol" (sentence case); description frontmatter; all-caps `STRICT` / `DO NOT` removed.
- **S09** `docs/agents/author.md` → rename → "Authoring trees" (sentence case); description frontmatter; primitives table retained as canonical reference.
- **S10** `docs/agents/schema.md` → rewrite → Frontmatter added; stale `.gitlab-ci.yml` reference resolved.
- **S11** `docs/guide/cli.md` → restructure → Motivation sentence stripped; response shapes converted to a table; prompt convention standardised.
- **S12** `docs/index.md` → rewrite → Feature cards rewritten in parallel imperative form; anthropomorphism removed; rhetorical heading replaced; positioning reconciled to "runtime"; scare quotes stripped.
- **S13** `docs/motivation.md` → rewrite → "It won't" replaced; Before/After blockquote pattern → table; duplicated durable-execution section removed; Next pointer added.
- **S14** `docs/concepts/index.md` → rewrite → Four primitives named in the intro; "instruction fatigue" → "prompt drift"; em-dash misuse fixed.
- **S15** `docs/guide/using-trees.md` → rewrite → Package-manager invocations wrapped in `::: code-group`; alternative-sources bullets folded; "Discover trees" label standardised.
- **S16** `docs/guide/testing.md` → rewrite → `@abtree/test-tree` backticked; colloquial phrases replaced; bullet list made parallel; predicates converted to a table.
- **S17** `docs/guide/fragments.md` → rewrite → "Why split" → "Why split a tree"; periods moved outside quote marks; "blowing the stack" → "preventing stack overflow"; bold on "just a node" removed.
- **S18** `docs/guide/inspecting-executions.md` → rewrite → `blackboard` definition moved to first mention in `concepts/state.md`; column header standardised to "Meaning"; anthropomorphism removed.
- **S19** `docs/.vitepress/config.ts` → rewrite → Nav and sidebar labels updated to sentence case; decorative emoji removed from footer.
- **S20** `docs/index.md` → add → TypeScript DSL anchor sentence added pointing to `/guide/writing-trees`.

### Cycle 2 (13 suggestions, resolving 21 review findings)

- **C2-01** `docs/guide/idioms.md` → restructure → Bold-as-label patterns converted to h4 headings or stripped; hedged "would" replaced with present tense; comma moved outside quote; walls of text broken into shorter paragraphs. **Gotchas** section extracted to new `docs/guide/anti-patterns.md`; **Naming conventions** moved into `docs/agents/author.md` as part of the schema reference.
- **C2-02** `docs/concepts/branches-and-actions.md` → rewrite → One-line definition of `tick` added with bold first occurrence; Next pointer redirected to `/guide/using-trees`.
- **C2-03** `docs/concepts/state.md` → rewrite → Residual CLI content replaced with the single sentence "Both scopes are reachable from the CLI — see CLI reference".
- **C2-04** `docs/concepts/index.md` → rewrite → "The tree does." replaced with "The runtime enforces the order; the agent receives the current step.".
- **C2-05** `docs/getting-started.md` → rewrite → Added a `::: tip Terms used below` callout glossing `$LOCAL`, `instruct`, `evaluate` and linking to `/concepts/`.
- **C2-06** `docs/guide/fragments.md` → rewrite → "nerve-wracking" → "error-prone"; Next pointer points to `/guide/design-process`.
- **C2-07** `docs/guide/testing.md` → rewrite → Second `pretend mode` de-bolded; opening run-on sentence split into three short sentences.
- **C2-08** `docs/guide/writing-trees.md` → rewrite → Next pointer redirected to `/guide/fragments`.
- **C2-09** `docs/guide/using-trees.md` → add → Next block added pointing to `/guide/writing-trees`.
- **C2-10** `docs/guide/design-process.md` → rewrite → Self-referential opener replaced with a Prerequisites callout; rhetorical questions converted to procedural statements.
- **C2-11** `docs/guide/idioms.md` → rewrite → Next pointer redirected to `/guide/testing`.
- **C2-12** `docs/agents/schema.md` → add → Next pointer to `/registry` added.
- **C2-13** `docs/registry.md` → split → Publish workflow extracted to new `docs/guide/publishing-a-tree.md`; registry.md retains a one-line link; VitePress sidebar updated.

### Files created

- `docs/guide/design-process.md`
- `docs/guide/idioms.md`
- `docs/guide/anti-patterns.md`
- `docs/guide/publishing-a-tree.md`

### Files deleted

- `docs/guide/designing-workflows.md`

### Files modified

Every other markdown page under `docs/` plus `docs/.vitepress/config.ts`.

## Coverage

```json
{
  "documented_count": 29,
  "documented_primary": "docs/guide/cli.md",
  "missing": [],
  "stale": [],
  "notes": "All 29 surface items documented in docs/guide/cli.md after S02 fill and the short-flag aliases (-V, -h) addendum. `abtree render` is correctly absent from both docs and shipped CLI."
}
```

## Final review

```
[]
```

Empty — cycle 2 converged with no residual high-signal issues.

## Sitemaps on disk

- Initial: `./documentation-sitemap.initial.md`
- Final:   `./documentation-sitemap.md`

## Residual notes for future cycles

- `docs/index.md` SEO frontmatter title remains mixed case ("Behaviour Trees for AI Agents and Agentic Workflows") because S19 explicitly excluded SEO metadata from the rename pass. Out of scope for this workflow.
- `docs/.vitepress/dist/` still contains stale build artefacts referencing the deleted `designing-workflows` page. A fresh `vitepress build` regenerates the output.
- The two new pages (`anti-patterns.md`, `publishing-a-tree.md`) are first drafts. They passed both reviews but warrant a copy-edit pass once they have absorbed reader feedback.
