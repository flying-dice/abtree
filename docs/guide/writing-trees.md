# Writing your own tree

This page walks through the YAML structure of a tree using the bundled `hello-world` example as the reference.

## File layout

Trees live in `.abtree/trees/<slug>.yaml`. The slug becomes the tree name shown in `abtree tree list`.

```
.abtree/
  trees/
    hello-world.yaml
    code-review.yaml
    deploy.yaml
  flows/                              # populated as you create flows
    first-run__hello-world__1.json
    first-run__hello-world__1.mermaid
```

### Project-local vs user-global

`abtree tree list` searches two directories:

1. `.abtree/trees/` in the **current working directory** — project-local, committed with the code.
2. `~/.abtree/trees/` in your **home directory** — user-global, available in every project.

The project-local copy wins if both define the same slug. Drop a tree in `~/.abtree/trees/` to make it your default everywhere; commit a same-named file under `.abtree/trees/` to override it for one project.

Flows always go into the cwd's `.abtree/flows/` regardless of where the tree was sourced from.

### Splitting a tree across files

Large trees can be split using JSON-Schema-style `$ref` references.
abtree resolves them at flow-creation time via
[`@apidevtools/json-schema-ref-parser`](https://github.com/APIDevTools/json-schema-ref-parser),
so the rest of the runtime sees one fully-resolved snapshot.

```yaml
# .abtree/trees/big-workflow.yaml
name: big-workflow
version: 1.0.0
description: Composed of separately-authored fragments.

tree:
  type: sequence
  name: Big_Workflow
  children:
    - $ref: "./fragments/auth.yaml"
    - $ref: "./fragments/work.yaml"
    - $ref: "./fragments/cleanup.yaml"
```

```yaml
# .abtree/trees/fragments/auth.yaml
type: sequence
name: Auth_Sequence
children:
  - { type: action, name: Login, steps: [...] }
  - { type: action, name: Verify, steps: [...] }
```

`$ref` accepts:

- **Relative paths** (`./fragments/auth.yaml`) — resolved against the file containing the `$ref`.
- **Absolute paths** (`/home/.../shared/tree.yaml`).
- **URLs** (`https://example.com/shared-trees/auth.yaml`).

A fragment file is just a node — it does NOT carry the top-level `name`, `version`, `description`, `state` keys. Those live on the root tree only. Each fragment is the value for the position it's referenced from (a single composite or action node).

The merged tree is written into the flow's `snapshot` field at flow-creation time, so editing fragments after creation does not affect existing flows — only new flows pick up the change.

## Top-level structure

```yaml
name: hello-world
version: 1.0.0
description: Greet a user based on time of day.

state:
  local:
    time_of_day: null
    greeting: null
  global:
    user_name: retrieve by running the shell command "whoami"

tree:
  type: sequence
  name: Hello_World
  children: [...]
```

| Field | Purpose |
|---|---|
| `name` | Slug. Must match the filename. |
| `version` | Free-form. Bump when you change the tree. |
| `description` | One-line description shown in `abtree tree list`. |
| `state.local` | Initial `$LOCAL` keys. `null` is fine — they get filled in by actions. |
| `state.global` | `$GLOBAL` values. Strings are interpreted as instructions for how to fetch them. |
| `tree` | The root node. Always a single node — usually a `sequence`. |

## State

The `state.local` block defines the *shape* of `$LOCAL` at flow creation. Use `null` for slots that get populated by actions during the run. Use literal values for defaults.

```yaml
state:
  local:
    time_of_day: null      # filled in by Determine_Time
    greeting: null         # filled in by Choose_Greeting branch
    weather: null
    news: null
    response: null
  global:
    user_name: retrieve by running the shell command "whoami"
    tone: friendly
    language: english
```

`$GLOBAL` values that look like sentences ("retrieve by running...") are interpreted by the agent at runtime — they're prompts, not data. Literal strings and numbers are constants the agent reads as-is.

## Tree

The `tree:` block is the root. It's a single node. In practice you'll almost always start with a `sequence` so steps run in order.

### Composite nodes

`sequence`, `selector`, and `parallel` all share the same shape:

```yaml
type: sequence | selector | parallel
name: Friendly_Name              # used in mermaid diagrams
children:
  - { ... node 1 ... }
  - { ... node 2 ... }
```

### Action nodes

```yaml
type: action
name: Friendly_Name
steps:
  - evaluate: <expression>
  - instruct: <prose>
  - evaluate: <another expression>
  - instruct: <more prose>
```

You can have any number of steps in any order. They run sequentially within the action — the agent finishes step 1 before step 2 appears.

### Retries (any node)

Any node — action or composite — can carry a `retries: N` config. When the runtime sees that node fail, it wipes the node's internal bookkeeping (status, step index, descendants), bumps an internal retry counter, and re-ticks the node from a clean slate. After N retries are exhausted, the failure propagates normally.

```yaml
type: sequence
name: Write_And_Review
retries: 2          # one initial attempt + 2 retries = 3 total attempts
children:
  - { type: action, name: Write,  steps: [...] }
  - { type: action, name: Review, steps: [...] }
```

User state in `$LOCAL` (drafts, counters, review notes) **persists across retries** — that's the whole feedback channel. Internal state (which actions have run, where the cursor is) is wiped between attempts.

This is the canonical replacement for the older "selector of N hand-written passes" shape — one retry config, one fragment, instead of N near-identical siblings.

## Naming

Use **PascalCase with underscores** for node names: `Choose_Greeting`, `Check_Weather`. Mermaid diagrams render `_` as spaces, so `Choose_Greeting` becomes "Choose Greeting" in the rendered output.

Tree slugs (the filename) are **kebab-case**: `hello-world`, `code-review`.

## Worked example

The full hello-world tree, annotated:

```yaml
name: hello-world
version: 1.0.0
description: Greet a user based on time of day with weather and news context.

state:
  local:
    time_of_day: null     # filled by Determine_Time
    greeting: null        # filled by the Choose_Greeting branch that wins
    weather: null
    news: null
    response: null
  global:
    user_name: retrieve by running the shell command "whoami"
    tone: friendly
    language: english

tree:
  type: sequence
  name: Hello_World
  children:

    # 1. Single action with one instruct step.
    - type: action
      name: Determine_Time
      steps:
        - instruct: >
            Check the system clock. Classify as "morning", "afternoon",
            or "evening". Store at $LOCAL.time_of_day.

    # 2. Selector — only one branch wins, the rest are skipped.
    - type: selector
      name: Choose_Greeting
      children:
        - type: action
          name: Morning_Greeting
          steps:
            - evaluate: $LOCAL.time_of_day is "morning"
            - instruct: Compose a cheerful morning greeting...
        - type: action
          name: Afternoon_Greeting
          steps:
            - evaluate: $LOCAL.time_of_day is "afternoon"
            - instruct: Compose a warm afternoon greeting...
        - type: action
          name: Default_Greeting
          steps:
            - instruct: Compose a neutral greeting...    # no evaluate = always passes

    # 3. Parallel — both children must succeed.
    - type: parallel
      name: Gather_Context
      children:
        - type: action
          name: Check_Weather
          steps:
            - evaluate: $LOCAL.greeting is set
            - instruct: Use a web search tool to find current weather...
        - type: action
          name: Check_News
          steps:
            - evaluate: $LOCAL.greeting is set
            - instruct: Use a web search tool to find one current headline...

    # 4. Final action — depends on the parallel's outputs.
    - type: action
      name: Compose_Response
      steps:
        - evaluate: $LOCAL.weather is set and $LOCAL.news is set
        - instruct: Combine $LOCAL.greeting, $LOCAL.weather, and $LOCAL.news...
```

## Editing your own

Copy a bundled tree to a new file and tweak. Try:

- Add a new `evening_off_hours` branch to `Choose_Greeting` with an evaluate that fires after 22:00.
- Add a `Check_Calendar` action to `Gather_Context` (parallel will pick it up automatically).
- Replace `Compose_Response` with two actions: one to draft, one to format.

Every change is reflected the next time you run `abtree flow create <your-tree>`.

## Validation

abtree validates the YAML on load. If a tree is malformed, `abtree tree list` won't include it and `abtree flow create` will print the error.

## Next

- [CLI reference](/guide/cli) — every command, every flag.
