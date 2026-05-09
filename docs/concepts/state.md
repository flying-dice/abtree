# State

Behaviour trees are stateful by design. abtree separates state into **two scopes**, written explicitly, never implicit.

## $LOCAL — the workflow's blackboard

`$LOCAL` is a key-value store private to one execution. Actions read from it, write to it, and use it to thread data between steps.

Examples:

- `$LOCAL.greeting = "Good morning, Alice!"` — output of one step, input to the next.
- `$LOCAL.confidence_score = 0.92` — a number computed during the run.
- `$LOCAL.error_log = [...]` — an accumulating list.

`$LOCAL` is initialised when the execution is created. Every state change persists immediately to the execution's JSON document — kill the process and resume tomorrow.

## $GLOBAL — the world model

`$GLOBAL` describes the **environment** the agent is operating in. You don't *set* `$GLOBAL` values from inside the execution — you *observe* them.

Examples:

```yaml
state:
  global:
    user_name: retrieve by running the shell command "whoami"
    current_branch: the output of git rev-parse --abbrev-ref HEAD
    api_endpoint: https://api.example.com
    tone: friendly
```

Notice the first two values aren't literals — they're **instructions** for how to fetch them. The agent reads `$GLOBAL.user_name`, sees a sentence, and runs `whoami`. The third is a literal that never changes during the execution. The fourth is a configuration knob.

## Why two scopes?

The distinction matters. `$LOCAL` is something **your tree creates**. `$GLOBAL` is something **the world tells you**.

Putting them in different scopes makes the contract explicit:

- An action that reads `$GLOBAL.user_name` knows the value comes from the environment.
- An action that reads `$LOCAL.greeting` knows the value was computed earlier in the execution.

Mixing them — like a single "context" object — hides where data came from. That's the bug surface that bites agentic systems hardest: was this value something I produced, or something I read? abtree makes you answer up front.

## Reading and writing

```sh
# Read all of $LOCAL
abtree local read <execution-id>

# Read a specific path (dot-notation)
abtree local read <execution-id> greeting

# Write a value
abtree local write <execution-id> greeting "Good morning, Alice!"

# Read $GLOBAL
abtree global read <execution-id>
abtree global read <execution-id> user_name
```

Values are JSON-parsed when possible, so `abtree local write <id> ready true` stores a boolean, not the string `"true"`.

`$GLOBAL` is read-only via the CLI — values come from the tree's `state.global` block at execution creation.

## Next

- [Branches and actions](/concepts/branches-and-actions) — the four primitives that drive the tree.
