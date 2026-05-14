---
title: Authoring trees
description: Reference for an agent (or human) authoring an abtree tree. Covers the full field reference — file shape, step kinds, retries, $ref fragments — plus a worked example and validation tooling.
---

# Authoring trees

Authoring an abtree tree means writing a tree file that an agent can drive deterministically through `abtree next`, `abtree eval`, and `abtree submit`. A tree is a single `.json`/`.yaml`/`.yml` file. Put it anywhere in your working tree and run it by path; the tree file's own `name` field is the slug abtree uses inside execution IDs.

::: tip
Run `abtree docs schema` to print the JSON Schema, or reference the published copy via the YAML language-server comment:

```yaml
# yaml-language-server: $schema=https://abtree.sh/schemas/tree.schema.json
```
:::

## File shape

```yaml
name: my-tree            # slug, lowercase, hyphenated. Required.
version: 1.0.0           # semver string. Pure label; not parsed. Required.
description: short text  # optional.
state:                   # optional.
  local: {...}           # initial $LOCAL keys for every execution.
  global: {...}          # initial $GLOBAL keys; read-only at runtime.
tree:                    # the root node. Required.
  ...
```

| Field | Required | Purpose |
|---|---|---|
| `name` | yes | Slug. Must match the folder name. |
| `version` | yes | Semver label. Pure label; not parsed. |
| `description` | no | One-line summary surfaced by tooling and the registry. |
| `state.local` | no | Initial `$LOCAL` keys. `null` values are filled in by actions during the run. |
| `state.global` | no | Initial `$GLOBAL` values. Strings that look like sentences are interpreted by the agent as retrieval directives. |
| `tree` | yes | The root node. Always a single node — usually a `sequence`. |

## Node primitives

There are four — three composites and one leaf. For the conceptual semantics see [Branches and actions](/concepts/branches-and-actions); the abridged contract is:

| Type | Behaviour | Result |
|---|---|---|
| `sequence` | Tick children left-to-right. Stop on the first failure. | success iff all children succeeded. |
| `selector` | Tick children left-to-right. Stop on the first success. | success iff any child succeeded. |
| `parallel` | Tick all children. No short-circuit. | success iff all children succeeded. |
| `action` | Leaf. Carries a list of `steps`, each `evaluate` or `instruct`. | success iff every step succeeded. |

Every node carries a `name` (used in `abtree next` output and the SVG trace). Composites carry `children: [...]`. Actions carry `steps: [...]`.

## Naming conventions

| Element | Convention | Example |
|---|---|---|
| Tree slug (`name` and folder) | kebab-case | `hello-world`, `improve-codebase` |
| Node name | PascalCase with underscores; the SVG trace renders `_` as a space | `Choose_Greeting`, `Check_Weather` |
| Composite name | describes the decision | `Choose_Greeting`, `Gather_Context`, `Write_With_Retries` |
| Action name | describes the work | `Determine_Time`, `Compose_Response` |
| Root sequence name | usually `<Tree>_Workflow` | `Hello_World_Workflow` |
| `$LOCAL` key | a variable the tree creates | `$LOCAL.draft`, `$LOCAL.review_notes` |
| `$GLOBAL` key | a value the tree reads from the world | `$GLOBAL.user_name`, `$GLOBAL.review_playbook` |

Do not mix `$LOCAL` and `$GLOBAL`: `$LOCAL` is something the tree creates; `$GLOBAL` is something the world tells the tree.

## Step kinds (action only)

### `evaluate`

```yaml
- evaluate: "$LOCAL.foo == 'bar'"
```

The agent reads `$LOCAL.foo`, applies the expression, and calls `abtree eval <execution> true|false`. Expressions are opaque strings — abtree does not parse them. Phrasing is the contract between the tree author and the agent.

### `instruct`

```yaml
- instruct: "do the thing, write the result to $LOCAL.bar"
```

The agent performs the work, writes any produced values via `abtree local write`, and calls `abtree submit <execution> success|failure|running`.

## Retries

Any node can carry `retries: N` (a positive integer). On failure the runtime wipes the node's runtime subtree (its own `node_status`, `step_index`, and all descendants') and re-attempts from a clean slate, up to `N` times. User-written `$LOCAL` data is preserved across retries — that is the feedback channel between attempts.

## `$ref` fragments

Split a tree across multiple files using JSON-Schema-style `$ref`. Relative paths, absolute paths, and URLs are dereferenced at load time:

```yaml
tree:
  type: sequence
  name: Top
  children:
    - $ref: "./fragments/auth.yaml"
    - $ref: "./fragments/work.yaml"
```

The dereferenced object must itself be a valid node (composite or action). Cyclic refs are not expanded — they are preserved literally as `$ref` nodes that surface a clean failure if the runtime ever ticks them. See [Fragments](/guide/fragments) for the full reference.

## Worked example

```yaml
# yaml-language-server: $schema=https://abtree.sh/schemas/tree.schema.json
name: my-tree
version: 1.0.0
description: short summary

state:
  local:
    target: null
    result: null

tree:
  type: sequence
  name: Top
  children:
    - type: action
      name: Set_Target
      steps:
        - instruct: "decide a target. write to $LOCAL.target"

    - type: selector
      name: Try_Strategies
      retries: 2
      children:
        - type: action
          name: Fast_Path
          steps:
            - evaluate: "$LOCAL.target is small"
            - instruct: "do the fast thing. write to $LOCAL.result"
        - type: action
          name: Slow_Path
          steps:
            - instruct: "do the slow thing. write to $LOCAL.result"
```

## Validation

| Mechanism | What it covers |
|---|---|
| Schema check | The repository test suite parses every bundled tree under `trees/` through `TreeFileSchema`. |
| CLI errors | Malformed trees fail `abtree execution create` with a path-prefixed message: `tree.steps: Too small: expected array to have >=1 items`. |
| Editor LSP | The `# yaml-language-server: $schema=...` comment enables completions, tooltips, and inline error highlights in any YAML LSP client. |

## Reporting (per tree authored)

```text
[tree-path] ✓ valid → run `abtree execution create <path> "smoke test"` to confirm it loads
```

## Next

- [JSON Schema](/agents/schema) — where the canonical schema lives, editor integration, and CI validation.
- [Writing trees](/guide/writing-trees) — tutorial walkthrough that builds the bundled `hello-world` tree from scratch.
