---
description: Ready-to-use abtree behaviour trees, installable in one command.
---

# Examples registry

Ready-to-use behaviour trees. Each entry includes the YAML source, a one-liner to copy it into your local `.abtree/trees/<slug>/`, and a Claude handover command that briefs Claude to drive the execution.

Trees live in `.abtree/trees/<slug>/TREE.yaml`. Every install command is idempotent — safe to re-run. Existing files are overwritten with the latest version from `main`.

| Tree | Description |
|------|-------------|
| [Hello World](/examples/hello-world) | Greet a user based on time of day. Demonstrates sequence, selector, and action primitives. |
| [Implement](/examples/implement) | Implement an approved plan with complexity-gated architectural review, following the clean-code rules in clean-code.md. |
| [Improve Codebase](/examples/improve-codebase) | Continuous code-improvement cycle. Confirms intent + green baseline, scores quality metrics in parallel, snapshots the baseline, hardens findings via a Senior-Principal critique, looks up best practices, triages with a human gate, then iterates through each refactor with per-item bounded retries until the queue is drained. A final reassessment compares against baseline thresholds and emits a pass/partial verdict.  Two retry mechanisms compose:   - retries: 2 on Refactor_Item     — 3 attempts per refactor item.   - retries: 50 on Iterative_Refactor — drives the per-item outer loop     by failing Continue_Or_Done while the queue still has work;     bounds total items at 50.  Threshold contract: $GLOBAL.metric_thresholds defines the minimum acceptable score per metric. Compile_Report attaches the right threshold to each item. Reassess_Metric checks against $LOCAL.current_item.threshold.  Halt: set $LOCAL.stage_halt = true to break out of the outer loop cleanly. Halt_Check fails its evaluate while halted, so the outer retries exhaust and the stage ends in failure with done_log and failed_log preserved.  |
| [Refine Plan](/examples/refine-plan) | Refine a one-line change request into a hardened, codeowner-reviewable plan: analyse intent, draft a structured plan, critique as a Staff Engineer, save to plans/. |
| [Technical Writer](/examples/technical-writer) | Take a documentation goal, ground it in the repo's styleguide, find or build a home in the docs tree, write to it, and gate-check structure / flow / atomicity. Up to three write/review passes (one initial + two retries) before surfacing failure to the human. |

---

## [Hello World](/examples/hello-world)

Greet a user based on time of day. Demonstrates sequence, selector, and action primitives.

**Install**

```sh
mkdir -p .abtree/trees/hello-world \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/hello-world/TREE.yaml \
         -o .abtree/trees/hello-world/TREE.yaml
```

**Run with Claude**

```sh
claude "Run the abtree hello-world tree. Use 'abtree --help' to learn the execution protocol, then create an execution with 'abtree execution create hello-world \"<summary>\"' and drive it to completion."
```

---

## [Implement](/examples/implement)

Implement an approved plan with complexity-gated architectural review, following the clean-code rules in clean-code.md.

**Install**

```sh
mkdir -p .abtree/trees/implement \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/implement/TREE.yaml \
         -o .abtree/trees/implement/TREE.yaml
```

**Run with Claude**

```sh
claude "Run the abtree implement tree. Use 'abtree --help' to learn the execution protocol, then create an execution with 'abtree execution create implement \"<summary>\"' and drive it to completion."
```

---

## [Improve Codebase](/examples/improve-codebase)

Continuous code-improvement cycle. Confirms intent + green baseline,
scores quality metrics in parallel, snapshots the baseline, hardens
findings via a Senior-Principal critique, looks up best practices,
triages with a human gate, then iterates through each refactor with
per-item bounded retries until the queue is drained. A final
reassessment compares against baseline thresholds and emits a
pass/partial verdict.

Two retry mechanisms compose:
  - retries: 2 on Refactor_Item     — 3 attempts per refactor item.
  - retries: 50 on Iterative_Refactor — drives the per-item outer loop
    by failing Continue_Or_Done while the queue still has work;
    bounds total items at 50.

Threshold contract: $GLOBAL.metric_thresholds defines the minimum
acceptable score per metric. Compile_Report attaches the right
threshold to each item. Reassess_Metric checks against
$LOCAL.current_item.threshold.

Halt: set $LOCAL.stage_halt = true to break out of the outer loop
cleanly. Halt_Check fails its evaluate while halted, so the outer
retries exhaust and the stage ends in failure with done_log and
failed_log preserved.


**Install**

```sh
mkdir -p .abtree/trees/improve-codebase \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/improve-codebase/TREE.yaml \
         -o .abtree/trees/improve-codebase/TREE.yaml
```

**Run with Claude**

```sh
claude "Run the abtree improve-codebase tree. Use 'abtree --help' to learn the execution protocol, then create an execution with 'abtree execution create improve-codebase \"<summary>\"' and drive it to completion."
```

---

## [Refine Plan](/examples/refine-plan)

Refine a one-line change request into a hardened, codeowner-reviewable plan: analyse intent, draft a structured plan, critique as a Staff Engineer, save to plans/.

**Install**

```sh
mkdir -p .abtree/trees/refine-plan \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/refine-plan/TREE.yaml \
         -o .abtree/trees/refine-plan/TREE.yaml
```

**Run with Claude**

```sh
claude "Run the abtree refine-plan tree. Use 'abtree --help' to learn the execution protocol, then create an execution with 'abtree execution create refine-plan \"<summary>\"' and drive it to completion."
```

---

## [Technical Writer](/examples/technical-writer)

Take a documentation goal, ground it in the repo's styleguide, find or build a home in the docs tree, write to it, and gate-check structure / flow / atomicity. Up to three write/review passes (one initial + two retries) before surfacing failure to the human.

**Install**

```sh
mkdir -p .abtree/trees/technical-writer \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/technical-writer/TREE.yaml \
         -o .abtree/trees/technical-writer/TREE.yaml
```

**Run with Claude**

```sh
claude "Run the abtree technical-writer tree. Use 'abtree --help' to learn the execution protocol, then create an execution with 'abtree execution create technical-writer \"<summary>\"' and drive it to completion."
```

---

## Submitting your own

Trees are just YAML — see [Writing trees](/guide/writing-trees) for the format. Open a PR against [`flying-dice/abtree`](https://github.com/flying-dice/abtree) adding your tree to `.abtree/trees/<slug>/TREE.yaml` and an entry on this page, and it'll ship in the next release.
