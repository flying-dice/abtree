---
id: 1778362005-execution-protocol-strict-read
title: Agent Execution Protocol
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

The execution protocol — what an LLM driving abtree is expected to do at each step — lives in two files: `AGENT.md` (loaded by the binary at compile time, served via `--help`) and `SKILL.md` (installable as an Agent Skill via `abtree install skill`). The two files are kept in sync at the protocol layer; SKILL.md adds Skill-specific frontmatter and platform-routing rules. The protocol is structured as numbered procedures (one per response type) so the strict read-the-store rule is operationally part of handling each request, not a footnote.

## Requirements

- A single canonical statement of the execution loop, the response shapes, and the strict rules.
- The CLI's `--help` output includes the full protocol so an agent that runs `--help` first to learn the loop has everything it needs.
- The same protocol is installable as an Agent Skill (per agentskills.io / Claude Code conventions) so platform-aware agents pick it up automatically.
- The protocol is **procedural**: each response type has a numbered step list with a "DO NOT skip steps" callout. This formalises rules that are otherwise easy to skim past as bullet items.
- The strict read-the-store rule is encoded as **step 2 of the evaluate procedure**: every referenced `$LOCAL.*` and `$GLOBAL.*` path must be read via `abtree local read` / `abtree global read` before the boolean is judged. This rule exists because the alternative (judging from agent context) corrupts the gate.

## Technical Approach

### File split

| File | Purpose |
|---|---|
| `AGENT.md` | Source of truth for the protocol. Bundled into the binary via `import EXECUTION_GUIDE from "./AGENT.md" with { type: "text" }` and appended to `--help` via `program.addHelpText("after", EXECUTION_GUIDE)`. |
| `SKILL.md` | Skill-formatted variant: same protocol body, prefixed with frontmatter (`name`, `description`) the host platform reads, and routing rules for "what does the user want?" Bundled into the binary via the same text-import pattern, written to disk by `abtree install skill`. |

The two files duplicate the protocol body. Acceptable: the protocol is short; the alternative (one file `@import`-ing the other) doesn't compose with markdown frontmatter and would complicate the bundling.

### Protocol structure

Both files share the same backbone:

1. **One-paragraph framing.** "abtree is a durable behaviour tree engine..."
2. **Routing.** Map the user's argument(s) to the right command — no args / execution ID / tree slug / `list`.
3. **Create protocol.** The three-command setup for a fresh execution (`execution create` → `local write change_request` → `next`).
4. **Execution loop.** The `next → eval | submit → next` cycle.
5. **Response procedures.** One numbered procedure per response shape:
   - `{ "type": "evaluate" }` → 4-step procedure (parse expression → read store → judge → call eval).
   - `{ "type": "instruct" }` → 4-step procedure (read instruction → do work → write LOCAL → call submit).
   - `{ "status": "done" }` / `{ "status": "failure" }` → terminate, report.
6. **State commands.** The five primitives (`local read/write`, `global read`).
7. **Reporting.** Per-action status line conventions.

### The strict read rule

Phrasing in AGENT.md (verbatim from `EXECUTION PROTOCOL → evaluate procedure`):

> 2. For EACH referenced path, call:
>      abtree local  read <execution> <path>
>      abtree global read <execution> <path>
>    Record the actual returned value. Do not skip this step even if you wrote the value yourself one command ago.

The "do not skip even if you wrote it yourself" clause is calibrated to the actual failure mode: agents tend to short-circuit when the value seems obviously known. The clause names the temptation directly.

A `STRICT:` callout immediately after the procedure makes the consequence explicit: "Skipping step 2 corrupts the gate. The store is the source of truth, not your context."

### Routing in SKILL.md

SKILL.md adds platform-routing material AGENT.md doesn't need (because `--help` is already inside the CLI). Sample:

> 1. **No arguments / "what's running?"** → call `abtree execution list`. If running executions exist, surface them and ask which to resume.
> 2. **Argument matches an execution ID** (format `<slug>__<tree>__<n>`) → resume that execution.
> 3. **Argument is a tree slug** → create a new execution with `abtree execution create <slug> "<summary>"`.
> 4. **"design a new tree" / "help me build a workflow"** → read `docs/guide/designing-workflows.md` (or fetch the docs site URL); collaborate with the user.

### Bundled-trees catalogue

Both files name the bundled trees so the agent can pattern-match user intent ("run hello-world", "do a code review on MR X") against the available shapes. SKILL.md adds a one-line description per tree; AGENT.md just lists slugs and points at `abtree tree list`.

## Affected Systems

- `AGENT.md` — repo root.
- `SKILL.md` — repo root.
- `index.ts` — text imports both files, calls `program.addHelpText("after", EXECUTION_GUIDE)` and passes `SKILL_CONTENT` to `cmdInstallSkill`.
- `src/commands.ts` — `cmdInstallSkill` writes the SKILL.md content to the resolved target.
- `.releaserc` — `SKILL.md` ships as a release asset.

## Acceptance Criteria

- `abtree --help` ends with the full execution protocol.
- An agent reading `abtree --help` sees the strict read rule as step 2 of the evaluate procedure (not in a separate "rules" section).
- `abtree install skill --variant claude --scope user` writes a SKILL.md whose body matches the bundled SKILL.md byte-for-byte.
- The release page at `github.com/flying-dice/abtree/releases/latest` lists `SKILL.md` as a downloadable asset.
- An agent that follows the protocol literally (calling `local read` before every evaluate) never short-circuits gates incorrectly.

## Risks & Considerations

- **Duplication between AGENT.md and SKILL.md.** The protocol body is repeated. Updating one without the other creates drift. Mitigation: code-review checklist for any protocol change touches both files; long-term a build-time merge from a shared source could collapse them.
- **The strict rule is unenforceable from inside abtree.** abtree can't tell whether the agent actually called `local read` before answering — it only sees the eval response. The protocol is a contract the agent honours; violations corrupt the gate but don't fail loudly. Documented; the audit trail in `runtime.retry_count` and the `runtime.node_status` history makes diagnosis possible.
- **Skill-spec drift.** agentskills.io and Claude Code's skill format are still evolving. The current SKILL.md uses frontmatter (`name`, `description`) compatible with both. Future spec changes may require frontmatter additions.
- **Length.** The protocol is dense, currently ~80 lines. Longer than ideal for an LLM context, but every line earns its place. Trimming further would lose either the procedures or the strict rule, both of which were added because earlier shorter versions failed in practice.

## Open Questions

- Should `SKILL.md` ship a separate `agents.md` sibling at the agentskills.io top level, or is the per-skill `SKILL.md` enough? Current shipping bet: per-skill is enough; `agents.md` is a future concern.
