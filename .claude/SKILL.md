---
name: abt
description: Durable execution engine for Agent Behaviour Trees. Creates flows that track work via a structured tree walk. Use when the user wants to run, resume, or inspect a behaviour tree workflow.
argument-hint: "[tree|flow-id] [work-summary]"
---

# ABT — Agent Behaviour Tree Executor

Flow-driven durable behaviour tree engine. Flows are persisted in SQLite, binding a tree to a piece of work with `$LOCAL` (blackboard) and `$GLOBAL` (world model) state.

## STRICT: Never read tree files directly

All interaction goes through the `abt` CLI. You never see the tree structure — only the requests the runtime hands you.

## Trees

`backend-design` | `code-review` | `frontend-design` | `implement` | `refine`

## Routing

Parse `$ARGUMENTS` to determine intent:

1. **No arguments** → call `flow_list`. If running flows exist, show them and ask which to resume. If none, ask which tree.
2. **Argument matches an existing flow ID** (e.g. `hono-factory-refactor__refine__1`) → RESUME that flow
3. **Argument is a tree slug** (matches a known tree name) → CREATE a new flow. Use remaining args as summary.
4. **Argument is "list"** → call `flow_list`, show all flows

## Create protocol

```
abt flow create <tree> <summary>
abt local write <flow> change_request "<user's request>"
abt next <flow>  → begin execution loop
```

## Execution loop

```
abt next <flow> → JSON response
```

The response is one of:

- `{ type: "evaluate", name, expression }` → Judge the expression. Call `abt eval <flow> true/false`.
- `{ type: "instruct", name, instruction }` → Do the work. Use `abt local read/write`, `abt global read` as needed. Then call `abt submit <flow> success/failure`.
- `{ status: "done" }` → Tree complete. Report outcome.
- `{ status: "failure" }` → Tree failed. Report what happened.

Then call `abt next` again. Repeat until done.

## Evaluating expressions

When you receive an `evaluate` request:
- Read the expression (e.g. "$LOCAL.intent_analysis is set")
- Use `abt local read` / `abt global read` to check the referenced values
- Judge whether the expression is semantically true or false
- Call `abt eval <flow> true` or `abt eval <flow> false`

If false: the runtime marks the action as failed and advances (selectors will try next branch).

### STRICT: Evaluate from actual state only

You MUST call `abt local read` or `abt global read` to retrieve the actual stored variable values.
The CLI is the source of truth for variables — use it.

## Performing instructions

When you receive an `instruct` request:
- Read the instruction carefully
- Use any tools available (file I/O, web search, sub-agents, etc.)
- Store results in `$LOCAL` via `abt local write` as the instruction directs
- Call `abt submit <flow> success` when done
- Call `abt submit <flow> failure` if you cannot complete the work

### STRICT: No inference, no invention

You MUST NOT infer, guess, or invent values. Every value you write to `$LOCAL` must come from an explicit source:

1. **If the instruction names a tool or command** (e.g. "run whoami", "use web search") → execute that exact tool. Store the result.
2. **If the instruction references a `$LOCAL` or `$GLOBAL` path** → read that path via `abt local read`/`abt global read`. Use the actual stored value.
3. **If the instruction specifies a fallback** (e.g. "if unavailable, store X") → use the literal fallback only when the primary source fails.
4. **If the instruction does not specify where to get the data** → call `abt submit <flow> failure`. Do NOT fill in the gap from context, memory, the flow summary, the user's identity, or any other implicit source.

The tree is the single source of truth for what data to produce and where it comes from. If an instruction is ambiguous about the source, that is a tree authoring error — fail the action rather than guessing.

## State

- `$LOCAL` — per-flow blackboard. Read/write via `abt local read` / `abt local write`.
- `$GLOBAL` — world model. Read-only via `abt global read`.

## CLI

All interaction goes through the `abt` CLI at `index.ts`. Run with `bun index.ts <command>`.

| Command | Purpose |
|---------|---------|
| `abt tree list` | List available tree slugs |
| `abt flow create <tree> <summary>` | Create a new flow |
| `abt flow list` | List all flows |
| `abt flow get <id>` | Get flow details + state |
| `abt flow reset <id>` | Reset flow to initial state |
| `abt next <flow>` | Get next evaluate/instruct request |
| `abt eval <flow> <true\|false>` | Submit evaluation judgement |
| `abt submit <flow> <success\|failure>` | Submit instruction outcome |
| `abt local read <flow> [path]` | Read from $LOCAL |
| `abt local write <flow> <path> <val>` | Write to $LOCAL |
| `abt global read <flow> [path]` | Read from $GLOBAL |

All commands output JSON to stdout.

## Reporting

Per action: `[flow-id] ✓ Action_Name → success/failure`

On complete: report outcome.

## Diagrams

Mermaid diagrams auto-generated at `.abt/flows/{flow-id}.mermaid` on every state change.
