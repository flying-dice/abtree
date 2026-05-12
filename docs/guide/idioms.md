---
title: Idioms
description: Reusable shapes for abtree behaviour trees — bounded retries, gates, parallel fan-out, fragments, globals as retrieval directives. Reach for these during design.
---

# Idioms

Once you know the four primitives, most workflows reduce to a small set of recurring shapes. This page catalogues them. Each entry names the shape, shows the YAML, and states when to reach for it (and when not to).

If you have not picked the primitives for your tree yet, start with [Design a new tree](/guide/design-process).

## Bounded code-then-test (retries on a sequence)

The canonical "iterate until satisfied" shape. Wrap a `[code → test]` sequence with `retries: N`. The runtime resets the sequence's internal state and re-ticks on failure, up to `N` times. User state in `$LOCAL` (counters, drafts, notes) persists across retries.

```yaml
tree:
  type: sequence
  name: Reach_Threshold
  retries: 3
  children:
    - $ref: "./fragments/pass.yaml"   # one fragment, retried up to 4× total
```

```yaml
# fragments/pass.yaml
type: sequence
name: Pass
children:
  - { type: action, name: Increment, steps: [...] }
  - type: action
    name: Test
    steps:
      - evaluate: $LOCAL.counter is greater than $LOCAL.threshold
      - instruct: Threshold reached.
```

One fragment, one retry config — replaces `N` hand-written passes.

#### When to reach for this

The work is meaningful at each iteration: write code then run tests, revise a draft then review, gather data then check completeness. Each pass is a step you want to inspect in a Mermaid trace.

#### Older alternative — selector of passes

Before runtime retries, the same shape was authored as a `selector` with `N` near-identical children, each a separate `[code → test]` sequence. It still works, but it duplicates structure. Prefer `retries` for new trees.

#### Anti-pattern

Modelling iteration as a cycle (`test` `$ref`s back to `increment`). Cycles are preserved in the snapshot but cannot be ticked — abtree fails fast on a cyclic edge by design. Use `retries` instead.

## Bounded attempts (selector of passes)

When each pass is materially different — first draft, revise once, final revise — author it as a `selector` of `N` sequences. Each pass writes failure notes to a shared `$LOCAL.<x>_notes` key before failing, so the next pass has something to act on.

```yaml
type: selector
name: Write_With_Retries
children:
  - type: sequence
    name: First_Pass
    children:
      - { type: action, name: Write, ... }
      - { type: action, name: Review_Pass_1, ... }

  - type: sequence
    name: Second_Pass
    children:
      - { type: action, name: Revise, ... }       # reads notes from Pass 1
      - { type: action, name: Review_Pass_2, ... }

  - type: sequence
    name: Third_Pass
    children:
      - { type: action, name: Final_Revise, ... }
      - { type: action, name: Review_Pass_3, ... }
```

Three passes is conventional; pick a number that bounds the cost.

#### When to reach for this

Each pass is a distinct shape the trace should display as its own subtree. Use `retries: N` instead when every pass is the same shape.

## Tight inner loop inside one action

When iteration is **not** meaningful at each step — polling a value, retrying a flaky API call, capping at `N` tries internally — fold the loop into a single `instruct` and let the agent enforce the bound.

```yaml
- type: action
  name: Wait_For_Service
  steps:
    - evaluate: $LOCAL.endpoint is set
    - instruct: |
        Poll $LOCAL.endpoint up to 10 times with a 1s delay between
        attempts. If the service responds 200, set $LOCAL.ready to
        true and submit success. After 10 attempts, submit failure.
```

#### When to reach for this

The inner step is uninteresting on its own — it does not warrant a Mermaid trace. The runtime sees one action; the loop is the agent's contract.

#### Trade-off

The bound lives in prose, not the tree. Less observable, less resumable, but tighter. Use `retries` or selector-of-passes when each iteration is a step worth seeing; use this when it is not.

## Instruct-then-evaluate gate

When a gate needs to record *why* it failed, run the check inside an `instruct` (so the agent populates `$LOCAL.<x>_notes`), then gate on the result with a final `evaluate`. The plain three-evaluate form ends the action on the first failure with no chance to write notes.

```yaml
- type: action
  name: Review_Gate
  steps:
    - evaluate: $LOCAL.draft is set
    - instruct: |
        Run three checks against $LOCAL.draft. If all pass, set
        $LOCAL.review_notes to "approved". If any fails, write the
        specific failure to $LOCAL.review_notes.
    - evaluate: $LOCAL.review_notes is "approved"
    - instruct: All checks passed. Confirm and store $LOCAL.final_path.
```

## Human-approval gate

abtree has no native "wait for human" primitive. Express the wait as an `evaluate` on a flag the human sets via `abtree local write`, paired with an `instruct` that tells the agent to wait.

```yaml
- type: action
  name: Human_Approval_Gate
  steps:
    - evaluate: $LOCAL.draft is set
    - instruct: |
        Present the draft to the human. Wait for them to confirm by
        running `abtree local write <execution-id> approved true`. While
        waiting, submit `running`. Do not submit success until they
        confirm.
    - evaluate: $LOCAL.approved is true
    - instruct: Proceed with the approved draft.
```

The agent uses `abtree submit <id> running` to acknowledge and pause without advancing the cursor. The human's `abtree local write` is what releases the next `evaluate`.

## Plan-approved gate

A variant of the human gate: a downstream tree refuses to run unless an upstream execution produced a plan with `reviewed_by` populated. Encode it as an early action whose `instruct` reads the file:

```yaml
- type: action
  name: Check_Plan_Approval
  steps:
    - evaluate: $LOCAL.change_request is set
    - instruct: |
        Find the plan in plans/ matching $LOCAL.change_request. Read
        the frontmatter. If reviewed_by is empty, submit failure with
        a note that codeowner approval is needed. Otherwise store the
        full plan content at $LOCAL.plan_content.
```

The action either succeeds (plan content available) or fails (parent sequence aborts, surfacing the missing approval).

## Parallel context-gathering with shared dependency

When multiple branches need to read a value produced by an earlier step, that step lives in a parent `sequence`, not the parallel itself. Fan-out happens after fan-in.

```yaml
type: sequence
children:
  - { type: action, name: Compute_Common_Input, ... }   # writes $LOCAL.x

  - type: parallel
    name: Branch_On_X
    children:
      - { type: action, name: Use_X_For_Foo, ... }       # reads $LOCAL.x
      - { type: action, name: Use_X_For_Bar, ... }       # reads $LOCAL.x
```

Each parallel branch can carry its own `evaluate: $LOCAL.x is set` precondition for safety.

## Globals as parameterless retrieval directives

When a chunk of work has well-known guidance — code-review checklists, design heuristics, security playbooks — store the **retrieval directive itself** in `$GLOBAL`. Actions invoke it by name.

The natural home for a per-tree playbook is alongside its `TREE.yaml`. A common path is `.abtree/trees/<slug>/playbooks/<name>.md`:

```yaml
state:
  global:
    review_playbook: |
      Read the file at .abtree/trees/my-review/playbooks/review.md
      (relative to the project root) and return its full body
      as text.

tree:
  ...
  - type: action
    name: Run_Review
    steps:
      - evaluate: $LOCAL.target is set
      - instruct: >
          Use $GLOBAL.review_playbook to assess $LOCAL.target.
          Capture findings at $LOCAL.findings.
```

The global is a parameterless directive: read `X`, return text. The action composes against the result. Multiple actions in the same tree can invoke the same global without repeating the read boilerplate.

#### Why this shape

- **Action prose stays focused.** Each `instruct` says *what to do with the result*, not how to retrieve it.
- **Single source of truth.** One place names where the playbook lives. Swap the path in one spot to repoint every action that uses it.
- **Composable.** Multiple actions can invoke the same global without duplicating retrieval instructions.
- **Curated.** Local files let you trim third-party guidance to your project's lens without forking the upstream document.
- **Reproducible.** A playbook checked into the repo is git-tracked; executions created against today's tree run against today's playbook.

#### Variants

The directive's body can describe any retrieval — read a file, fetch a URL, query an internal docs system. Local file is the default because it is reproducible and curatable; reach for HTTP only when you need the upstream's evolving copy.

## Split a large tree across files

For trees that exceed a screenful of YAML, factor out reusable subtrees with JSON-Schema-style `$ref`. abtree resolves references at execution-creation time, so the runtime always sees one assembled snapshot. See [Fragments](/guide/fragments) for the full reference; the short form is:

```yaml
tree:
  type: sequence
  children:
    - $ref: "./fragments/auth.yaml"          # relative to this file
    - $ref: "/srv/abtree/shared/cleanup.yaml" # absolute path
    - $ref: "https://example.com/audit.yaml"  # remote URL
```

Fragments are a single node — same shape as any inline child — and do not carry top-level `name`, `version`, `description`, or `state`.

## Optional pre-step that does not block

If a step is "do this if you can; otherwise skip", wrap it in a `selector` whose second child is a no-op:

```yaml
- type: selector
  name: Try_Cache_Then_Continue
  children:
    - { type: action, name: Read_Cache, ... }      # may fail
    - type: action
      name: Skip_Cache
      steps:
        - instruct: No cache — continue without it.
```

The selector always succeeds: either the cache read worked, or the no-op did.

## Worked example — write, review, retry

The idioms compose. A Write → Review → Retry workflow combines a selector of passes, instruct-then-evaluate gates that populate notes-on-failure, and a clear failure mode (the selector exhausts → the execution fails with the latest review notes preserved for the human to read).

```yaml
- type: selector
  name: Write_And_Review

  children:

    - type: sequence
      name: First_Pass
      children:
        - type: action
          name: Write
          steps:
            - evaluate: $LOCAL.brief is set
            - instruct: Write the artefact. Store at $LOCAL.draft.

        - type: action
          name: Review_Pass_1
          steps:
            - evaluate: $LOCAL.draft is set
            - instruct: |
                Run the review checks against $LOCAL.draft. Set
                $LOCAL.review_notes to "approved" on success or
                concrete failure notes otherwise.
            - evaluate: $LOCAL.review_notes is "approved"
            - instruct: Approved. Store $LOCAL.final_path.

    - type: sequence
      name: Second_Pass
      children:
        - type: action
          name: Revise
          steps:
            - evaluate: $LOCAL.review_notes is set and not "approved"
            - instruct: Revise $LOCAL.draft per the notes.

        - type: action
          name: Review_Pass_2
          steps:
            # ... same shape as Review_Pass_1 ...

    - type: sequence
      name: Third_Pass
      children:
        # ... final attempt before the selector exhausts ...
```

## Next

- [Testing trees](/guide/testing) — pin the idioms against regressions with `@abtree/test-tree`.
- [Anti-patterns](/guide/anti-patterns) — shapes that look like idioms but are not.
- [Naming conventions](/agents/author#naming-conventions) — slug, node, and `$LOCAL` / `$GLOBAL` key conventions.
- [Discover trees](/registry) — installable behaviour-tree packages that exercise these idioms in real workflows.
