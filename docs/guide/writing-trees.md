---
title: Writing trees
description: Build the bundled hello-world tree from scratch — folder layout, file structure, state, primitives, retries. End-to-end tutorial that points at the reference for field-by-field detail.
---

# Writing trees

This page walks you through writing a tree by re-creating the bundled `hello-world`. By the end you have a working tree you can drive with `abtree execution create`. For the full field reference, see [Authoring trees](/agents/author).

## What you build

A single `hello-world.yaml` file. abtree reads tree files by literal path — no slug lookup, no `package.json` discovery, no conventional directory layout. Put the file wherever fits your project; the tree file's own `name` field is the slug abtree uses inside execution IDs.

## 1. Create the file

```sh
mkdir -p trees && cd trees
touch hello-world.yaml
```

## 2. Write the top-level fields

Open `hello-world.yaml` with the four required scalars and the `state` block:

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

## 3. Add the root sequence

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

Node names use **PascalCase with underscores** (`Determine_Time`). The SVG trace renders `_` as a space, so `Choose_Greeting` becomes "Choose Greeting" in the diagram.

## 4. Add the selector

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

## 5. Validate it loads

```sh
abtree execution create ./trees/hello-world.yaml "first run"
```

If the tree is well-formed, the CLI prints the new execution document and you can drive it with `abtree next`. If it is not, the CLI prints a path-prefixed validation error and exits non-zero.

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
- **Test it.** Two options: [Testing trees](/guide/testing) for BDD-style YAML specs via `@abtree/test-tree`, or [Programmatic test harness](/guide/test-harness) for deterministic TypeScript assertions via `@abtree/testing`.

## Next

- [Fragments](/guide/fragments) — split a large tree across files using `$ref`.
- [Authoring trees](/agents/author) — full field reference.
- [CLI reference](/guide/cli) — every command, every flag.
