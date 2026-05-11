---
description: Method for finding high-signal issues in an SRP refactor, grounded in the diff
---

Find high-signal issues in the SRP refactor. The diff is the source of truth — every issue must cite the changed line/hunk it derives from. Do not flag pre-existing concerns, untouched code, or design opinions about how responsibilities were split.

## Method

1. **Gather inputs.** Capture the refactor diff and the file paths of the root `CLAUDE.md` plus any `CLAUDE.md` whose directory contains a modified file.

2. **Anchor the intent.** A sonnet agent summarises the refactor: what was split out, what moved where, which call sites were updated. Later agents read this so their findings stay grounded.

3. **Scan in parallel** (4 agents, run together). Each receives the diff + summary and returns issues as `{ description, reason, cited_lines }`.
   - Two **sonnet** agents — CLAUDE.md compliance, scoped to CLAUDE.md files that share a path (or parent path) with a changed file. Only new or relocated violations count.
   - One **opus** agent — refactor-introduced bugs. Focus on failure modes typical of SRP splits: lost behaviour when code moved, broken imports, stale call sites, dropped parameters, responsibilities duplicated rather than relocated.
   - One **opus** agent — problems in the introduced code: security, incorrect logic, mishandled state across the new module boundaries.

## What counts as high-signal

Flag only when:
- Code will fail to compile or parse (syntax, type errors, missing imports, unresolved references after the move).
- Code will definitely produce wrong results regardless of inputs (behaviour changed in a way the refactor did not intend).
- Clear CLAUDE.md violation introduced or relocated by this refactor — quote the exact rule broken.

## What to ignore

- Pre-existing issues, including ones merely relocated by the refactor.
- Things that look like bugs but are correct.
- Pedantic nitpicks; subjective style; general code-quality concerns not codified in CLAUDE.md.
- Anything depending on specific inputs or runtime state.
- Anything a linter would catch.
- Issues mentioned in CLAUDE.md but explicitly silenced in code (e.g. lint-ignore comment).
- Disagreements with how the SRP split was drawn.

If not certain, do not flag.
