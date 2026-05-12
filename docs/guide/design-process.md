---
title: Design a new tree
description: A ten-step process for designing a new abtree behaviour tree. Start from the success state, work down to the root sequence, then validate that the YAML loads.
---

# Design a new tree

The canonical ten-step process for designing a fresh abtree tree from a human brief. You produce a YAML tree at the end.

::: tip Prerequisites
Read [Branches and actions](/concepts/branches-and-actions) for the primitives and [Writing trees](/guide/writing-trees) for the YAML shape before starting.
:::

The process is linear. Each step asks one question. You write down the answer before you move on.

## 1. Name the success state

State the post-condition the root sequence has to establish, in one sentence. "The pull request is merged." "The plan is approved by a codeowner." "The artefact is written to `$LOCAL.final_path`." The remaining steps work backwards from this sentence.

## 2. List the discrete tasks

Each task becomes one `action`. The task's natural-language description becomes the `instruct`. The task's precondition becomes the `evaluate`.

| Task | `evaluate` | `instruct` |
|---|---|---|
| Fetch the plan | `$LOCAL.change_request is set` | Load the plan into `$LOCAL.plan_content`. |
| Score the plan | `$LOCAL.plan_content is set` | Run the review checklist. Write the score to `$LOCAL.score`. |

If you cannot name an `evaluate` for a task, the task is underspecified. Tighten the brief.

## 3. Group dependent tasks into sequences

"Do A before B" maps to `sequence: [A, B]`. The sequence aborts on the first failure, so a failing dependency stops the workflow early.

## 4. Identify decisions

"If X then Y, else Z" maps to a `selector` with evaluate-gated children. The first child whose `evaluate` passes runs.

```yaml
type: selector
name: Choose_Greeting
children:
  - type: action
    name: Morning_Greeting
    steps:
      - evaluate: $LOCAL.time_of_day is "morning"
      - instruct: ...
  - type: action
    name: Default_Greeting
    steps:
      - instruct: ...    # no evaluate = always passes
```

Always end an evaluate-gated selector with a no-evaluate fallback if you need a "none of the above" branch. A selector with no winning child fails.

## 5. Identify fan-out

"Do these in any order" maps to a `parallel`. Children run independently; all must succeed. If two children both read a value produced by an earlier step, that step has to live in a parent `sequence` above the parallel — fan-out happens after fan-in.

## 6. Identify gates

"The human or a downstream system must approve" maps to an `evaluate` on a flag the approver sets. The agent submits `running` while waiting; the approver runs `abtree local write <id> approved true` to release the gate.

```yaml
- type: action
  name: Human_Approval_Gate
  steps:
    - evaluate: $LOCAL.draft is set
    - instruct: |
        Present the draft. Wait for the reviewer to write
        $LOCAL.approved = true. Submit running while waiting.
    - evaluate: $LOCAL.approved is true
    - instruct: Proceed with the approved draft.
```

## 7. Identify retries

"Try this a few times before giving up" maps to one of two shapes:

- **`retries: N` on a sequence.** The runtime resets the sequence's internal state and re-ticks on failure, up to `N` times. User state in `$LOCAL` persists. Use this when each retry is the same shape and you want one config knob.
- **`selector` of `N` attempts.** Each attempt is its own observable, resumable child. Use this when each pass is materially different — for example, "first draft", "revise once", "final revise".

## 8. State the input contract

List the `$LOCAL` keys that must be set before the first action evaluates. Declare them in `state.local` with `null` defaults.

```yaml
state:
  local:
    change_request: null
    plan_content: null
    score: null
```

The agent or the human seeds the required keys via `abtree local write` before calling `abtree next`.

## 9. Sketch the tree top-down

Write the root `sequence`, then expand each child in turn. After the sketch, walk the failure modes: trace what happens when each action fails, and verify the parent composite handles the failure the way the design intends. A `selector` parent absorbs the failure and tries the next child. A `sequence` parent aborts. Match that to the design intent before you commit.

## 10. Save and validate

Save as `.abtree/trees/<slug>/TREE.yaml` with a sibling `package.json` whose `main` is `TREE.yaml`. Run:

```sh
abtree execution create <slug> "smoke test"
```

If the YAML is malformed, the CLI prints the validation error and exits non-zero. If it loads, the tree is valid and ready to drive end-to-end.

## Next

- [Idioms](/guide/idioms) — reusable shapes you reach for during design.
- [Writing trees](/guide/writing-trees) — the YAML field reference.
- [Branches and actions](/concepts/branches-and-actions) — primitive semantics in detail.
