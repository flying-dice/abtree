---
description: Ready-to-use abtree behaviour trees, installable in one command — hello-world, refine-plan, implement, technical-writer, improve-codebase.
---

# Examples registry

Ready-to-use behaviour trees. Each entry includes the YAML files, a one-liner to copy them into your local `.abtree/trees/<slug>/`, and a Claude handover command that briefs Claude to drive the execution with abtree.

Trees live in `.abtree/trees/<slug>/TREE.yaml`. The folder gives the tree somewhere to keep its own fragments and playbooks alongside the definition. Every install command is idempotent — safe to re-run. Existing files are overwritten with the latest version from `main`.

---

## Hello World

A small workflow that greets a user based on time of day. The selector picks one of four greetings (morning / afternoon / evening / default) using time-of-day evaluates as preconditions. Demonstrates `sequence`, `selector`, and `action` — the three primitives most workflows lean on. Use this first if you're learning abtree.

**Files**

- `hello-world/TREE.yaml` — main

**Install**

```sh
mkdir -p .abtree/trees/hello-world \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/hello-world/TREE.yaml \
       -o .abtree/trees/hello-world/TREE.yaml
```

**Run with Claude**

```sh
claude "Run the abtree hello-world tree end-to-end. Start by running 'abtree --help' to learn the execution protocol, then create an execution with 'abtree execution create hello-world \"smoke test\"' and drive it through every step until you see status: done."
```

---

## Refine a plan

Turn a one-line change request into a hardened, codeowner-reviewable plan. The execution analyses intent, drafts a structured plan (frontmatter + summary + requirements + technical approach + acceptance criteria + risks), critiques it as a Staff Engineer, and saves the result to `plans/<kebab-title>.md`. The `reviewed_by` field stays empty until a codeowner approves it.

**Files**

- `refine-plan/TREE.yaml` — main

**Install**

```sh
mkdir -p .abtree/trees/refine-plan \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/refine-plan/TREE.yaml \
       -o .abtree/trees/refine-plan/TREE.yaml
```

**Run with Claude**

```sh
claude "Use the abtree refine-plan tree to turn this change request into a plan: <one-line description>. Run 'abtree --help' first to learn the protocol, then create the execution, write the change_request to LOCAL, and drive it to completion. Show me the final plan path."
```

---

## Implementation workflow

A two-stage pipeline for shipping changes. **refine-plan** produces an approved plan under `plans/`. **implement** reads it back, scores complexity, optionally escalates to an architect on high-complexity work, and writes the code. implement refuses to start on an un-reviewed plan — `reviewed_by` must be set.

**Files**

- `implement/TREE.yaml` — main
- `refine-plan/TREE.yaml` — sub-workflow (run first to produce the plan)

**Install**

```sh
for t in implement refine-plan; do
  mkdir -p ".abtree/trees/${t}" \
    && curl -fsSL "https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/${t}/TREE.yaml" \
         -o ".abtree/trees/${t}/TREE.yaml"
done
```

**Run with Claude**

```sh
claude "I want to <feature description>. First run the abtree refine-plan tree to produce a plan at plans/<slug>.md, then pause for me to add my name to reviewed_by. Once I confirm approval, run the abtree implement tree against the plan and write the code. Use 'abtree --help' to learn the protocol."
```

---

## Technical writer

Take a documentation goal, ground it in the repo's `STYLEGUIDE.md` (or draft one and gate on human approval if none exists), find or build a home in the docs tree, write to it, and gate-check the result against three rules — does it fit the structure, does the narrative flow, is it one concept? Up to three write/review passes before the workflow surfaces persistent failures to the human. Standalone workflow; no upstream spec required.

**Files**

- `technical-writer/TREE.yaml` — main

**Install**

```sh
mkdir -p .abtree/trees/technical-writer \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/technical-writer/TREE.yaml \
       -o .abtree/trees/technical-writer/TREE.yaml
```

**Run with Claude**

```sh
claude "Use the abtree technical-writer tree to document <topic>. Run 'abtree --help' first to learn the protocol, then create the execution, write the goal to LOCAL, and drive it to completion. If a styleguide doesn't exist yet, draft one and pause for me to approve before continuing."
```

---

## Improve codebase

A continuous code-quality improvement cycle. The agent confirms intent and a green test baseline, then runs a parallel scoring pass on four metrics (DRY, SRP, coupling, cohesion) — each scorer records observations, severity, risk, and a cost/benefit estimate. A Senior-Principal critique hardens the findings, an online lookup gathers best-practice patterns, and the human approves the triaged queue. The refactor stage then iterates through each item: high-risk items get a blast-radius critique first; every item gets up to **three attempts** to (implement → full regression test → focused re-score) before halting. After the queue drains, a final parallel reassessment compares against the snapshotted baseline and emits a pass / partial verdict.

**Files**

- `improve-codebase/TREE.yaml` — main

**Install**

```sh
mkdir -p .abtree/trees/improve-codebase \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/improve-codebase/TREE.yaml \
       -o .abtree/trees/improve-codebase/TREE.yaml
```

**Run with Claude**

```sh
claude "Run the abtree improve-codebase tree on this repo. Use 'abtree --help' to learn the protocol. Set $LOCAL.change_request to a one-line scope ('full repo' / 'just the auth module' / 'DRY only'); $GLOBAL.test_command to the project's regression test command. Drive Check_Intent through to Cycle_Verdict, pausing for my approval at the triage gate. Surface the baseline-vs-final delta and any items that hit the per-item attempt cap."
```

---

## Submitting your own

Trees are just YAML — see [Writing trees](/guide/writing-trees) for the format. Open a PR against [`flying-dice/abtree`](https://github.com/flying-dice/abtree) adding your tree to `.abtree/trees/<slug>/TREE.yaml` and an entry on this page, and it'll ship in the next release.
