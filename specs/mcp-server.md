---
id: 1778346000-mcp-stdio-server
title: MCP Stdio Server
status: draft
author: Starscream
created: 2026-05-09
reviewed_by:
---

## Summary

Add an `abtree mcp` subcommand that runs an MCP (Model Context Protocol) server over stdio, exposing the existing CLI surface to LLM clients. The execution protocol (today's `AGENT.md` / `--help` content) is exposed as an **MCP resource** so connected agents can read it once and learn the loop. The CLI commands (`tree list`, `execution *`, `next`, `eval`, `submit`, `local *`, `global *`) are exposed as **MCP tools** the agent invokes to drive an execution without shelling out.

Target user workflow:

```sh
claude mcp add stdio abtree abtree mcp
# Agent now sees abtree's tools and the protocol resource directly inside its context.
```

## Requirements

- **New subcommand:** `abtree mcp` runs an MCP server speaking JSON-RPC 2.0 over stdin/stdout. Process blocks until the client closes the connection.
- **Resource — execution protocol:** the agent can read URI `abtree://protocol` and receive the contents of `AGENT.md` (already imported as `EXECUTION_GUIDE`). This is the same content `--help` appends today; reusing the import keeps a single source of truth.
- **Resources — execution documents (optional but desirable):** `abtree://executions/{id}` returns the JSON document for an execution, identical to `abtree execution get <id>`. Lets the agent inspect state without cluttering tool calls.
- **Resources — trees (optional but desirable):** `abtree://trees/{slug}` returns the raw YAML of a tree from `.abtree/trees/` or `~/.abtree/trees/`.
- **Tools — one per CLI command** (snake_case names, JSON-schema inputs):
  | MCP tool | Wraps |
  |---|---|
  | `tree_list` | `abtree tree list` |
  | `execution_create` | `abtree execution create <tree> <summary>` |
  | `execution_list` | `abtree execution list` |
  | `execution_get` | `abtree execution get <id>` |
  | `execution_reset` | `abtree execution reset <id>` |
  | `execution_next` | `abtree next <id>` |
  | `execution_eval` | `abtree eval <id> <true\|false>` |
  | `execution_submit` | `abtree submit <id> <success\|failure\|running>` |
  | `local_read` | `abtree local read <id> [path]` |
  | `local_write` | `abtree local write <id> <path> <value>` |
  | `global_read` | `abtree global read <id> [path]` |
- **Tool descriptions cite the protocol resource.** Each tool's `description` ends with `Read abtree://protocol first to learn the execution loop.` so an agent that lists tools without reading resources still gets nudged.
- **Implementation reuses `cmdXxx`:** the MCP layer is a thin adapter over `src/commands.ts`. No duplicated state logic, no second source of truth. Each tool handler calls the same `ExecutionStore`/`tickNode` chain the CLI uses.
- **`bun build --compile` still produces a standalone binary** for all five release platforms (linux x64/arm64, darwin x64/arm64, windows x64). The MCP SDK must be bundle-compatible.
- **Validation reuses `src/validate.ts`** (parseExecutionId, parseTreeSlug, parseSummary, parseScopePath, parseEvalResult, parseSubmitStatus) so input rules stay identical between CLI and MCP entry points.
- **The protocol resource and tool list are stable enough to declare a v1.** Future tool additions append; tool removal is a breaking change.

## Technical Approach

### Dependency
Add `@modelcontextprotocol/sdk` as a runtime dependency. It's the official TypeScript SDK; works under Bun. The alternative — hand-rolling JSON-RPC 2.0 over stdio — is ~150 lines of framing code we don't need to maintain.

### File layout
- **New:** `src/mcp.ts` — the MCP server bootstrap. Exports `runMcpServer()`.
- **Modified:** `index.ts` — register a `mcp` subcommand on the Commander program; the action calls `runMcpServer()`.
- **Modified:** `src/commands.ts` — extract a non-`out()`-printing variant of each handler. Today the `cmdXxx` functions write JSON to stdout via `out()`. The MCP adapter needs the *return value*, not stdout output. Refactor to:
  - `runExecutionCreate(tree, summary): ExecutionDoc`
  - `runExecutionList(): SummaryRow[]`
  - … etc.
  - Keep `cmdExecutionCreate(tree, summary)` as a thin shell that calls `runExecutionCreate` and pipes through `out()`.
- **No changes to:** `src/repos.ts`, `src/tree.ts`, `src/paths.ts`, `src/types.ts`, `src/mermaid.ts`. The MCP layer sits above them.

### Server bootstrap shape
```ts
// src/mcp.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import EXECUTION_GUIDE from "../AGENT.md" with { type: "text" };
import { runExecutionCreate, runExecutionList, /* … */ } from "./commands.ts";
import { ExecutionStore } from "./repos.ts";
import { loadTree } from "./tree.ts";

export async function runMcpServer() {
  const server = new Server(
    { name: "abtree", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  // Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: "abtree://protocol", name: "Execution protocol", mimeType: "text/markdown" },
      // dynamic: list every execution as abtree://executions/{id}
      // dynamic: list every tree as abtree://trees/{slug}
    ],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    if (req.params.uri === "abtree://protocol")
      return { contents: [{ uri: req.params.uri, mimeType: "text/markdown", text: EXECUTION_GUIDE }] };
    // … execution + tree branches
  });

  // Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [/* one entry per command, with JSON Schema inputs */],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    switch (req.params.name) {
      case "tree_list": return { content: [{ type: "text", text: JSON.stringify(runTreeList(), null, 2) }] };
      // … one case per tool
    }
  });

  await server.connect(new StdioServerTransport());
}
```

### Tool input schemas
Each schema mirrors the CLI argument validators. Example:

```ts
{
  name: "execution_create",
  description: "Create a new execution from a tree. Read abtree://protocol first to learn the execution loop.",
  inputSchema: {
    type: "object",
    required: ["tree", "summary"],
    properties: {
      tree: { type: "string", description: "Tree slug from `tree_list`" },
      summary: { type: "string", description: "Human label, kebab-cased into the execution ID" },
    },
  },
}
```

### Tool output shape
MCP tool responses are `{ content: [{ type: "text", text: "..." }] }`. The text is the JSON-stringified return value of the underlying `runXxx`. Pretty-printed (2-space indent) so an agent reading raw text can still parse it; structured-content support varies across clients.

### Error handling
Every `runXxx` that today calls `die()` becomes a function that throws a typed error. The MCP layer catches and returns `{ isError: true, content: [{ type: "text", text: error.message }] }`. The CLI shell still calls `die()` on the same thrown error.

### Bundling
`bun build --compile` resolves the MCP SDK at compile time and inlines it. A pre-merge smoke test: `bun build --compile --target=bun-linux-x64 index.ts --outfile=/tmp/abtree && /tmp/abtree mcp <<< '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` should return a tools array.

## Affected Systems

- `package.json` — add `@modelcontextprotocol/sdk` to `dependencies`
- `index.ts` — register `mcp` subcommand
- `src/mcp.ts` — new file, ~200 lines
- `src/commands.ts` — refactor `cmdXxx` to `runXxx` + `cmdXxx` shell pair
- `AGENT.md` — no change (already the source of truth, imported as text)
- `docs/guide/cli.md` — add an "MCP server" section documenting the subcommand and resource URIs
- `docs/examples.md` — add a "Connect via MCP" snippet showing `claude mcp add stdio abtree abtree mcp`
- `README.md` — restore the MCP claim that was previously misleading; update the SQLite paragraph at the same time
- `.releaserc` — no change (binary already includes everything the bundler resolves)

## Acceptance Criteria

- `abtree mcp` starts a server that responds correctly to the four MCP requests:
  1. `initialize` — returns capabilities `{ tools: {}, resources: {} }`.
  2. `resources/list` — includes `abtree://protocol` plus one entry per current execution and one per tree.
  3. `resources/read uri=abtree://protocol` — returns the AGENT.md content as `text/markdown`.
  4. `tools/list` — returns the eleven tool entries with non-empty `description` and valid `inputSchema`.
- `tools/call name=tree_list` returns the same array `abtree tree list` prints.
- `tools/call name=execution_create arguments={tree, summary}` creates the execution and returns the same JSON `abtree execution create` prints.
- A full `hello-world` walk via MCP tool calls (no CLI shell-out) produces a JSON document at `.abtree/executions/{id}.json` byte-equivalent to the same execution run via the CLI.
- `claude mcp add stdio abtree abtree mcp` registers the server, and `claude` can list and call `tree_list` from a fresh chat without further setup.
- `bun build --compile --target=bun-linux-x64 index.ts --outfile=abtree-linux-x64` succeeds; running `./abtree-linux-x64 mcp <<< <init json>` produces a valid MCP `initialize` response.
- `bun test` passes (existing tests untouched).
- `bunx tsc --noEmit` introduces no new diagnostics.

## Risks & Considerations

- **MCP SDK bundling.** The SDK uses dynamic `import()` in some paths; `bun build --compile` may fail to resolve a transitive. Mitigation: smoke-test the compile step in CI before merge. Fall-back: hand-roll JSON-RPC 2.0 over stdio (~150 lines, no dep).
- **stdio noise.** Anything written to `stdout` *other* than JSON-RPC frames breaks the protocol. The CLI's `out()` writes to stdout, and `console.log` calls in error paths would corrupt the stream. The MCP adapter must guarantee zero stdout writes outside the SDK. `console.error` (stderr) for diagnostics is fine. Implementation detail: when running as `abtree mcp`, no `cmdXxx` function should ever execute. Only `runXxx` (returns values) gets called.
- **Resource discovery.** Most MCP clients show resources but don't auto-read them. The "read protocol first" cue lives in every tool description as a backstop. If real-world testing shows agents skip it anyway, escalate to making `execution_next` *return* the protocol the first time it's called per session.
- **Capability surface drift.** Every new CLI command needs a paired tool, or the MCP and CLI surfaces drift. Mitigation: a checklist in `docs/guide/cli.md` and a TODO in `src/mcp.ts` listing every tool, so reviewers catch the gap.
- **Concurrency.** The MCP server is single-threaded over stdio, single-client. No locking concerns. If a future MCP client opens parallel tool calls against the same execution, the JSON file write semantics from the original spec (atomic temp+rename) hold.
- **Backwards compatibility.** None to preserve — there is no MCP today. Tool names and schemas should be reviewed once before declaring v1, since renames after that point break existing client configs.

## Open Questions

- **Should `execution_next` automatically embed the protocol on first call?** Could solve the resource-discovery problem at the cost of repeating ~3KB of text per session start. Defer until empirical evidence shows agents miss the resource.
- **Prompts capability.** MCP also supports "prompts" — pre-templated user messages. Worth exposing one prompt per bundled tree (e.g. `hello-world-walkthrough`) to make `claude` users one click away from running an execution? Not critical for v1; flag as a follow-up.
- **Authorization / scoping.** The MCP server runs with the same filesystem permissions as the user. Trees and flows are read/written without auth checks. For multi-user contexts (a hosted abtree daemon), this would need rethinking. Out of scope for the stdio variant.
