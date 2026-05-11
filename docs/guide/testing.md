---
description: Testing in abtree is itself a tree — the agent walks the tree-under-test in "pretend" mode, using fixtures in place of real side effects, then asserts the final state and the path it trod.
---

# Testing trees

The test framework is just another tree: [`test-tree`](/examples/test-tree/). When you "run a test," the agent executes `test-tree`, which drives a fresh execution of the tree-under-test in **pretend mode** — it never actually pushes a branch, opens an MR, or hits an API. External side effects are replayed from fixtures in the spec. At the end, it compares the final `$LOCAL` and the path trodden through the tree against the spec's expectations and writes a report.

So a test is a contract:

- **Given** an initial state (`background.initial.local`)
- **When** the agent walks the tree (using `fixtures.side_effects` for any external action)
- **Then** the final `$LOCAL`, the terminal status, and the nodes touched must match the spec.

## Why bother

Tests aren't ceremony. They earn their keep in four concrete ways:

- **They pin down what the tree is supposed to do.** A scenario reads like a story — given/when/then in plain English with the exact `$LOCAL` shape — and both humans and the agent can reason from it without re-reading the YAML.
- **They cache assumptions about the engine.** "Selector exhausts both branches and the parent sequence aborts" is engine behaviour you'd otherwise re-derive every time you debug. A scenario asserting it locks it in.
- **They catch engine bugs.** Specs that pass on one version of abtree and fail on the next have surfaced real issues in the runtime, not just in trees.
- **They make refactors safe.** When a 30-node tree needs splitting into fragments, the scenarios are the regression suite — green before, green after, or the refactor is wrong.

## File layout

Specs and reports live next to the tree they cover:

```
.abtree/trees/hello-world/
  TREE.yaml
  TEST__morning.yaml                          ← spec
  REPORT__morning__20260510T224915Z.md        ← latest run
```

Filenames are load-bearing. The docs generator parses them to publish each scenario as a sub-page under `/examples/<slug>/<scenario>`.

## The TEST spec

BDD in YAML — one `feature`, one `scenario`, given/when/then. The runner ingests it whole.

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

Predicates in `then.local.<key>`: literal scalars (equality), `non-empty`, `starts with "<prefix>"`, `matches "<regex>"`. `then.files.<path>` asserts on disk artefacts (`exists`, frontmatter). Anything the runner can't verify fails — it never invents an "actual."

## Fixtures: pretending in place of side effects

The runner never performs real external actions. The spec cements simulated outcomes:

```yaml
fixtures:
  side_effects:
    mr_open:
      url: https://example.com/group/repo/-/merge_requests/42
      branch: refine-plan/headless-2026-05-10
```

When the tree-under-test directs an external side effect, the runner looks up the matching key, writes the fixture's fields into the target's `$LOCAL` exactly as the instruction directed, and submits success. If no fixture matches, the runner submits failure on that step — it never fabricates a stand-in. Local reads ($LOCAL/$GLOBAL, file frontmatter, deterministic shell) still come from the real source.

## Running a test

```sh
abtree execution create test-tree "test hello-world morning"
abtree local write <execution-id> test_path \
  '"/abs/path/.abtree/trees/hello-world/TEST__morning.yaml"'
claude "Using abtree CLI. Continue execution <execution-id>"
```

The agent does the rest: parses the spec, creates a fresh execution of the target tree, walks it under fixture rules, compares actuals to `then`, writes the report.

## The REPORT document

A report captures both halves of the contract: the final state and the path trodden.

- **Header** — scenario name, tree, spec path, target execution id, and a headline `**Overall:** PASS | FAIL`.
- **Final `$LOCAL`** — every key/value the target held at termination.
- **Assertions** — Name / Expected / Actual / Pass, one row per predicate from `then`. The headline verdict is just `AND` over the Pass column.
- **Trace** — a Mermaid diagram of the path trodden. Green nodes ran and succeeded, red ran and failed, uncoloured never ticked. (Red nodes in a PASSing report are normal — a selector branch failing on purpose is part of the expected path.)

Real reports in the [Examples](/examples) collection:

- [`hello-world / morning`](/examples/hello-world/morning) — clean PASS, every node green.
- [`hello-world / localisation`](/examples/hello-world/localisation) — FAIL, with the assertions table pinpointing what didn't hold.
- [`refine-plan / happy-path-in-session`](/examples/refine-plan/happy-path-in-session) — longer sequence with selector branches.
- [`technical-writer / bootstrap-styleguide`](/examples/technical-writer/bootstrap-styleguide) — fixture-driven run exercising the side-effect path.

## Next

- [Test Tree](/examples/test-tree/) — the runner itself, as a tree.
- [Inspecting executions](/guide/inspecting-executions) — what the green/red nodes mean in the trace.
