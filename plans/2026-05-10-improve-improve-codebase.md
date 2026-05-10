---
id: 20260510-improve-improve-codebase
title: improve-tree review of improve-codebase
status: draft
author: Jonathan Turnock
created: 2026-05-10
session_ref: full-repo-improvement-cycle__improve-codebase__1
target_tree: improve-codebase
reviewed_by:
---

## Summary

Reviewing `.abtree/trees/improve-codebase/TREE.yaml` using evidence from session `full-repo-improvement-cycle__improve-codebase__1`. The session reached `Cycle_Passed` cleanly (7/7 items applied, 6/50 retry budget consumed, all four metrics raised from 0.7 baseline to 0.85+). Effectiveness score: **0.7**. The tree gets the job done, but several nodes push state-mutation work onto the agent that the runtime could express directly, and a few wording choices created friction during the run.

## Effectiveness score

`0.7` — driven home by ten observations:

| Node path | Severity | Evidence |
|---|---|---|
| `Iterative_Refactor / Pick_Next_Item` | med | The instruct asks the agent to pop the queue head into `current_item`, but the runtime does no list mutation. Each item required four manual writes (`current_item`, `refactor_queue`, `current_score`, `refactor_plan`). |
| `Iterative_Refactor / Record_Item_Done` | med | Same shape: agent writes `done_log` via `jq` surgery rather than a runtime primitive. Adjacent to Pick_Next_Item, both demand the same kind of work. |
| `Iterative_Refactor / Continue_Or_Done` | med | Loop encoded as `eval-false → outer-retry`. The first `next` after the eval returns `status: failure` to the agent; the second emits `Halt_Check`. Correct per runtime semantics, but reads as a quirk during driving. |
| `Verify_Baseline / state.global.test_command` | med | Seeded value is descriptive prose ("the command that runs the project's full regression test suite (e.g. 'bun test', 'pnpm test')"), not a literal command. Every fresh run hits the same ambiguity. The `is set` evaluate passes either way, masking the issue. |
| `Iterative_Refactor / Pre_Refactor_Critique / High_Risk_Critique` | low | Evaluate string `$LOCAL.current_item.risk is "high"` is the only place in the tree using literal-quoted token matching. |
| `Iterative_Refactor / Implement_Refactor` | low | Instruct is silent on what counts as progress mid-attempt. No idiomatic call to `submit running` for long-running edits. |
| `Iterative_Refactor / Lookup_Online → online_references usage` | low | Populated once at the top, then read only by High_Risk_Critique and Implement_Refactor. For low-risk items the lookup output is dead state. |
| `Compile_Report → metric_thresholds` | low | All four metrics share `0.7`. Structure invites per-metric tuning; the run did not exercise it. |
| `Cycle_Verdict / Cycle_Passed evaluate` | low | Long English sentence ("every metric in $LOCAL.final_scores is at or above its $GLOBAL.metric_thresholds value"). Pushes computation onto the agent. |
| `Iterative_Refactor / retries: 50` | low | This run used 6 of 50. The cap is sensible but the value 50 is folklore — no scaling rule stated in the tree or its description. |

## Improvements

| # | Kind | Target | Change | Rationale |
|---|---|---|---|---|
| 1 | split | `Iterative_Refactor / Pick_Next_Item` | Either introduce a runtime primitive (`abtree local pop <id> <key>`) or, at minimum, reword the instruct to spell out the four writes explicitly. | Six sessions of four-write `jq` surgery per item is a smell. |
| 2 | split | `Iterative_Refactor / Record_Item_Done` | Same shape: a runtime primitive (`abtree local push <id> <key> <value>`) or an explicit write list. | Manual `done_log` append duplicates the popping pattern. |
| 3 | reword | `state.global.test_command` | Seed with the literal command for the project (`"bun test"`). If author-agnostic guidance matters, store both: `{ command: "bun test", description: "..." }`. | Every fresh run hits the same descriptive-prose ambiguity. |
| 4 | reword | `Pre_Refactor_Critique / High_Risk_Critique` evaluate | Switch from `risk is "high"` to `risk equals high` (no inner quotes). Match the phrasing the rest of the tree uses. | Doubled escaping is the only such case in the file. |
| 5 | add-evaluate | `Iterative_Refactor / Implement_Refactor` | Insert a small instruct (or precondition) that names `submit running` as the canonical mid-attempt signal and writes a brief progress note to `$LOCAL.implement_progress`. | Long-running attempts had no idiomatic progress channel. |
| 6 | other | `Iterative_Refactor / Continue_Or_Done` | Document the `eval-false → outer-retry` loop encoding in a YAML comment, or surface it in `docs/agents/author.md`. | The double-call-to-next quirk surprised the driver mid-cycle. |
| 7 | merge | `Iterative_Refactor / Lookup_Online + Implement_Refactor` | Either drop `online_references` entirely if `Skip_Critique` items never read it, or have `Skip_Critique` also consult `$LOCAL.online_references[current_item.metric]`. | Output is dead state for the low-risk path. |
| 8 | reword | `Cycle_Verdict / Cycle_Passed` evaluate | Pre-compute a boolean (`$LOCAL.all_metrics_passed`) at `Final_Reassessment` and gate on the flag. | Keeps the evaluate boolean; pushes the comparison into a place that owns the data. |
| 9 | rename | `state.local.refactor_plan` | Rename to `per_item_plan` or `pre_refactor_plan`. | The current name collides with `refactor_queue` and the broader sense of "the cycle's plan". |
| 10 | add-retries | `Iterative_Refactor` | Either parameterise the `50` via `$GLOBAL.outer_retries` (with a heuristic comment, e.g. `ceil(initial_queue_length * 1.5)`) or document why 50 in the tree's description. | Folklore values rot fastest. |

## Open questions

- Items 1 and 2 hint at runtime work (`abtree local pop` / `local push`). Is the maintainer up for adding two new CLI verbs, or does the answer stay in the tree's instruct text? If the latter, items 1 and 2 collapse to single-line wording changes.
- Item 5 raises a small protocol question: should the runtime prompt for `submit running` periodically on long-running instructs, or stay where it is and only have the tree author opt in?
- Item 8's flag pattern (`$LOCAL.all_metrics_passed`) could be applied generally — is there appetite to make "compute at write time, gate on a flag" a tree-author convention?
