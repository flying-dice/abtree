---
description: Method for finding high-signal issues in a documentation refactor, grounded in the diff and the encoded style principles.
---

Find high-signal issues in the documentation refactor. The diff and the applied-suggestion log are the sources of truth — every issue must cite the changed page or line it derives from. Do not flag pre-existing concerns on untouched pages, and do not relitigate decisions already settled by the critique that drove this cycle.

## Method

1. **Gather inputs.** Capture: the per-cycle applied-suggestion log, the current `./documentation-sitemap.md`, the diff of changed pages, and `fragments/style-principles.md` (the encoded MDN + Microsoft Manual of Style rules).

2. **Anchor the intent.** A sonnet agent summarises this cycle's changes: which pages moved tier, which were split or merged, which were rewritten. Later agents read this so their findings stay grounded in what actually changed.

3. **Scan in parallel** (4 agents, run together). Each receives the diff, the sitemap, the cycle summary, and `style-principles.md`, and returns issues as `{ description, reason, cited_lines, page_path }`.
   - One **sonnet** agent — tier discipline. Did any change put a page in the wrong tier (orientation / education / reference), or leave a page straddling two tiers? Cite the heading or section that fails the test.
   - One **sonnet** agent — Microsoft Manual of Style compliance on the rewritten prose. Voice, tense, sentence case, parallel construction, action-oriented headings, defined jargon. Only flag violations introduced or relocated by this cycle.
   - One **opus** agent — single responsibility per page. Does any changed page now own more than one concept, task, or surface? Quote the conjunction or the second concept.
   - One **opus** agent — narrative arc and progressive structure. Read the site end-to-end (in sidebar order) and check that orientation → education → reference still hangs together. Flag broken handoffs, dangling concepts, or reference pages assumed before introduction.

## What counts as high-signal

Flag only when:

- The change demonstrably breaks the tier model (e.g. a reference page now opens with a tutorial).
- The change introduces a Microsoft Manual of Style violation that the rest of the site does not have (regression, not pre-existing drift).
- The change leaves a page owning more than one concept that a one-sentence summary would join with a conjunction.
- The narrative arc has a concrete, new break (e.g. a guide now references a concept page that no longer exists; a new term is used before it is defined).
- A literal (path, flag, command, env var) is wrong, mis-typed, or contradicted by the source.

## What to ignore

- Pre-existing issues on pages this cycle did not touch.
- Subjective preferences about which of two valid structures is better.
- Pedantic style nitpicks already accepted by the project's `STYLEGUIDE.md`.
- Disagreements with how a page was split — the critique step already settled the split shape.
- Anything that requires reading source code to verify (defer to the CLI completeness gate).
- Suggestions for further improvement that aren't defects.

If not certain, do not flag. The cycle gate retries on findings — false positives waste cycles.
