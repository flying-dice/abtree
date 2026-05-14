---
id: 20260513-curious-trace-narrate
title: Agent step notes and execution trace
status: refined
author: Starscream
created: 2026-05-13
reviewed_by: Starscream
---

## Summary

Give the agent a way to attach a short free-text note to every `eval`, `submit`, and protocol-acknowledgement call, and persist those notes alongside engine-side outcome data as an append-only `trace: TraceEntry[]` array on the execution document. The aim is observability of agent thought-process: a top-to-bottom replay of "which node, what was submitted, what the engine decided, and why the agent thought so." Purely additive — no wire-format break, no engine-control change.

## Requirements

- `coreEval(id, result, note?)` and `coreSubmit(id, status, note?)` accept an optional `note: string`.
- `coreSubmit` records protocol-stage acknowledgements in the trace with `kind: "protocol"`.
- Every successful `eval` / `submit` call appends exactly one entry to `execution.trace` before returning.
- The CLI `eval` and `submit` commands accept `-n, --note <text>`; empty/whitespace-only notes collapse to `undefined`.
- The MCP `abtree_eval` and `abtree_submit` tools accept an optional `note: string` field.
- `abtree_execution_get` and `abtree execution get <id>` return the trace as part of the execution document.
- `coreExecutionCreate` initialises `trace: []`. `coreExecutionReset` clears it back to `[]`.
- On-disk execution documents that pre-date this change load cleanly: a missing `trace` field is treated as `[]`.
- `docs/agents/execute.md` documents the optional note for `evaluate`, `instruct`, and protocol stages, with one-sentence guidance on what to write.
- Existing tests pass unmodified; new tests cover the note round-trip end-to-end through CLI and MCP.

## Technical Approach

### Data model (`packages/runtime/src/types.ts`)

```ts
export type TraceKind = "evaluate" | "instruct" | "protocol";

export type TraceEntry = {
  ts: string;          // ISO 8601 UTC
  kind: TraceKind;
  cursor: string;      // encoded cursor as the agent acted on it (pre-mutation)
  name: string;        // node name; "Acknowledge_Protocol" for protocol entries
  submitted: string;   // "true" | "false" | "success" | "failure" | "running" | "accept" | "reject"
  outcome: string;     // engine-side status string: "evaluation_passed", "action_failed", "protocol_accepted", etc.
  note?: string;       // omitted if undefined or trimmed to empty
};

export interface ExecutionRow {
  // ...existing fields...
  trace: TraceEntry[];
}
```

Re-export `TraceEntry` and `TraceKind` from `packages/runtime/src/index.ts`.

### Storage (`packages/runtime/src/repos.ts`)

In `readDocInternal`, after `JSON.parse`, normalise: `if (!Array.isArray(doc.trace)) doc.trace = []`. This is the only back-compat shim; first write after load persists the field.

Two changes to `ExecutionStore`:

1. Extend `update`'s field union to include `trace`:

   ```ts
   update(
     id: string,
     fields: Partial<
       Pick<ExecutionRow, "status" | "cursor" | "phase" | "protocol_accepted" | "trace">
     >,
   ): void
   ```

   Used by `coreExecutionReset` to clear the trace alongside the other reset fields, in a single write.

2. Add `appendTrace` for the per-step append:

   ```ts
   appendTrace(id: string, entry: TraceEntry): void {
     const doc = readDoc(id);
     if (!doc) throw new Error(`Execution not found: ${id}`);
     doc.trace.push(entry);
     doc.updated_at = new Date().toISOString();
     writeDoc(doc);
   }
   ```

Each per-step append is its own write, in addition to the existing cursor/phase `update`. That doubles write count per step. Acceptable: trees are O(10s) of steps, FS is local, and the mutation listener (mermaid + svg rebuild) is already cheap. Not worth fusing the two writes for a hot path that isn't hot.

### Core functions (`packages/cli/src/commands.ts`)

`coreEval(id, result, note?)`:

1. Resolve doc + node-from-cursor (already done today).
2. Capture `cursorBefore = doc.cursor` and `nodeName` *before* any mutation.
3. Apply the engine mutation as today (`setStepIndex` / `setNodeResult` / phase reset).
4. Compute `outcome = result ? "evaluation_passed" : "evaluation_failed"` (today's return-status strings).
5. `ExecutionStore.appendTrace(id, { ts, kind: "evaluate", cursor: cursorBefore, name: nodeName, submitted: String(result), outcome, note })`.
6. Return the existing payload.

`coreSubmit(id, status, note?)`:

- Protocol phase (`runProtocolSubmit`):
  - `submitted = status === "success" ? "accept" : status === "failure" ? "reject" : "running"`.
  - `outcome` is whichever message branch fires (`protocol_accepted` / `protocol_rejected` / `running`).
  - Append once with `kind: "protocol"`, `name: PROTOCOL_GATE_NAME`, `cursor: doc.cursor` (which is `NULL_CURSOR` during protocol — record it as-is).
  - Note: today `runProtocolSubmit` with `status: "running"` returns without writing the doc. Adding the trace append means we *will* write on `running` — intentional, captures the agent's "received but not yet ready" signal.
- Performing phase (`runPerformingSubmit`):
  - `kind: "instruct"`, `submitted = status`, `outcome` is whichever branch fires (`action_failed` / `action_complete` / `step_complete` / `running`).
  - Capture cursor *before* `setStepIndex` / `setNodeResult` calls.
  - Same note as above: `status: "running"` today returns without writing; trace append now forces a write. Intentional.

Append happens unconditionally in every branch — the agent's note about *why* they paused is the most valuable kind. Empty/whitespace `note` is normalised by `parseNote` (CLI) and rejected by the zod schema (MCP); the runtime never sees `note: ""`.

`coreExecutionCreate` includes `trace: []` in the row it passes to `ExecutionStore.create`. `coreExecutionReset` calls `ExecutionStore.update(id, { status, cursor, phase, protocol_accepted, trace: [] })` — one write, all fields including the cleared trace. (Depends on the `update` field-union extension above.)

### CLI plumbing

`packages/cli/src/parse-args.ts`:

```ts
export function parseNote(val?: string): string | undefined {
  if (typeof val !== "string") return undefined;
  const t = val.trim();
  return t.length === 0 ? undefined : t;
}
```

`packages/cli/index.ts`: add `.option("-n, --note <text>", "Optional note explaining the decision")` to both the `eval` and `submit` commands. Forward `parseNote(opts.note)` to `cmdEval` / `cmdSubmit`, which forward to `coreEval` / `coreSubmit`.

### MCP plumbing (`packages/cli/src/mcp/tools.ts`)

On `abtree_eval` and `abtree_submit` input schemas:

```ts
note: z
  .string()
  .trim()
  .min(1)
  .optional()
  .describe(
    "Optional one-sentence justification of this decision — name the values that drove it. Recorded in the execution trace for later review.",
  ),
```

`.trim().min(1).optional()` rejects whitespace-only notes at the wire boundary. Strict on purpose: surface the agent's mistake rather than swallow it. CLI behaviour is the same by way of `parseNote` collapsing whitespace to `undefined` — the runtime never receives an empty string.

### Docs (`docs/agents/execute.md`)

Under the `evaluate` and `instruct` procedures, add a short subsection:

> **Optional: explain your decision.** Pass `--note "<one sentence>"` (CLI) or `note:` (MCP) to record why you submitted what you did. Keep it short: name the values from `$LOCAL` / `$GLOBAL` that drove the call (eval), or the action you took and the result (instruct). The engine ignores the content; the note is for later review of the agent's thought-process. Skip it on trivial transitions; include it whenever the choice was non-obvious.

Add a sentence to the protocol-gate section: rejection notes are particularly load-bearing because they capture *why* an agent walked away from a tree.

The CLI imports `EXECUTE_DOC` from this same file via `with { type: "text" }`, so the bundled protocol-gate text updates automatically.

### Tests

- `packages/runtime/tests/trace.test.ts` (new): readDoc default `trace: []` for legacy file; `appendTrace` round-trip; mutation listener fires.
- `packages/cli/tests/cli.test.ts` (extend): one execution; advance through one protocol-accept + one evaluate(true, note) + one instruct(success, note); assert `execution get` returns 3 trace entries with the expected `note` values and `kind` ordering.
- `packages/cli/tests/mcp.test.ts` (extend): same round-trip via MCP tool surface.
- `packages/cli/tests/mcp-bench.test.ts`: confirm bench still passes; no extra assertions needed.

## Affected Systems

- `packages/runtime/src/types.ts` — `TraceEntry`, `TraceKind`, `ExecutionRow.trace`.
- `packages/runtime/src/repos.ts` — default `trace: []` on read; new `appendTrace`.
- `packages/runtime/src/index.ts` — re-export new types.
- `packages/cli/src/commands.ts` — `coreEval` / `coreSubmit` accept optional `note`; create/reset initialise/clear `trace`.
- `packages/cli/src/parse-args.ts` — `parseNote` helper.
- `packages/cli/index.ts` — `--note` option on `eval` / `submit`.
- `packages/cli/src/mcp/tools.ts` — `note` field on `abtree_eval` / `abtree_submit`.
- `docs/agents/execute.md` — protocol doc; bundled into CLI via `with { type: "text" }`.
- Tests: `packages/runtime/tests/trace.test.ts` (new); extensions to `packages/cli/tests/cli.test.ts` and `packages/cli/tests/mcp.test.ts`.

## Acceptance Criteria

1. `abtree eval <id> true --note "value matched"` and `abtree submit <id> success --note "did the thing"` succeed, and `abtree execution get <id>` returns those entries on `trace`.
2. `abtree eval <id> true` (no `--note`) succeeds; the resulting trace entry has no `note` field (not `""`, not `null`).
3. MCP `abtree_eval` / `abtree_submit` accept `note`; round-tripping through `abtree_execution_get` yields the same value. MCP rejects whitespace-only notes with a validation error.
4. Fresh `abtree_execution_create` returns a doc with `trace: []`.
5. `abtree execution reset <id>` clears the trace in a single write (one mutation listener firing).
6. Loading any existing execution JSON in `.abtree/executions/` (no `trace` field) yields `trace: []` without throwing.
7. Protocol acknowledgement (`coreSubmit` during `phase === "protocol"`) appends a trace entry with `kind: "protocol"`, `submitted: "accept" | "reject" | "running"`, `outcome` matching the existing status string.
8. A trace entry's `cursor` value equals the cursor returned by the preceding `abtree_next` call — i.e. the runtime records the agent's cursor, not the post-mutation cursor. Test asserts this for both `eval` and `submit`.
9. `coreSubmit` with `status: "running"` (in either protocol or performing phase) appends a trace entry, even though it doesn't advance state.
10. Existing `packages/runtime/tests/*` and `packages/cli/tests/*` pass without modification (only additions).
11. `docs/agents/execute.md` is updated; `abtree docs execute` prints the updated text (verifies the import wiring).

## Risks & Considerations

- **Cursor-capture timing.** The trace must record the cursor as the agent acted on it, not the cursor after the engine advances. It's easy to read `doc.cursor` after calling `ExecutionStore.update` and accidentally capture the next position. Mitigation: capture `doc.cursor` into a local variable at the top of each `coreEval` / `coreSubmit` branch, before any mutation. Acceptance criterion #8 enforces this with a test.
- **Reset wipes trace.** This is a deliberate choice — reset is a clean-slate operation, and partial trace preservation would be surprising. The trade-off: you can't see why an execution was reset by reading the trace. If reset history proves useful for debugging, revisit; not blocking.
- **Trace size growth.** Unbounded array, but realistic per-execution ceiling is low (O(10s) of entries). If a tree ever runs to many thousands of steps, single-doc reads/writes get slow. Out of scope; mitigation if/when it matters is to spill to a sidecar file at a threshold.
- **No notes on `next`, `local read/write`, `global read`.** Documented as a non-goal. The trace shows decisions but not the inputs the agent read between them. If that gap proves load-bearing for debugging, a follow-up can add scope-read events. Not now.
- **Mermaid / SVG rendering does not change.** The renderer could overlay the last note per node in future. Explicit non-goal here; the data lands first.

## Open Questions

None blocking. The earlier draft hedged on three items; all are now decided in the body:

- Timestamps are ISO 8601 (matches `created_at` / `updated_at`).
- `running` outcomes append a trace entry (the agent's reason for pausing is the highest-value note).
- `appendTrace` and `update` are kept as separate methods — two writes per step is acceptable; not worth fusing.
