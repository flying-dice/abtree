# Code review playbook

Review a merge request / pull request for **high-signal-only** issues. The output is a list of validated findings, not a style audit.

---

## 1. Pre-flight — when NOT to review

Skip the review and report the reason if any of the following are true. Do not proceed past this stage when skipping.

- The MR is closed.
- The MR is in draft.
- The change does not need review (automated bump, generated artefact, trivially mechanical change that is obviously correct).
- This tool has already left a review on the MR.

For all other cases, continue to stage 2.

---

## 2. Load project conventions

Find every convention document the diff might be governed by:

- The repository's root convention file (`CLAUDE.md`, `AGENTS.md`, `STYLEGUIDE.md`, `CONTRIBUTING.md`, or equivalent).
- Any convention file in a directory that is an ancestor of a file the MR modifies.

Note their paths. Do not load contents until a reviewer pass needs them.

When evaluating compliance for a specific file, **only consider convention documents whose path is an ancestor of that file**. A convention in `web/CLAUDE.md` does not govern a file under `services/`.

---

## 3. Summarise the diff

Read the MR title, description, and full diff. Produce a one-paragraph summary covering: what changed, why (per the description), and which areas of the codebase are touched. This summary is context for the parallel review passes.

---

## 4. Parallel review passes

Run three independent passes against the diff. Each pass returns a list of findings shaped:

```
{ file, lines, severity (blocking|non-blocking),
  description, why_flagged, citation }
```

### Pass A — Conventions audit

For each modified file, check the convention documents that govern it (see stage 2). Flag clear, unambiguous violations where you can quote the exact rule being broken. Do not flag soft preferences.

### Pass B — Introduced-code audit

Look for problems that exist *in the code introduced by this MR*: incorrect logic, security issues, error-handling gaps, race conditions, unsafe state mutation. Stay within the changed code; do not chase issues outside the diff.

### Pass C — Bug scan

Scan the diff for obvious bugs that will manifest at runtime: undefined references, type mismatches, off-by-one errors, missing await on async calls, broken control flow. Focus on the diff itself; do not read extra context.

---

## 5. The high-signal bar

**Flag only:**

- Code that will fail to compile or parse (syntax errors, type errors, missing imports, unresolved references).
- Code that will definitely produce wrong results regardless of input (clear logic errors).
- Clear, unambiguous convention violations where you can quote the exact rule being broken.

**Do not flag:**

- Code style or quality concerns.
- Potential issues that depend on specific inputs or runtime state.
- Subjective suggestions or improvements.
- Pre-existing issues (issues outside the diff).
- Things a linter would catch (do not run a linter to verify).
- Issues a senior engineer would consider pedantic.
- Issues mentioned in convention docs but explicitly silenced in the code (e.g. via a lint-ignore comment).
- General code-quality concerns unless explicitly required by a convention document.

If you are not certain a finding is real, do not flag it. False positives erode trust.

---

## 6. Per-finding validation

Before any finding leaves stage 4, validate it independently. For each finding, ask:

- Is this issue actually true in the code as written?
- For a convention finding: is the convention document I am citing an ancestor of this file? Is the rule I am quoting actually in that document?
- Could this be correct and I am misreading?

Drop any finding that does not survive validation. An empty findings list is a healthy outcome.

---

## 7. Posting & formatting (only when publishing)

If the workflow calling this playbook decides to publish (gate that decision outside this playbook), follow these rules:

- **One comment per unique finding.** Never duplicate.
- **Inline comments**, anchored to the file and line range the finding refers to.
- **Suggestion blocks** for self-contained fixes that completely resolve the issue. If the fix needs more than ~5 lines, multiple locations, or follow-up work, describe the fix in prose without a suggestion block.
- **Cite each finding** with a permalink to the source location. Format permalinks with the full commit SHA and a line range with one line of context above and below the cited region. Example shape:
  ```
  https://<host>/<owner>/<repo>/blob/<full-sha>/<path>#L<start>-L<end>
  ```
  Markdown previews fail without the full SHA.

If there are no findings, post a single summary comment stating "No issues found." Do not post empty per-file comments.
