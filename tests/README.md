# abtree regression suite

End-to-end regression tests for the abtree runtime and its transports. The scenario is written once in `regression.ts` and driven against both transports (CLI subprocess + MCP server) via `@abtree/harness`, proving behavioural parity.

## Run

From the repo root:

```sh
bun run test:regression       # CLI then MCP
bun run test:regression:cli   # CLI only
bun run test:regression:mcp   # MCP only
```

Each rebuilds `main.json` from `tree.ts` first, so the DSL source stays the canonical truth.

## How the scenario reads

`regression.ts` reads as a script of agent–runtime exchanges. The DSL lives in [`@abtree/harness`](../packages/harness/README.md) and uses the abtree CLI vocabulary:

- **Matchers** in `when(...)` mirror runtime `next` response types: `instruct(name)`, `evaluate(name)`.
- **Actions** in `.respond(...)` mirror CLI verbs: `submit(status)`, `eval(result)`, `localWrite(path, value)`.

```ts
await agent.when(instruct("Write_Counter"))
  .respond(localWrite("counter", 1), submit("success"));

await agent.when(evaluate("Verify_Counter")).respond(evalAs(true));
```

Each line reads: *"when the runtime asks me to do X, the agent responds with Y."* The terminal action in each `.respond(...)` is either `submit(...)` or `eval(...)` — that's what advances the cursor.

## Files

| File | Purpose |
| --- | --- |
| `tree.ts` | DSL source — the regression tree itself |
| `build.ts` | DSL → `main.json` |
| `main.json` | Build output; loaded by the abtree CLI / MCP server |
| `package.json` | Minimal — `name` + `main` so abtree can load the tree by slug |
| `regression.ts` | The scenario — same script, both transports |
| `run-cli.ts` | Thin runner: wires `CliTransport` into the harness |
| `run-mcp.ts` | Thin runner: wires `McpTransport` into the harness |

The harness class, transports, and fixture helper live in `@abtree/harness` (`packages/harness/`).

## What the scenario exercises

| Case | Coverage |
| --- | --- |
| `Local_State_Round_Trip` | `next` → `instruct` → `localWrite` → `submit success` → `next` → `evaluate` → `eval true` for numeric + string values |
| `Selector_Fall_Through` | `eval false` fails an action → selector advances to the next sibling → second action succeeds |
| `Verify_Recovery` | `$LOCAL` persists across the selector's failed first branch |
| `Verify_Global_Default` | `$GLOBAL` read via the global tool, evaluated against a module-scope default |
| `Delegate_Round_Trip` | `delegate(...)` desugars to `[Spawn_X, …body, Return_To_Parent_X]`; the output gate passes because the driver writes the declared `$LOCAL` slot inside the scope |

The drivers don't actually spawn a subagent for the delegate scope — the regression is about runtime + transport behaviour, not LLM-driven execution. Both drivers walk every step in the scope themselves.

## Adding a case

1. Add the case as a child of the root `sequence` in `tree.ts`.
2. Append matching `when(...).respond(...)` lines in `regression.ts`.
3. If the case leaves new `$LOCAL` slots set, update `EXPECTED_FINAL_LOCAL` at the top of `regression.ts`.
4. `bun run test:regression`. Both transports should pass.

Keep cases deterministic — every `instruct` step should either be a `localWrite` of a literal value or a bare `submit("success")`. No content interpretation.
