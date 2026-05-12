# docs-maintainer

An [abtree](https://abtree.sh) workflow for hardening a documentation site. The workflow sweeps the docs, classifies every page into the MDN orientation / education / reference tiers, scores each page for clarity, impact, and single responsibility, and gathers everything into a private `documentation-sitemap.md`. A senior-writer critique drives a bounded refactor loop that applies suggestions and amends the sitemap inline. Each cycle ends with a CLI completeness gate and a multi-agent review; cycles repeat until the site is clear, consistent, fully covers the CLI surface, and the review surfaces no findings.

![tree](./tree.svg)

The workflow edits documentation files in your working tree. **Commit or stash first** if you want a clean rollback point.

## What the workflow does

1. **Locate the CLI surface.** Reads the CLI source and enumerates every command, flag, env var, and exit code. This is the source of truth for the completeness gate.
2. **Sweep and classify.** Walks the docs root and classifies every page by tier (orientation / education / reference), purpose, audience, and three scores: clarity, impact, single responsibility.
3. **Build the sitemap.** Composes a private `documentation-sitemap.md` summarising every page. This is the maintainer's working document — `private: true` in the frontmatter, not a published page.
4. **Critique as a senior technical writer.** Assesses the sitemap and underlying docs against the MDN three-tier structure and the Microsoft Manual of Style (encoded in `fragments/style-principles.md`). Emits an ordered catalog of suggestions.
5. **Apply suggestions.** One-by-one until the queue empties. Each application also amends the sitemap entry for the affected page inline.
6. **CLI completeness gate.** Cross-checks the CLI surface against documented coverage. Fails the cycle if anything is missing or stale.
7. **Multi-agent review.** Runs the procedure in `fragments/docs-review.md` against this cycle's diff — sonnet agents on tier discipline and Microsoft style, opus agents on single responsibility and narrative arc.
8. **Verify cycle clean.** Succeeds only if critique was empty, CLI coverage is complete, and review surfaced no issues. Failing here re-runs the entire cycle.
9. **Change report.** Writes `DOCUMENTATION_CHANGE_REPORT.md` summarising what changed across all cycles.

## Files the workflow produces

| Path | Written by |
|---|---|
| `documentation-sitemap.md` | `Build_Sitemap` (overwritten every cycle, amended inline during `Apply_Suggestions`). Private maintainer document. |
| `documentation-sitemap.initial.md` | `Snapshot_Initial_Sitemap` (first cycle only; before state). |
| `DOCUMENTATION_CHANGE_REPORT.md` | `Change_Report` (before-vs-after summary). |

The standard `.abtree/executions/<id>.{json,mermaid,svg}` artefacts are also written — see [Using a tree → What gets written](https://abtree.sh/guide/using-trees#what-gets-written).

## Develop this workflow

To fork or modify, clone instead of installing:

```sh
git clone https://github.com/flying-dice/abtree
cd abtree/trees/docs-maintainer
bun install
```

Tree source is in `src/tree.ts` (authored with the [abtree DSL](https://abtree.sh/guide/writing-trees)); `bun run build` emits `main.json`. The encoded style principles live at `fragments/style-principles.md`; the multi-agent review procedure at `fragments/docs-review.md`.
