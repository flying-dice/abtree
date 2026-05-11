# @abtree/test-tree

An [abtree](https://github.com/flying-dice/abtree) fragment package that runs a BDD test spec against a target tree, captures its mermaid trace, compares the run's final state against the spec's `then` assertions, and writes a markdown test report embedding the diagram.

## Install

Pick whichever node package manager your project uses — they all install fragments into `node_modules/` the same way:

```bash
npm  install github:flying-dice/abtree_test-tree
pnpm add     github:flying-dice/abtree_test-tree
bun  add     github:flying-dice/abtree_test-tree
```

Pin a tag for reproducibility (`#v1.2.0`) or a commit (`#commit:<sha>`) — see [abtree's fragments guide](https://abtree.sh/guide/fragments) for the full syntax.

## Use

Reference the tree from any of your own `main.yml` files:

```yaml
tree:
  $ref: "node-modules:abtree_test-tree#/tree"
```

Then seed `$LOCAL.test_path` with the path to a `<scenario>.yaml` spec under `tests/` and run the consuming tree:

```bash
abtree execution create ./main.yml "run the smoke scenario"
abtree local write <execution-id> test_path ./tests/<scenario>.yaml
abtree next <execution-id>
```

The runner reads the spec, drives a fresh execution of the target tree through every `when` step, compares the terminal `$LOCAL` against the `then` block, and writes `<scenario>__<timestamp>.md` next to the spec.

### Layout convention

Test specs live in a `tests/` directory next to the target tree. The directory itself signals these are tests — no `TEST__` prefix needed. The runner writes each report next to its spec, so reports also land in `tests/`; the `.yaml` vs `.md` extension distinguishes them:

```
<target-tree>/
├── main.yml
└── tests/
    ├── short-topic.yaml
    ├── long-topic.yaml
    └── short-topic__20260511T134200Z.md
```

For trees that live under `.abtree/trees/<slug>/`, the same convention applies — `.abtree/trees/<slug>/tests/<scenario>.yaml`.

## What the spec looks like

A minimal `TEST__<scenario>.yaml`:

```yaml
feature: "What the tree does"
tree: <target-tree-slug>
scenario:
  name: <human-readable scenario name>
  given: <one-line context>
  when:
    - { evaluate: "<expression>", result: true }
    - { instruct: "<name>", write: { <key>: <value> }, submit: success }
    - ...
  then:
    status: done
    local:
      <key>: <expected value or predicate>
    files:
      <key>: <expected on-disk shape>
```

### Fixtures (VCR semantics)

External side effects (git push, MR open, network calls) are served from `fixtures.side_effects` in the spec rather than performed for real, unless the operator has explicitly authorised live execution:

```yaml
fixtures:
  side_effects:
    mr_open:
      url: https://example.test/mr/42
      branch: feature/scenario-x
```

If an instruction would normally require external authorisation and there's no fixture for it, the runner submits failure rather than inventing a value.

## State surface

| Key | Set by | Purpose |
|---|---|---|
| `test_path` | caller | path to the `TEST__<scenario>.yaml` spec |
| `test_spec` | runner | parsed spec object |
| `target_execution_id` | runner | id of the run-under-test |
| `final_local` | runner | full `$LOCAL` of the target execution at termination |
| `final_status` | runner | `"done"` or `"failure"` |
| `mermaid_diagram` | runner | verbatim contents of `.abtree/executions/<id>.mermaid` |
| `assertions` | runner | `[{ name, expected, actual, pass }, …]` |
| `overall_result` | runner | `"pass"` or `"fail"` |
| `report_path` | runner | path to the rendered markdown report |

## Report format

The generated `<scenario>__<timestamp>.md` contains:

- Title, target tree slug, spec path, target execution id, overall PASS/FAIL.
- A table of the final `$LOCAL`.
- A table of each assertion (Name | Expected | Actual | Pass).
- The full mermaid trace inline.

## Versioning

Pin a git tag for byte-stable resolution across machines:

```bash
bun add github:flying-dice/abtree_test-tree#v1.2.0
```

Or a commit SHA for total reproducibility:

```bash
bun add github:flying-dice/abtree_test-tree#commit:<40-hex-sha>
```
