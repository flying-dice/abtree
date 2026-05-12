---
title: Test a tree
description: Testing in abtree is itself a tree — the agent walks the tree-under-test in pretend mode, using fixtures in place of real side effects, then asserts the final state and the path it walked.
---

# Test a tree

The test framework is itself a tree: [`@abtree/test-tree`](/registry) (find it in the registry). When you run a test, the agent executes `@abtree/test-tree`. That tree drives a fresh execution of the tree under test in **pretend mode**, so it never pushes a branch, opens a merge request, or hits an API. External side effects are replayed from fixtures in the spec. At the end, the runner compares the final `$LOCAL` and the path walked against the spec's expectations and writes a report.

A test is a contract:

- **Given** an initial state (`background.initial.local`).
- **When** the agent walks the tree (using `fixtures.side_effects` for any external action).
- **Then** the final `$LOCAL`, the terminal status, and the nodes touched match the spec.

## Why write tests

Tests earn their keep in four concrete ways:

- Tests pin down what the tree is supposed to do. A scenario reads like a story — given/when/then in plain English with the exact `$LOCAL` shape — and both humans and the agent can reason from it without re-reading the tree.
- Tests cache assumptions about the engine. "Selector exhausts both branches and the parent sequence aborts" is engine behaviour you would otherwise re-derive every time you debug. A scenario asserting it locks it in.
- Tests catch engine bugs. Specs that pass on one version of abtree and fail on the next surface real issues in the runtime, not just in trees.
- Tests make refactors safe. When a 30-node tree needs splitting into fragments, the scenarios are the regression suite — green before, green after, or the refactor is wrong.

## File layout

Specs and reports live next to the tree they cover:

```
.abtree/trees/hello-world/
  TREE.yaml
  TEST__morning.yaml                          ← spec
  REPORT__morning__20260510T224915Z.md        ← latest run
```

Filenames carry meaning. `@abtree/test-tree` parses them when it picks a scenario to run, and the matching `REPORT__<scenario>__<timestamp>.md` lands next to the spec — so the spec, the latest run, and the tree under test all live in one directory.

## The TEST spec

A test spec uses **BDD** (behaviour-driven development — `given`/`when`/`then`) phrased in YAML — one `feature`, one `scenario`. The runner ingests it whole.

```yaml
feature: Hello_World greets the current user based on time of day
tree: hello-world

background:
  initial:
    local: {}                # seeded into the target execution's $LOCAL
  global:
    user_name: John Doe

scenario:
  name: Morning — before noon picks Morning_Greeting
  given:
    - the system clock reads "08:30"
  when:
    - Determine_Time writes $LOCAL.time_of_day = "morning"
    - Choose_Greeting evaluates Morning_Greeting → true
    - Morning_Greeting writes a cheerful morning greeting to $LOCAL.greeting
  then:
    local:
      time_of_day: morning
      greeting: starts with "Good morning"
    status: done
```

### Predicate reference

`then.local.<key>` accepts:

| Predicate | Meaning |
|---|---|
| Literal scalar | Equality. `time_of_day: morning` asserts exact match. |
| `non-empty` | The value is set and not the empty string, array, or object. |
| `starts with "<prefix>"` | The value is a string with the given prefix. |
| `matches "<regex>"` | The value is a string matching the regular expression. |

`then.files.<path>` asserts on-disk artefacts (`exists`, frontmatter). Anything the runner cannot verify fails — it never invents an actual.

## Fixtures: replace side effects

The runner never performs real external actions. The spec records simulated outcomes:

```yaml
fixtures:
  side_effects:
    mr_open:
      url: https://example.com/group/repo/-/merge_requests/42
      branch: refine-plan/headless-2026-05-10
```

When the tree under test directs an external side effect (pretend mode — the runner never reaches a network, a git server, or a file outside the spec), the runner looks up the matching key, writes the fixture's fields into the target's `$LOCAL` exactly as the instruction directed, and submits success. If no fixture matches, the runner submits failure on that step — it never fabricates a stand-in. Local reads (`$LOCAL`, `$GLOBAL`, file frontmatter, deterministic shell) still come from the real source.

## Run a test

```sh
abtree execution create test-tree "test hello-world morning"
```

```sh
abtree local write <execution-id> test_path \
  '"/abs/path/.abtree/trees/hello-world/TEST__morning.yaml"'
```

```sh
claude "Using abtree CLI. Continue execution <execution-id>"
```

The agent does the rest: parses the spec, creates a fresh execution of the target tree, walks it under fixture rules, compares actuals to `then`, writes the report.

## The REPORT document

A report captures both halves of the contract: the final state and the path walked.

- **Header** — scenario name, tree, spec path, target execution id, and a headline `Overall: PASS | FAIL`.
- **Final `$LOCAL`** — every key/value the target held at termination.
- **Assertions** — Name / Expected / Actual / Pass, one row per predicate from `then`. The headline verdict is `AND` over the `Pass` column.
- **Trace** — a Mermaid diagram of the path walked. Green nodes ran and succeeded, red ran and failed, uncoloured never ticked. (Red nodes in a passing report are normal — a selector branch failing on purpose is part of the expected path.)

Real reports ship inside each tree's own repository — browse [Discover trees](/registry) to find a tree, follow the link to its source, and look in the `tests/` directory (or for `TEST__*.yaml` / `REPORT__*.md`) next to the `TREE.yaml`.

## Next

- [Discover trees](/registry) — browse the published trees, including `@abtree/test-tree` itself.
- [Inspecting executions](/guide/inspecting-executions) — what the green/red nodes mean in the trace.
