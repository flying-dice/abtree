---
description: Reference for assistants helping a human design a new abtree behaviour tree. Decision rules for the four primitives, the YAML shape, common idioms (bounded retries, gates, human approval), and the gotchas that come from abtree having no native loops.
---

# Designing workflows

This page is reference material for an LLM helping a human design a new abtree behaviour tree. It assumes you (the assistant) already know the YAML syntax from [Writing trees](/guide/writing-trees) and the primitive semantics from [Branches and actions](/concepts/branches-and-actions). What follows is the layer above: given the syntax, what shapes do you reach for, and what shapes are footguns?

## The four primitives — when to use each

Behaviour trees in abtree are made of one **action** node type and three **composite** node types (`sequence`, `selector`, `parallel`). Pick by the question you're answering:

| Question | Primitive |
|---|---|
| "Do these in order, all must succeed." | `sequence` |
| "Try these in order until one works." | `selector` |
| "Do all of these; the order doesn't matter." | `parallel` |
| "This is a unit of work the agent performs." | `action` |

Every leaf is an `action`. Every non-leaf is a composite. The root is conventionally a `sequence`.

### Sequence

Children run top-to-bottom. **Any failure aborts.** Use for linear pipelines where each step depends on the previous one's success.

```yaml
type: sequence
name: Deploy_Service
children:
  - { type: action, name: Run_Tests, ... }
  - { type: action, name: Build_Image, ... }
  - { type: action, name: Push_Registry, ... }
```

If `Run_Tests` fails, the build never happens. The push never happens. The execution ends with `status: failed`.

### Selector

Children run top-to-bottom **until one succeeds**. If all fail, the selector fails. This is the BT equivalent of an if/elif/else chain. The "decision" is encoded by each child's `evaluate` precondition — the first child whose evaluate passes runs its instruct.

```yaml
type: selector
name: Choose_Greeting
children:
  - type: action
    name: Morning_Greeting
    steps:
      - evaluate: $LOCAL.time_of_day is "morning"
      - instruct: Compose a morning greeting...
  - type: action
    name: Default_Greeting
    steps:
      - instruct: Compose a neutral greeting...    # no evaluate = always passes
```

Always have a no-evaluate fallback as the last child if you need an "else" branch — a selector with no winning child fails the whole branch.

### Parallel

All children run; **all must succeed.** abtree returns each child's request to the agent in turn — the agent satisfies them in any order. Use for genuinely independent fan-out (gathering context from multiple sources, running multiple checks).

```yaml
type: parallel
name: Gather_Context
children:
  - { type: action, name: Check_Weather, ... }
  - { type: action, name: Check_News, ... }
```

If you can't justify the order being arbitrary, use a `sequence` instead.

### Action

The leaf. A unit of work paired with one or more steps. Each step is either an `evaluate` (a precondition the agent confirms `true` / `false`) or an `instruct` (free-form prose describing the work, the agent reports `success` / `failure` / `running`).

```yaml
- type: action
  name: Determine_Time
  steps:
    - evaluate: $LOCAL.now is set
    - instruct: |
        Get the current hour from the system clock.
        Classify as "morning", "afternoon", or "evening".
        Store at $LOCAL.time_of_day.
```

Steps run in order within an action. If any `evaluate` fails or any `instruct` is submitted as `failure`, the action fails immediately and the parent composite handles the consequence.

## The YAML skeleton

Every tree starts the same way:

```yaml
name: <kebab-case slug, must match filename>
version: <semver>
description: <one-line description shown by `abtree tree list`>

state:
  local:
    <var>: null            # filled by actions during the run
    <var>: null
  global:
    <var>: <literal or instruction>     # read-only after creation

tree:
  type: sequence           # almost always sequence at the root
  name: <PascalCase_With_Underscores>
  children:
    - { ... }
```

`$LOCAL` keys default to `null` when unset; actions populate them. `$GLOBAL` values that look like sentences are interpreted by the agent at runtime (e.g. `user_name: retrieve by running the shell command "whoami"`); literal strings or numbers are constants.

For the full field reference see [Writing trees](/guide/writing-trees).

## Common idioms

### Idiom: bounded code-then-test (retries on a sequence)

The canonical "iterate until satisfied" shape. Wrap one `[code → test]` sequence with `retries: N`. The runtime resets the sequence's internal state and re-ticks on failure, up to N times. User state in `$LOCAL` (counters, drafts, notes) persists across retries.

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

One fragment, one retry config — replaces N hand-written passes.

**When to reach for this:** the work is meaningful at each iteration — write code, then run tests; revise a draft, then review; gather data, then check completeness. Each pass should be something you'd want to inspect in a Mermaid trace.

**Older alternative — selector of passes:** before runtime retries, the same shape was authored as `selector` with N near-identical children, each a separate `[code → test]` sequence. It still works, but it duplicates structure. Prefer `retries` for new trees.

**An anti-pattern:** modelling iteration as a cycle (`test` `$ref`s back to `increment`). Cycles are preserved in the snapshot but cannot be ticked — abtree fails fast on a cyclic edge by design. Use `retries` instead.

```yaml
type: selector
name: Reach_Threshold
children:
  - $ref: "./fragments/pass.yaml"   # pass 1
  - $ref: "./fragments/pass.yaml"   # pass 2
  - $ref: "./fragments/pass.yaml"   # pass 3
  - $ref: "./fragments/pass.yaml"   # pass 4
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

Each pass is a real, observable, resumable step. The bound is explicit in the tree (count the children).

**When to reach for this:** the work is meaningful at each iteration — write code, then run tests; revise a draft, then review; gather data, then check completeness. Each pass should be something you'd want to inspect in a Mermaid trace.

**An anti-pattern that looks similar but isn't:** modelling iteration as a cycle (`test` `$ref`s back to `increment`). Cycles are preserved in the snapshot but cannot be ticked — abtree fails fast on a cyclic edge by design. Use the selector-of-passes shape instead.

### Idiom: bounded retries (selector of attempts)

The same shape as above, applied to retries against transient failure. Each attempt may also do code+test internally; the selector caps the number of full attempts.

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

Each pass writes failure notes to a shared `$LOCAL.<x>_notes` key before failing, so the next pass has something to act on. Three passes is conventional; pick a number that bounds the cost.

### Idiom: tight inner loop inside one action

When the iteration is **not** meaningful at each step — e.g. polling a value, retrying a flaky API call, or any "cap at N tries internally" pattern — fold the loop into a single `instruct` and let the agent enforce the bound.

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

**When to reach for this:** the inner step is uninteresting on its own — you'd never trace it in Mermaid. The runtime sees one action; the loop is the agent's contract.

**Trade-off:** the bound lives in prose, not the tree. Less observable, less resumable, but tighter. Use selector-of-passes when each iteration is a step worth seeing; use this when it isn't.

### Idiom: instruct-then-evaluate gate

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

### Idiom: human-approval gate

abtree doesn't have a native "wait for human" primitive. Express the wait as an `evaluate` on a flag the human sets via `abtree local write`, paired with an `instruct` telling the agent to wait.

```yaml
- type: action
  name: Human_Approval_Gate
  steps:
    - evaluate: $LOCAL.draft is set
    - instruct: |
        Present the draft to the human. Wait for them to confirm by
        calling `abtree local write <execution-id> approved true`. While
        waiting, you may submit `running`. Do NOT submit success
        until they confirm.
    - evaluate: $LOCAL.approved is true
    - instruct: Proceed with the approved draft.
```

The agent uses `submit running` to ack-and-pause without advancing the cursor. The human's `local write` is what unblocks the next `evaluate`.

### Idiom: spec-approved gate

A common variant of the human gate: a downstream tree (`implement`, `backend-design`, `frontend-design`) refuses to run unless an upstream `refine` execution produced a spec with `reviewed_by` populated. Encode it as an early action whose `instruct` checks the file:

```yaml
- type: action
  name: Check_Spec_Approval
  steps:
    - evaluate: $LOCAL.change_request is set
    - instruct: |
        Find the spec in specs/ matching $LOCAL.change_request. Read
        the frontmatter. If reviewed_by is empty, return failure with
        a note that codeowner approval is needed. Otherwise store the
        full spec content at $LOCAL.spec_content.
```

The action either succeeds (spec content available) or fails (parent sequence aborts, surfacing the missing approval).

### Idiom: parallel context-gathering with shared dependency

When multiple branches need to read a value produced by an earlier step, that step has to be in a parent `sequence`, not the parallel itself. Don't fight this — accept that fan-out happens after fan-in.

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

Each parallel branch can have its own `evaluate: $LOCAL.x is set` precondition for safety.

### Idiom: globals as parameterless retrieval directives

When a chunk of work has well-known guidance — code-review checklists, design heuristics, security-review playbooks — don't reproduce it inside an `instruct` and don't store a raw URL or path either. Store the **retrieval directive itself** in `$GLOBAL`. Actions invoke it by name.

The default home for shared playbooks is `.abtree/playbooks/<name>.md`, alongside `.abtree/trees/`:

```yaml
state:
  global:
    code_review: |
      Read the file at .abtree/playbooks/code-review.md
      (relative to the project root) and return its full body
      as text.

tree:
  ...
  - type: action
    name: Run_Review
    steps:
      - evaluate: $LOCAL.target is set
      - instruct: >
          Use $GLOBAL.code_review to assess $LOCAL.target.
          Capture findings at $LOCAL.findings.
```

The global is a parameterless directive: "read X, return text." The action composes against the result. Multiple actions in the same tree can invoke the same global without repeating the read boilerplate.

**Why this shape:**

- **Action prose stays focused.** Each `instruct` says *what to do with the result*, not how to retrieve it.
- **Single source of truth.** One place defines where the playbook lives. Swap the path in one spot to repoint every action that uses it.
- **Composable.** Multiple actions can invoke the same global (`Use $GLOBAL.code_review's pre-flight against …`, `Use $GLOBAL.code_review's posting rules to …`) without duplicating retrieval instructions.
- **Curated.** Local files let you trim third-party guidance to your project's lens — strip vendor-specific tooling, tighten the bar, add house rules — without forking the upstream document.
- **Reproducible.** A playbook checked into the repo is git-tracked; flows created against today's tree run against today's playbook.

**Variants:** the directive's body can describe any retrieval — read a file, fetch a URL, query an internal docs system. Local file is the default because it's reproducible and curatable; reach for HTTP only when you genuinely need the upstream's evolving copy.

### Idiom: split a large tree across files

For trees that exceed a screenful of YAML, factor out reusable subtrees with JSON-Schema-style `$ref`. abtree resolves references at execution-creation time, so the runtime always sees one assembled snapshot.

```yaml
tree:
  type: sequence
  children:
    - $ref: "./fragments/auth.yaml"          # relative to this file
    - $ref: "/srv/abtree/shared/cleanup.yaml" # absolute path
    - $ref: "https://example.com/audit.yaml"  # remote URL
```

The fragment file is a single node — same shape as any inline child:

```yaml
# fragments/auth.yaml
type: sequence
name: Auth_Sequence
children:
  - { type: action, name: Login, steps: [...] }
```

Fragments do NOT carry top-level `name` / `version` / `description` / `state`. Those live only on the root tree.

### Idiom: optional pre-step that doesn't block

If a step is "do this if you can, otherwise skip", wrap it in a `selector` whose second child is a no-op:

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

## Naming and structure rules

- **Tree slug** (the YAML `name` and the filename): kebab-case (`hello-world`, `code-review`).
- **Node names**: PascalCase with underscores (`Choose_Greeting`, `Check_Weather`). Mermaid renders `_` as space.
- **Composite names** describe the *decision*: `Choose_Greeting`, `Gather_Context`, `Write_With_Retries`. Action names describe the *work*: `Determine_Time`, `Compose_Response`.
- **Root sequence name** is usually `<Tree>_Workflow`.
- **`$LOCAL` keys** are the variables the tree creates; **`$GLOBAL` keys** are the world the tree reads. Don't mix.

## Gotchas — things that look right but aren't

### No native loops

abtree has no repeater, no while-condition, no "back to step N". Anything that needs to retry must be expressed as a finite series of `selector` children. If a workflow needs unbounded iteration, fold the iteration into a single `instruct` and let the agent handle it internally — but cap it ("at most 3 attempts, then submit failure").

### No unbounded retries

A `selector` with N children gives you N attempts. There's no shape that gives unlimited attempts. This is intentional — unbounded retries are a footgun for agents.

### Every action needs an evaluate precondition

Even when "obviously the precondition holds", write the evaluate. It documents the contract, gives the runtime a chance to short-circuit on bad state, and surfaces failures earlier with clearer messages. Pure-instruct actions (no evaluate) are reserved for the last child of a selector that's serving as a fallback.

### `$LOCAL` keys are scoped to one execution

`$LOCAL` is per-execution, not per-tree. Two executions of the same tree have isolated `$LOCAL`. Don't design as if state persists across runs — if you need cross-run state, the agent has to explicitly read/write external files via the instruct text.

### Internal bookkeeping keys are reserved

abtree writes `_node_status__<path>` and `_step__<path>` keys to `$LOCAL` to track cursor state across resumption. Don't write to these keys; don't expect to read them in actions. They're documented in [Inspecting executions](/guide/inspecting-executions) for diagnostics, not for use.

### A selector with all evaluate-gated children needs a default

If every child has an `evaluate` precondition that might fail, the selector fails when none match. If you want a "none of the above" branch, add a no-evaluate action as the last child.

### Ordering inside a `parallel`

Don't depend on parallel children running in YAML order. The agent receives requests for each child in turn, but is free to satisfy them in any sequence. If you need ordering, use `sequence`.

### `submit running` keeps the cursor put

Use `submit running` only when waiting on something external (a human approval, a long-running tool). The execution stays in `performing` phase; `abtree next` returns the same instruct. Don't use it to "skip" an instruct.

## Worked design — the "review with retries" pattern

Putting the idioms together: a Write → Review → Retry workflow.

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

This combines: bounded retries via selector-of-attempts, instruct-then-evaluate gates that populate notes-on-failure, and a clear failure mode (selector exhausts → execution fails with the latest review_notes preserved for the human to read).

## Process for designing a new tree

When a human asks "help me design a tree for `<X>`", work in this order:

1. **Name the success state.** What single sentence describes "the workflow finished correctly"? That's the post-condition the root sequence must establish.
2. **List the discrete tasks.** Each task → one action with an `instruct`. Each task's *precondition* → that action's `evaluate`.
3. **Group dependent tasks into sequences.** "Do A before B" → `sequence: [A, B]`.
4. **Identify decisions.** Each "if X then Y else Z" → `selector` with evaluate-gated children.
5. **Identify fan-out.** Each "do these in any order" → `parallel`.
6. **Identify gates.** Each "the human / a downstream system must approve" → an `evaluate` on a flag they set.
7. **Identify retries.** Each "we should try this a few times before giving up" → `selector` of N attempts, each carrying notes from the previous failure.
8. **State the input contract.** What `$LOCAL` keys must be set before the first action evaluates? Document them in `state.local`.
9. **Sketch the tree top-down**, then walk the failure modes — what happens if action N fails? Does the parent composite handle it the way the design intended?
10. **Save as `.abtree/trees/<slug>.yaml`** and run `abtree tree list` to validate the YAML.

## Next

- [Writing trees](/guide/writing-trees) — full YAML field reference.
- [Inspecting executions](/guide/inspecting-executions) — what the runtime writes back as an execution runs.
- [Branches and actions](/concepts/branches-and-actions) — primitive semantics in detail.
- [Examples](/examples) — six ready-to-use trees that exercise every idiom on this page.
