---
description: Walkthrough of the abtree YAML schema — name, version, state, and tree — using the bundled hello-world example as the reference.
---

# Writing your own tree

This page walks through the YAML structure of a tree using the bundled `hello-world` example as the reference.

## File layout

Trees live in `.abtree/trees/<slug>/`. The folder name is the slug you pass to `abtree execution create <slug>`. Each folder must hold a `TREE.yaml` and a `package.json` whose `main` points at it — the runtime never assumes `TREE.yaml`, so the entry has to be declared.

```
.abtree/
  trees/
    hello-world/
      TREE.yaml
      package.json                         # { "name": "hello-world", "main": "TREE.yaml" }
    refine-plan/
      TREE.yaml
      package.json
    my-big-workflow/
      TREE.yaml
      package.json
      fragments/
        auth.yaml
  executions/                              # populated as you create executions
    first-run__hello-world__1.json
    first-run__hello-world__1.mermaid
```

### Project-local vs user-global

Slug lookup searches two directories:

1. `.abtree/trees/` in the **current working directory** — project-local, committed with the code.
2. `~/.abtree/trees/` in your **home directory** — user-global, available in every project.

The project-local copy wins if both define the same slug. Drop a tree in `~/.abtree/trees/` to make it your default everywhere; commit a same-named folder under `.abtree/trees/` to override it for one project.

You don't have to use the slug convention at all — pointing `execution create` at an explicit YAML path or directory works the same way, and is the typical pattern for trees installed as node packages (`./node_modules/<pkg-name>`).

Executions always go into the cwd's `.abtree/executions/` regardless of where the tree was sourced from.

### Splitting a tree across files

Large trees can be split across files using JSON-Schema `$ref`:

```yaml
tree:
  type: sequence
  name: Big_Workflow
  children:
    - $ref: "./fragments/auth.yaml"
    - $ref: "./fragments/work.yaml"
```

abtree dereferences every ref at execution-creation time, so the runtime sees a single merged snapshot. See [Fragments](/guide/fragments) for layout, the three `$ref` forms (relative, absolute, URL), snapshot semantics, and how fragments interact with the test suite during refactors.

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
| `description` | One-line description of what the tree does, surfaced in tooling and the registry. |
| `state.local` | Initial `$LOCAL` keys. `null` is fine — they get filled in by actions. |
| `state.global` | `$GLOBAL` values. Strings are interpreted as instructions for how to fetch them. |
| `tree` | The root node. Always a single node — usually a `sequence`. |

## State

The `state.local` block defines the *shape* of `$LOCAL` at execution creation. Use `null` for slots that get populated by actions during the run. Use literal values for defaults.

```yaml
state:
  local:
    time_of_day: null      # filled in by Determine_Time
    greeting: null         # filled in by Choose_Greeting branch
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

Use **PascalCase with underscores** for node names: `Choose_Greeting`, `Determine_Time`. Mermaid diagrams render `_` as spaces, so `Choose_Greeting` becomes "Choose Greeting" in the rendered output.

Tree slugs (the folder name) are **kebab-case**: `hello-world`, `improve-codebase`.

## Worked example

The full hello-world tree, annotated:

```yaml
name: hello-world
version: 2.0.0
description: Greet a user based on time of day.

state:
  local:
    time_of_day: null     # filled by Determine_Time
    greeting: null        # filled by the Choose_Greeting branch that wins
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
          name: Evening_Greeting
          steps:
            - evaluate: $LOCAL.time_of_day is "evening"
            - instruct: Compose a relaxed evening greeting...
        - type: action
          name: Default_Greeting
          steps:
            - instruct: Compose a neutral greeting...    # no evaluate = always passes
```

`hello-world` covers `sequence`, `selector`, and `action`. The fourth primitive — `parallel` — runs all children at once and succeeds only if every child succeeds. Drop one in when you have two independent reads that don't depend on each other:

```yaml
- type: parallel
  name: Gather_Context
  children:
    - { type: action, name: Read_Schema, steps: [...] }
    - { type: action, name: Read_Conventions, steps: [...] }
```

`improve-codebase` ships a real-world parallel — four metric scorers running concurrently against the same codebase.

## Editing your own

Copy a bundled tree to a new file and tweak. Try:

- Add a new `evening_off_hours` branch to `Choose_Greeting` with an evaluate that fires after 22:00.
- Wrap the selector's chosen greeting and a follow-up `Compose_Closing` action in a final `sequence`, so the closing always runs after the greeting is set.
- Add a `parallel` after `Choose_Greeting` to fan out two enrichment actions before the tree finishes.

Every change is reflected the next time you run `abtree execution create <your-tree>`.

## Validation

abtree validates the YAML on load. If a tree is malformed, `abtree execution create` will print the error and exit non-zero rather than starting an execution.

## Next

- [CLI reference](/guide/cli) — every command, every flag.
