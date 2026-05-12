---
title: Writing trees
description: Build the bundled hello-world tree from scratch — folder layout, YAML structure, state, primitives, retries. End-to-end tutorial that points at the reference for field-by-field detail.
---

# Writing trees

This page walks you through writing a tree by re-creating the bundled `hello-world`. By the end you have a working tree you can drive with `abtree execution create`. For the full YAML field reference, see [Authoring trees](/agents/author).

## What you build

```text
.abtree/trees/hello-world/
├── TREE.yaml
└── package.json
```

`TREE.yaml` defines the workflow. `package.json` declares the entry file so the CLI knows where to load the tree from. The folder name is the **slug** you pass to `abtree execution create`.

## 1. Create the folder

```sh
mkdir -p .abtree/trees/hello-world
cd .abtree/trees/hello-world
```

Project-local trees live under `.abtree/trees/<slug>/` in the current working directory. User-global trees live under `~/.abtree/trees/<slug>/`. Project-local wins on slug collision.

## 2. Declare the entry file

```json
{ "name": "hello-world", "main": "TREE.yaml" }
```

Save as `package.json`. The runtime never assumes `TREE.yaml` — `main` has to declare the entry.

## 3. Write the top-level fields

Create `TREE.yaml` with the four required scalars and the `state` block:

```yaml
# yaml-language-server: $schema=https://abtree.sh/schemas/tree.schema.json

name: hello-world
version: 1.0.0
description: Greet a user based on time of day.

state:
  local:
    time_of_day: null     # filled in by Determine_Time
    greeting: null        # filled in by the winning Choose_Greeting branch
  global:
    user_name: retrieve by running the shell command "whoami"
    tone: friendly
    language: english
```

`state.local` declares the `$LOCAL` keys actions read and write during the run. `null` defaults are common — the actions populate them. `state.global` declares the `$GLOBAL` keys the tree reads. Sentence-shaped values are **directives**: when an action reads `$GLOBAL.user_name`, the agent runs `whoami` and returns the result.

For the full field list (and the schema constraints on each field), see [File shape](/agents/author#file-shape).

## 4. Add the root sequence

```yaml
tree:
  type: sequence
  name: Hello_World
  children:
    - type: action
      name: Determine_Time
      steps:
        - instruct: >
            Check the system clock. Classify as "morning", "afternoon",
            or "evening". Store at $LOCAL.time_of_day.
```

`tree:` is the root node. It is a single node — in practice almost always a `sequence`, so steps run in order. `Determine_Time` is the first child: one `action` with one `instruct` step.

Node names use **PascalCase with underscores** (`Determine_Time`). Mermaid diagrams render `_` as a space, so `Choose_Greeting` becomes "Choose Greeting" in the trace.

## 5. Add the selector

```yaml
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

The `selector` runs children in order until one succeeds. Each branch is gated by an `evaluate` precondition. The final child has no `evaluate`, so it always passes — that is the fallback for "none of the above matched". A selector with no winning child fails the whole branch.

## 6. Validate it loads

```sh
cd /path/to/your/repo/root
abtree execution create hello-world "first run"
```

If the YAML is well-formed, the CLI prints the new execution document and the slug becomes available to `abtree next`. If it is not, the CLI prints a path-prefixed validation error and exits non-zero.

## What you skipped

`hello-world` covers three of the four primitives. The fourth — `parallel` — runs all children concurrently and succeeds only if every child succeeds. Drop one in when you have two reads that do not depend on each other:

```yaml
- type: parallel
  name: Gather_Context
  children:
    - { type: action, name: Read_Schema, steps: [...] }
    - { type: action, name: Read_Conventions, steps: [...] }
```

The bundled `improve-codebase` tree ships a real-world parallel: four metric scorers running concurrently against the same codebase.

## Where to go next

- **Refactor it into fragments.** See [Fragments](/guide/fragments) for the `$ref` workflow and snapshot semantics.
- **Add a retries config.** Any node can carry `retries: N`. See [Authoring trees](/agents/author#retries) for the reference behaviour.
- **Pick the right shape for a new workflow.** See [Design a new tree](/guide/design-process) for the ten-step process and [Idioms](/guide/idioms) for the catalogue of reusable shapes.
- **Test it.** See [Testing trees](/guide/testing) for the `@abtree/test-tree` workflow.

## Next

- [Fragments](/guide/fragments) — split a large tree across files using `$ref`.
- [Authoring trees](/agents/author) — full YAML field reference.
- [CLI reference](/guide/cli) — every command, every flag.
