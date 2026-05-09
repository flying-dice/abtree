---
name: abtree
description: Drive abtree behaviour-tree workflows. Use when the user asks to run, resume, or inspect an abtree flow; when they invoke a bundled tree (hello-world, refine, implement, code-review, backend-design, frontend-design, technical-writer); or when they ask to design a new tree.
---

<!--
  This skill is shipped with the abtree CLI. Install it with:

      abtree install skill

  Default location: ./.agents/skills/abtree/SKILL.md (project scope).
  Override the base directory with:

      AGENTS_SKILLS_DIR=~/.agents/skills abtree install skill
-->


# abtree

Reference and execution protocol for abtree — a CLI for agents that drives
YAML-defined behaviour-tree workflows.

## Routing — parse the user's request

1. **No arguments / "what's running?"** → call `abtree flow list`. If running
   flows exist, surface them and ask which to resume. If none, ask which
   tree they want to drive.
2. **Argument matches a flow ID** (format `<slug>__<tree>__<n>`) → resume
   that flow. Skip to the execution loop below.
3. **Argument is a tree slug** (matches the output of `abtree tree list`)
   → create a new flow with `abtree flow create <slug> "<summary>"`. Use
   any remaining input as the summary.
4. **"design a new tree" / "help me build a workflow"** → don't try to
   author from memory. Read `docs/guide/designing-workflows.md` (in the
   abtree repo) or fetch it from
   `https://flying-dice.github.io/abtree/guide/designing-workflows` for
   the design idioms, then collaborate with the user.

## Setup check

Before driving anything:

```sh
abtree --version
```

If this fails, install:

- macOS / Linux: `curl -fsSL https://github.com/flying-dice/abtree/releases/latest/download/install.sh | sh`
- Windows: `irm https://github.com/flying-dice/abtree/releases/latest/download/install.ps1 | iex`

## Execution loop

Call `abtree next <flow>` to get the next request. Repeat until done.

### Response: `{ "type": "evaluate", "name": …, "expression": … }`

Procedure — DO NOT skip steps:

1. Parse the expression. Identify every `$LOCAL.<path>` and
   `$GLOBAL.<path>` referenced.
2. For EACH referenced path, call:
   ```sh
   abtree local  read <flow> <path>     # for $LOCAL refs
   abtree global read <flow> <path>     # for $GLOBAL refs
   ```
   Record the actual returned value. Do not skip this step even if you
   wrote the value yourself one command ago.
3. Apply the expression's truth condition against those actual values
   and ONLY those values. No inference from context, memory, or
   "obvious" assumptions.
4. Call:
   ```sh
   abtree eval <flow> true|false
   ```

**STRICT:** Skipping step 2 corrupts the gate. The store is the source of
truth, not your context. Even when the answer "feels obvious", read it.

### Response: `{ "type": "instruct", "name": …, "instruction": … }`

Procedure:

1. Read the instruction in full.
2. Perform the work named. Use real tools — file I/O, web search, shell
   commands, sub-agents — as the instruction directs.
3. Write any produced values to `$LOCAL` via `abtree local write`.
4. Call:
   ```sh
   abtree submit <flow> success|failure|running
   ```
   Use `running` only when waiting on something external (e.g. a human
   approval). Do NOT use `running` to skip an instruct.

**STRICT:** Every value written to `$LOCAL` must come from an explicit
source named in the instruction (tool, command, `$LOCAL`/`$GLOBAL` path,
or a literal fallback). If the source is ambiguous, call `submit failure`.
Do not infer, guess, or invent.

### Response: `{ "status": "done" }` or `{ "status": "failure" }`

Tree terminated. Report the outcome to the human.

## State commands

```sh
abtree local  read  <flow> [path]            # Read from $LOCAL
abtree local  write <flow> <path> <val>      # Write to $LOCAL
abtree global read  <flow> [path]            # Read from $GLOBAL
```

## Reporting (per action)

When an action completes, surface a one-line status to the human:

```
[flow-id] ✓ Action_Name → success|failure
```

## Bundled trees

Run `abtree tree list` for the live set on the user's machine. Bundled
trees include:

| Slug | Purpose |
|---|---|
| `hello-world` | Greeting demo. Exercises all four BT primitives in fifteen lines. |
| `refine` | Turn a one-line change request into a hardened, codeowner-reviewable spec under `specs/`. |
| `implement` | Implement a feature from an approved spec — plan, critique, code. |
| `code-review` | Review an MR for correctness, test coverage, conventions. Approves or requests changes. |
| `backend-design` | Design and build a backend service from an approved spec. |
| `frontend-design` | Design and build a frontend component from an approved spec. |
| `technical-writer` | Document a topic with a styleguide gate, three review checks, and bounded retries. |

For details and Claude handover prompts for each, see
`https://flying-dice.github.io/abtree/examples`.

## Inspecting flows

A flow on disk is two files:

```
.abtree/flows/<flow-id>.json       full flow document (the source of truth)
.abtree/flows/<flow-id>.mermaid    live execution diagram, regenerated every state change
```

The JSON has `id`, `tree`, `summary`, `status`, `snapshot`, `cursor`,
`phase`, `created_at`, `updated_at`, `local`, `global`. See the inspecting
flows guide at
`https://flying-dice.github.io/abtree/guide/inspecting-flows` for the
full field reference.

## Common pitfalls

- **Treating evaluate as rubber-stamp.** Always run step 2 of the
  evaluate procedure. The store, not your context, is the source of
  truth.
- **Inventing $LOCAL values.** If an instruction doesn't name a source,
  the action is malformed; submit failure rather than fabricating.
- **Skipping a flow with submit success when stuck.** If you can't
  satisfy an instruct, submit `failure` (or `running` if waiting on a
  human). Don't fake completion.
- **Reading tree YAML directly to plan.** Don't. Drive via `abtree next`
  — the tree is the source of truth, the runtime hands you what you
  need.
