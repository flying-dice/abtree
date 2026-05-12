---
description: Two state scopes in abtree — $LOCAL is a per-execution blackboard agents read and write; $GLOBAL is a read-only world model the tree observes.
---

# State

Behaviour trees are stateful by design. abtree separates state into **two scopes**, written explicitly, never implicit.

A **blackboard** is the term used in the behaviour-tree and game-AI literature for a key-value store scoped to one execution and used to pass data between steps. In abtree the blackboard is `$LOCAL`.

## `$LOCAL` — the workflow's blackboard

`$LOCAL` is a key-value store private to one execution. Actions read from it, write to it, and use it to thread data between steps.

Examples:

- `$LOCAL.greeting = "Good morning, Alice!"` — output of one step, input to the next.
- `$LOCAL.confidence_score = 0.92` — a number computed during the run.
- `$LOCAL.error_log = [...]` — an accumulating list.

`$LOCAL` is initialised when the execution is created. Every state change persists immediately to the execution's JSON document — kill the process and resume tomorrow.

## `$GLOBAL` — the world model

`$GLOBAL` describes the **environment** the agent operates in. You do not write `$GLOBAL` values from inside the execution — you observe them.

Examples:

```yaml
state:
  global:
    user_name: retrieve by running the shell command "whoami"
    current_branch: the output of git rev-parse --abbrev-ref HEAD
    api_endpoint: https://api.example.com
    tone: friendly
```

The first two values are not literals — they are **directives** that tell the agent how to fetch the value. When an action reads `$GLOBAL.user_name`, the agent runs `whoami` and uses the result. The third value is a literal that never changes during the execution. The fourth is a configuration knob.

## Why two scopes

The distinction is the contract. `$LOCAL` is something **your tree creates**. `$GLOBAL` is something **the world tells you**.

Putting them in different scopes makes the source of every value explicit:

- An action that reads `$GLOBAL.user_name` knows the value comes from the environment.
- An action that reads `$LOCAL.greeting` knows the value was computed earlier in the execution.

Mixing them — a single "context" object — hides where data came from. That is the bug surface that hurts agentic systems hardest: was this value something I produced, or something I read? abtree makes you answer up front.

## Reading and writing from the CLI

Both scopes are reachable from the CLI — see [CLI reference](/guide/cli).

## Next

- [Branches and actions](/concepts/branches-and-actions) — the four primitives that drive the tree.
- [Why behaviour trees?](/concepts/) — back to the concept overview.
