---
description: The four primitives of an abtree behaviour tree — sequence, selector, parallel, and action — and how each one defines control flow.
---

# Branches and actions

Three branch types. One leaf type. That is the whole language.

A **tick** is one evaluation pass through the tree by the runtime: the cursor visits the current node, returns success or failure, and advances or retries.

## Branches

Branches define the **flow of control**. They have children. Their job is to coordinate which children run, in what order, and what counts as success.

### Sequence

Run children in order. **All must succeed.** If any child fails, the sequence fails.

Use a sequence for linear workflows where each step depends on the previous one.

```yaml
type: sequence
name: Deploy_Service
children:
  - type: action
    name: Run_Tests
  - type: action
    name: Build_Image
  - type: action
    name: Push_To_Registry
```

If `Run_Tests` fails, the sequence aborts. The build never happens. The push never happens.

### Selector

Run children in order until one **succeeds**. If all fail, the selector fails.

A selector is the decision-making primitive — the equivalent of an if/else chain.

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
    name: Afternoon_Greeting
    steps:
      - evaluate: $LOCAL.time_of_day is "afternoon"
      - instruct: ...
```

The selector tries `Morning_Greeting`'s evaluate first. If it passes, the morning instruct runs and the selector finishes. Otherwise it falls through to `Afternoon_Greeting`.

### Parallel

Run all children. **All must succeed.**

Use a parallel when steps are independent and can run in any order.

```yaml
type: parallel
name: Gather_Context
children:
  - type: action
    name: Check_Weather
  - type: action
    name: Check_News
```

The agent receives both `instruct` requests and satisfies them in any order. If either fails, the parallel fails.

## Actions

Actions are the **leaves** of the tree. Each is a small, focused unit of work made of two kinds of step:

```yaml
type: action
name: Determine_Time
steps:
  - evaluate: $LOCAL.now is set
  - instruct: |
      Get the current hour from the system clock.
      Classify as "morning", "afternoon", or "evening".
      Store at $LOCAL.time_of_day.
```

### `evaluate`

A precondition. A semantic boolean expression checked against `$LOCAL` and `$GLOBAL`. The agent reads it, decides whether it is true, and submits the answer with `abtree eval <execution> true|false`.

If `false`, the action fails immediately. The runtime advances by branch rules: a sequence aborts; a selector tries the next child.

### `instruct`

The work. Free-form prose telling the agent what to do. The agent does it, writes results to `$LOCAL`, and calls `abtree submit <execution> success` to advance.

An action can have multiple steps — alternating evaluates and instructs — to handle multi-stage logic in a single leaf.

## Retries

Any node — composite or action — can carry a `retries: N` config. On failure the runtime wipes the node's internal bookkeeping (status, step index, descendants), bumps an internal retry counter, and re-ticks the node from a clean slate. After `N` retries are exhausted, the failure propagates normally. User state in `$LOCAL` persists across retries — that is the feedback channel between attempts.

```yaml
type: sequence
name: Write_And_Review
retries: 2          # one initial attempt + 2 retries = 3 total attempts
children:
  - { type: action, name: Write,  steps: [...] }
  - { type: action, name: Review, steps: [...] }
```

## Putting it together

A tree with all four primitives:

```yaml
type: sequence              # do these in order
children:
  - type: action            # step 1: figure out the time
    name: Determine_Time
    steps:
      - instruct: ...

  - type: selector          # step 2: pick a branch by time of day
    name: Choose_Greeting
    children:
      - type: action
        name: Morning_Greeting
        steps:
          - evaluate: $LOCAL.time_of_day is "morning"
          - instruct: ...
      - type: action
        name: Afternoon_Greeting
        steps:
          - evaluate: $LOCAL.time_of_day is "afternoon"
          - instruct: ...
      - type: action
        name: Evening_Greeting
        steps:
          - evaluate: $LOCAL.time_of_day is "evening"
          - instruct: ...
      - type: action
        name: Default_Greeting
        steps:
          - instruct: ...

  - type: parallel          # step 3: gather context concurrently
    name: Gather_Context
    children:
      - type: action
        name: Check_Weather
        steps:
          - instruct: ...
      - type: action
        name: Check_News
        steps:
          - instruct: ...

  - type: action            # step 4: compose the final response
    name: Compose_Response
    steps:
      - evaluate: $LOCAL.weather is set and $LOCAL.news is set
      - instruct: ...
```

The bundled `hello-world` tree covers the first three primitives (sequence, selector, action); the bundled `improve-codebase` tree exercises a real-world parallel.

## Next

- [Using a tree](/guide/using-trees) — install a published tree and drive it with your agent.
- [State](/concepts/state) — the two scopes the primitives read and write.
- [Writing trees](/guide/writing-trees) — turn this into YAML.
- [Inspecting executions](/guide/inspecting-executions) — how the runtime walks the tree at tick time.
