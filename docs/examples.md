# Examples registry

Ready-to-use behaviour trees. Each entry includes the YAML files, a one-liner to copy them into your local `.abtree/trees/`, and a Claude handover command that briefs Claude to drive the execution with abtree.

Every install command is idempotent — safe to re-run. Existing files in `.abtree/trees/` are overwritten with the latest version from `main`.

---

## Hello World

A small workflow that greets a user based on time of day, then enriches the greeting with current weather and one news headline. Demonstrates all four BT primitives — `sequence`, `selector`, `parallel`, `action` — in roughly fifteen lines of structure. Use this first if you're learning abtree.

**Files**

- `hello-world.yaml` — main

**Install**

```sh
mkdir -p .abtree/trees \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/hello-world.yaml \
       -o .abtree/trees/hello-world.yaml
```

**Run with Claude**

```sh
claude "Run the abtree hello-world tree end-to-end. Start by running 'abtree --help' to learn the execution protocol, then create an execution with 'abtree execution create hello-world \"smoke test\"' and drive it through every step until you see status: done."
```

---

## Counter demo (multi-file `$ref` + bounded code/test loop)

Demonstrates two things together: splitting a workflow across files via JSON-Schema-style `$ref`, and the BT-native code-then-test pattern with bounded retries. State starts at `counter: 0` and `threshold: 3`. The root `Reach_Threshold` selector tries up to four passes; each pass is a `Pass` sequence (`Increment` action then `Test` evaluate) loaded from a single shared fragment file. Pass 4 wins because `counter` reaches 4 (`> 3`).

**Files**

- `counter-demo.yaml` — main (root selector with four `$ref`s to the same pass)
- `fragments/pass.yaml` — sub-workflow (one Increment + Test sequence)

**Install**

```sh
mkdir -p .abtree/trees/fragments \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/counter-demo.yaml \
       -o .abtree/trees/counter-demo.yaml \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/fragments/pass.yaml \
       -o .abtree/trees/fragments/pass.yaml
```

**Run with Claude**

```sh
claude "Run the abtree counter-demo tree end-to-end. Use 'abtree --help' to learn the protocol, then drive it through every step. Each Pass is an Increment instruct followed by a Test evaluate that checks counter > threshold. The first three passes will fail the test; the fourth will succeed. Final counter is 4."
```

---

## Spec refinement

Refine a one-line change request into a hardened, codeowner-reviewable spec. The execution analyses intent, drafts a structured spec (frontmatter + summary + requirements + technical approach + acceptance criteria + risks), critiques it as a Staff Engineer, and saves the result to `specs/<kebab-title>.md`. The `reviewed_by` field stays empty until a codeowner approves it.

**Files**

- `refine.yaml` — main

**Install**

```sh
mkdir -p .abtree/trees \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/refine.yaml \
       -o .abtree/trees/refine.yaml
```

**Run with Claude**

```sh
claude "Use the abtree refine tree to turn this change request into a spec: <one-line description>. Run 'abtree --help' first to learn the protocol, then create the execution, write the change_request to LOCAL, and drive it to completion. Show me the final spec path."
```

---

## Implementation workflow

A two-stage pipeline for shipping changes. **Refine** produces an approved spec under `specs/`. **Implement** reads it back, scores complexity, drafts a plan, critiques the plan, looks up best practices online, optionally escalates to an architect on high-complexity work, and writes the code. Implement refuses to start on an un-reviewed spec — `reviewed_by` must be set.

**Files**

- `implement.yaml` — main
- `refine.yaml` — sub-workflow (run first to produce the spec)

**Install**

```sh
mkdir -p .abtree/trees \
  && for t in implement refine; do
       curl -fsSL "https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/${t}.yaml" \
            -o ".abtree/trees/${t}.yaml"
     done
```

**Run with Claude**

```sh
claude "I want to <feature description>. First run the abtree refine tree to produce a spec at specs/<slug>.md, then pause for me to add my name to reviewed_by. Once I confirm approval, run the abtree implement tree against the spec and write the code. Use 'abtree --help' to learn the protocol."
```

---

## Backend design

Design and implement a backend service from an approved spec. Architectural critique gates the build: the execution plans the data model, API surface, and service layer; runs the plan past a Senior Principal critique pass; and only then writes code. Like `implement`, it consumes a reviewed spec from `specs/`.

**Files**

- `backend-design.yaml` — main
- `refine.yaml` — sub-workflow (run first to produce the spec)

**Install**

```sh
mkdir -p .abtree/trees \
  && for t in backend-design refine; do
       curl -fsSL "https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/${t}.yaml" \
            -o ".abtree/trees/${t}.yaml"
     done
```

**Run with Claude**

```sh
claude "I need a backend service for <description>. First run the abtree refine tree to spec it. After I review, run the abtree backend-design tree against the spec to plan the architecture and write the service. Use 'abtree --help' to learn the protocol."
```

---

## Frontend design

Design and implement a frontend component or page from an approved spec by **deferring the aesthetic-direction work to a curated local playbook**. The playbook ships at `.abtree/playbooks/frontend-design.md` and is exposed as a parameterless directive at `$GLOBAL.frontend_design` ("read this file, return text"); actions invoke it by name (`Use $GLOBAL.frontend_design to design and implement …`, `Use $GLOBAL.frontend_design to assess …`) to handle tone selection, typography, palette, motion, spatial composition, and atmospheric backgrounds. The workflow shell is abtree's: spec-approval gate, eight-item post-implementation quality check, fix-or-pass selector.

**Files**

- `frontend-design.yaml` — main
- `refine.yaml` — sub-workflow (run first to produce the spec)
- `playbooks/frontend-design.md` — the design playbook the global directive points at

**Install**

```sh
mkdir -p .abtree/trees .abtree/playbooks \
  && for t in frontend-design refine; do
       curl -fsSL "https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/${t}.yaml" \
            -o ".abtree/trees/${t}.yaml"
     done \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/playbooks/frontend-design.md \
       -o .abtree/playbooks/frontend-design.md
```

**Run with Claude**

```sh
claude "I need a frontend component for <description>. First run the abtree refine tree to spec it. After I review, run the abtree frontend-design tree against the spec to set aesthetic direction and build the component. Use 'abtree --help' to learn the protocol."
```

---

## Technical writer

Take a documentation goal, ground it in the repo's `STYLEGUIDE.md` (or draft one and gate on human approval if none exists), find or build a home in the docs tree, write to it, and gate-check the result against three rules — does it fit the structure, does the narrative flow, is it one concept? Up to three write/review passes before the workflow surfaces persistent failures to the human. Standalone workflow; no upstream spec required.

**Files**

- `technical-writer.yaml` — main

**Install**

```sh
mkdir -p .abtree/trees \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/technical-writer.yaml \
       -o .abtree/trees/technical-writer.yaml
```

**Run with Claude**

```sh
claude "Use the abtree technical-writer tree to document <topic>. Run 'abtree --help' first to learn the protocol, then create the execution, write the goal to LOCAL, and drive it to completion. If a styleguide doesn't exist yet, draft one and pause for me to approve before continuing."
```

---

## Improve codebase

A continuous code-quality improvement cycle. The agent confirms intent and a green test baseline, then runs a parallel scoring pass on four metrics (DRY, SRP, coupling, cohesion) — each scorer records observations, severity, risk, and a cost/benefit estimate. A Senior-Principal critique hardens the findings, an online lookup gathers best-practice patterns, and the human approves the triaged queue. The refactor stage then iterates through each item: high-risk items get a blast-radius critique first; every item gets up to **three attempts** to (implement → full regression test → focused re-score) before halting. After the queue drains, a final parallel reassessment compares against the snapshotted baseline and emits a pass / partial verdict.

**Files**

- `improve-codebase.yaml` — main

**Install**

```sh
mkdir -p .abtree/trees \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/improve-codebase.yaml \
       -o .abtree/trees/improve-codebase.yaml
```

**Run with Claude**

```sh
claude "Run the abtree improve-codebase tree on this repo. Use 'abtree --help' to learn the protocol. Set $LOCAL.change_request to a one-line scope ('full repo' / 'just the auth module' / 'DRY only'); $GLOBAL.test_command to the project's regression test command. Drive Check_Intent through to Cycle_Verdict, pausing for my approval at the triage gate. Surface the baseline-vs-final delta and any items that hit the per-item attempt cap."
```

---

## Code review

Reviews a merge request / pull request by **deferring the heavy lifting to a curated local playbook**. The playbook ships at `.abtree/playbooks/code-review.md` and is exposed as a parameterless directive at `$GLOBAL.code_review` ("read this file, return text"); actions invoke it by name to apply the pre-flight check, the main review pipeline (project-conventions loading, parallel review passes, validation, false-positive filtering — all owned by the playbook), and the posting / formatting rules. The workflow shell is abtree's: skip-or-run gate, human-approved publish gate, formal approve / request-changes verdict.

**Files**

- `code-review.yaml` — main
- `playbooks/code-review.md` — the review playbook the global directive points at

**Install**

```sh
mkdir -p .abtree/trees .abtree/playbooks \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/trees/code-review.yaml \
       -o .abtree/trees/code-review.yaml \
  && curl -fsSL https://raw.githubusercontent.com/flying-dice/abtree/main/.abtree/playbooks/code-review.md \
       -o .abtree/playbooks/code-review.md
```

**Run with Claude**

```sh
claude "Review MR <ref or commit SHA> using the abtree code-review tree. Use 'abtree --help' to learn the protocol, fetch the diff, run all three review passes, and report the verdict with line-cited findings."
```

---

## Submitting your own

Trees are just YAML — see [Writing trees](/guide/writing-trees) for the format. Open a PR against [`flying-dice/abtree`](https://github.com/flying-dice/abtree) adding your tree to `.abtree/trees/` and an entry on this page, and it'll ship in the next release.
