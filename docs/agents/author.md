# Tree Authoring Guide

Authoring an abtree tree means writing a YAML file that an agent can drive deterministically through `abtree next`, `eval`, and `submit`. Trees live in `.abtree/trees/<slug>.yaml` (project-local) or `~/.abtree/trees/<slug>.yaml` (user-global). Project-local shadows global on slug collision.

::: tip
Run `abtree docs schema` to print the JSON Schema, or reference the published copy via the YAML language-server comment:

```yaml
# yaml-language-server: $schema=https://abtree.dev/schemas/tree.schema.json
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

## Node primitives

There are four. Three composites and one leaf.

| Type       | Behaviour                                                    | Result                                |
|------------|--------------------------------------------------------------|---------------------------------------|
| `sequence` | Tick children left-to-right. Stops on first failure.         | success iff all children succeeded.   |
| `selector` | Tick children left-to-right. Stops on first success.         | success iff any child succeeded.      |
| `parallel` | Tick all children. No short-circuit.                         | success iff all children succeeded.   |
| `action`   | Leaf. Carries a list of `steps`, each `evaluate` or `instruct`. | success iff every step succeeded. |

Every node carries a `name` (used in `abtree next` output and the mermaid render). Composites carry `children: [...]`. Actions carry `steps: [...]`.

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

Any node can carry `retries: N` (positive integer). On failure, the runtime wipes the node's runtime subtree (its own `node_status`/`step_index` and all descendants') and re-attempts from a clean slate, up to N times. User-written `$LOCAL` data is preserved across retries — that is the whole point of the feedback loop.

## `$ref` fragments

Split a tree across multiple YAML files using JSON-Schema-style `$ref`. Relative paths, absolute paths, and URLs are dereferenced at load time:

```yaml
tree:
  type: sequence
  name: Top
  children:
    - $ref: "./fragments/auth.yaml"
    - $ref: "./fragments/work.yaml"
```

The dereferenced object must itself be a valid node (composite or action). Cyclic refs are not expanded — they are preserved literally as `$ref` nodes that surface a clean failure if the runtime ever ticks them.

## Worked example

```yaml
# yaml-language-server: $schema=https://abtree.dev/schemas/tree.schema.json
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

| Mechanism      | What it covers                                                                                |
|----------------|-----------------------------------------------------------------------------------------------|
| Schema check   | `tests/trees-schema.test.ts` parses every tree in `.abtree/trees/` through `TreeFileSchema`.   |
| CLI errors     | Malformed trees fail `abtree execution create` with a path-prefixed message: `tree.steps: Too small: expected array to have >=1 items`. |
| Editor LSP     | The `# yaml-language-server: $schema=...` comment enables completions, tooltips, and inline error highlights in any YAML LSP client. |

## Reporting (per tree authored)

```text
[tree-slug] ✓ valid → run `abtree tree list` to confirm it loads
```
