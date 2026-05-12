---
title: Fragments
description: Split a large tree across files using JSON-Schema-style $ref. abtree resolves fragments at execution-creation time, so the runtime sees one fully-merged snapshot.
---

# Fragments

A tree can grow past the point where one YAML file is comfortable. **Fragments** let you split it across files using JSON-Schema `$ref`. abtree dereferences every ref at execution-creation time, so the runtime — and every tool that inspects the execution document — sees a single merged tree.

## Why split a tree

- **Reuse.** The same retry-and-review subtree used by three different parents lives in one file, edited once.
- **Readability.** A 200-line `TREE.yaml` becomes a 20-line spine that names its phases and points at the work.
- **Safe refactors.** Pulling a section into a fragment is a syntactic move — if the [Testing trees](/guide/testing) suite stays green, the behaviour is identical.

Treat each fragment as a single responsibility — one thing the spine can name in a sentence without using "and". A fragment like `capture-review.yaml` that runs a review, writes the verdict to `$LOCAL`, then either comments on the MR or returns to screen is still one responsibility ("get the review feedback into the right place"); a `review-and-deploy.yaml` is two. When you find yourself reaching for "and", extract again.

## Layout

Keep fragments next to the tree that owns them:

```
.abtree/trees/big-workflow/
  TREE.yaml
  fragments/
    auth.yaml
    work.yaml
    cleanup.yaml
```

The spine file references each piece:

```yaml
# .abtree/trees/big-workflow/TREE.yaml
name: big-workflow
version: 1.0.0
description: Composed of separately-authored fragments.

state:
  local: {}

tree:
  type: sequence
  name: Big_Workflow
  children:
    - $ref: "./fragments/auth.yaml"
    - $ref: "./fragments/work.yaml"
    - $ref: "./fragments/cleanup.yaml"
```

A fragment file is just a node — one composite or one action. It does not carry the top-level `name`, `version`, `description`, or `state` keys; those live on the root only.

```yaml
# .abtree/trees/big-workflow/fragments/auth.yaml
type: sequence
name: Auth_Sequence
children:
  - { type: action, name: Login, steps: [...] }
  - { type: action, name: Verify, steps: [...] }
```

The fragment slots in wherever it's referenced, as if you'd pasted it inline.


## `$ref` accepts three forms

- **Relative paths** (`./fragments/auth.yaml`) — resolved against the file containing the `$ref`. The common case.
- **Absolute paths** (`/home/you/shared/retry.yaml`) — useful for machine-wide shared subtrees.
- **URLs** (`https://example.com/shared-trees/auth.yaml`) — fetched at execution-creation time. Use sparingly: the run depends on the URL being reachable when the execution is created.

## Resolution happens at execution-creation

When you call `abtree execution create <slug>`, abtree dereferences every `$ref` and writes the merged tree into the execution's `snapshot` field. The execution runs against that snapshot, not the live files. Two consequences:

- Editing a fragment after creation does **not** affect in-flight executions. New executions pick up the change.
- The snapshot is self-contained — you can share an execution JSON with a teammate and they don't need your fragment files.

## Cycles

Cyclic refs (A → B → A) are not expanded — the ref is left as a literal `{ $ref: "..." }` node in the snapshot, preventing stack overflow at load time. If the runtime ever ticks one of these literal nodes it fails cleanly with a "cyclic ref encountered" error, so cycles surface as a runtime failure on the specific node rather than as a crash.

In practice this means: a tree-under-test can include a `$ref` back to itself (e.g., a recursive subtree) and still load — but you'll need to gate the recursion in a sequence/selector so the cycle isn't entered.

## Refactoring into fragments

The motion: identify a coherent subtree, cut it into its own YAML file, replace it with a `$ref`. The whole point is that this should be a pure restructuring — no behaviour change.

The way to be sure is the [Testing trees](/guide/testing) suite. A tree with scenarios for its main paths means:

1. Run the tests green on the original tree.
2. Extract a fragment, replace with `$ref`.
3. Run the tests again. If green, the refactor is correct. If red, something moved that shouldn't have.

This is the largest concrete reason to write tests on a tree before it gets large — splitting later is mechanical and safe instead of error-prone.

## Next

- [Design a new tree](/guide/design-process) — the ten-step process for picking the right shape.
- [Idioms](/guide/idioms) — reusable shapes you reach for during design.
- [Testing trees](/guide/testing) — the regression net that makes fragment refactors safe.
