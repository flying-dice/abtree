# Branches and actions

Three branch types. One leaf type. That's the whole language.

## Branches

Branches define the **flow of control**. They have children. Their job is to coordinate which children run, in what order, and what counts as success.

### Sequence

Run children in order. **All must succeed.** If any child fails, the sequence fails.

Use it for linear workflows where each step depends on the previous one.

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

This is your decision-making primitive — the equivalent of an if/else chain.

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

Use it when steps are independent and can be done in any order.

```yaml
type: parallel
name: Gather_Context
children:
  - type: action
    name: Check_Weather
  - type: action
    name: Check_News
```

The agent gets both `instruct` requests and can satisfy them in any order. If either fails, the parallel fails.

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

A precondition. A semantic boolean expression checked against `$LOCAL` and `$GLOBAL`. The agent reads it, decides if it's true, and submits the answer with `abtree eval <flow> true|false`.

If `false`, the action fails immediately. The runtime advances by branch rules: a sequence aborts; a selector tries the next child.

### `instruct`

The work. Free-form prose telling the agent what to do. The agent does it, writes results to `$LOCAL`, and calls `abtree submit <flow> success` to advance.

An action can have multiple steps — alternating evaluates and instructs — to handle multi-stage logic in a single leaf.

## Putting it together

A real tree:

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
      - { Morning_Greeting }
      - { Afternoon_Greeting }
      - { Evening_Greeting }
      - { Default_Greeting }

  - type: parallel          # step 3: gather context concurrently
    name: Gather_Context
    children:
      - { Check_Weather }
      - { Check_News }

  - type: action            # step 4: compose the final response
    name: Compose_Response
    steps:
      - evaluate: $LOCAL.weather is set and $LOCAL.news is set
      - instruct: ...
```

That's the full hello-world tree. Four primitives. Sixteen lines of structure. Reproducible execution.

## How the loop runs

When you call `abtree next <flow>`, the runtime walks the tree from the root, looking for the next pending step:

1. It descends into the first incomplete child of a sequence, or the first untried child of a selector, or all children of a parallel.
2. It returns the first pending `evaluate` or `instruct` it finds.
3. You answer with `abtree eval` or `abtree submit`.
4. The runtime updates state, recomputes the cursor, and waits for the next `abtree next`.

You never need to track "where am I" yourself. The cursor lives in the JSON document. Restart your terminal, restart your agent — the next `abtree next` picks up exactly where you left off.

## Next

- [Writing your own tree](/guide/writing-trees) — turn this into YAML.
- [CLI reference](/guide/cli) — every command, every flag.
