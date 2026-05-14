---
title: Driving abtree over MCP
description: Run abtree as an STDIO Model Context Protocol server so an agent can drive an execution through typed tool calls instead of spawning the CLI per step. Same surface, structured I/O, ~9× faster wall-clock in the bundled bench.
---

# Driving abtree over MCP

The `abtree mcp` subcommand starts the abtree CLI surface as a Model Context Protocol (MCP) server over stdio. Agents that natively speak MCP (Claude Code, Claude Desktop, others) can register the server and drive an execution through structured tool calls — no per-step subprocess spawn, no stdout parsing, typed input/output schemas.

The commander-based CLI (`abtree next …`, `abtree submit …`, etc.) is still the canonical surface and works exactly as before. MCP is additive — both surfaces share one source of truth, the same `core*` functions in `packages/cli/src/commands.ts`.

## Start the server

```sh
abtree mcp
```

The process stays alive on stdin/stdout until the client disconnects. Nothing is written to stderr except fatal startup errors. The subcommand takes no positional args.

You normally don't invoke this command yourself — you register it in your MCP client and the client spawns it on demand.

## Register the server in your MCP client

The fastest way is `abtree install mcp stdio` — it merges the abtree server entry into your client's config file without touching the other servers you've already registered.

```sh
abtree install mcp stdio
```

The command prompts you to pick a target. Pass `--target` to skip the prompt:

```sh
# Claude Code, project-scoped (./.mcp.json — typically checked into the repo)
abtree install mcp stdio --target claude-code-project

# Claude Code, user-scoped (~/.claude.json)
abtree install mcp stdio --target claude-code-user

# Claude Desktop (platform-specific user config path)
abtree install mcp stdio --target claude-desktop
```

Use `--command <path>` if `abtree` isn't on `PATH` in the environment your client uses (e.g. when running from a checkout):

```sh
abtree install mcp stdio --target claude-code-project --command /opt/abtree/bin/abtree
```

Restart the client. The 10 abtree tools and 4 docs resources should appear.

If you'd rather edit the config by hand, the entry looks like this:

```json
{
  "mcpServers": {
    "abtree": {
      "command": "abtree",
      "args": ["mcp"]
    }
  }
}
```

## What the server exposes

### 10 tools (one per abtree-loop verb)

| Tool | Maps to | Annotations |
| --- | --- | --- |
| `abtree_next` | `abtree next <execution>` | mutating cursor |
| `abtree_eval` | `abtree eval <execution> <true\|false>` | mutating cursor |
| `abtree_submit` | `abtree submit <execution> <success\|failure\|running>` | mutating cursor |
| `abtree_local_read` | `abtree local read <execution> [path]` | `readOnlyHint: true` |
| `abtree_local_write` | `abtree local write <execution> <path> <value>` | `destructiveHint: true`, `idempotentHint: true` |
| `abtree_global_read` | `abtree global read <execution> [path]` | `readOnlyHint: true` |
| `abtree_execution_create` | `abtree execution create <tree> <summary>` | side-effect (new state) |
| `abtree_execution_list` | `abtree execution list` | `readOnlyHint: true` |
| `abtree_execution_get` | `abtree execution get <id>` | `readOnlyHint: true` |
| `abtree_execution_reset` | `abtree execution reset <id>` | `destructiveHint: true`, `idempotentHint: true` |

Tool results carry both `content` (text) and `structuredContent` (parsed object) — MCP clients that want the parsed object can read it directly and skip JSON parsing.

Errors thrown by the underlying runtime translate to `{ isError: true, content: [...] }`. The error text is identical to what the CLI writes to stderr.

### 4 resources (under the `abtree://docs/` scheme)

| URI | Mime type | Source |
| --- | --- | --- |
| `abtree://docs/execute` | `text/markdown` | `docs/agents/execute.md` — execution protocol |
| `abtree://docs/author` | `text/markdown` | `docs/agents/author.md` — tree authoring guide |
| `abtree://docs/schema` | `application/json` | `tree.schema.json` — tree-file JSON Schema |
| `abtree://docs/skill` | `text/markdown` | `packages/cli/src/SKILL.md` — agent skill manifest |

Agents fetch the protocol doc once via `resources/read abtree://docs/execute` instead of burning a tool call on it. The first `abtree_next` against a fresh execution still returns the `Acknowledge_Protocol` instruct as usual, so the agent gets primed by the normal flow either way — the resource is for "I want to look it up mid-execution" cases.

## Worked example: drive hello-world via MCP

Once registered, ask the agent to drive an execution. From the agent's point of view it's a sequence of tool calls — no shell, no JSON parsing.

```text
1. abtree_execution_create({ tree: "hello-world", summary: "greet me" })
   → { id: "greet-me__hello-world__1", … }

2. abtree_next({ execution: id })
   → { type: "instruct", name: "Acknowledge_Protocol", … }
   abtree_submit({ execution: id, status: "success" })

3. abtree_next({ execution: id })
   → { type: "instruct", name: "Determine_Time", … }
   abtree_local_write({ execution: id, path: "time_of_day", value: "morning" })
   abtree_submit({ execution: id, status: "success" })

… and so on until { status: "done" }.
```

Same nine logical steps the CLI flow runs through — just typed inputs and structured outputs instead of stdout-parsed strings.

## Efficiency

The bundled `packages/cli/tests/mcp-bench.test.ts` drives hello-world end-to-end twice — once via per-step CLI subprocess spawn, once via a single MCP server subprocess driven by tool calls — and prints a side-by-side comparison every `bun test` run.

Representative numbers from a local M-series machine:

```text
┌─ MCP vs CLI bench (hello-world end-to-end) ──────────
│  CLI : 883.0 ms  (20 subprocess spawns)
│  MCP : 101.7 ms  (20 tool calls, 1 subprocess)
│  CLI / MCP = 8.68× wall-clock
└──────────────────────────────────────────────────────
```

MCP wall-clock includes server startup, so the number is honest for the "one execution, one agent process" case. Sustained use — many executions in one agent process — would amortize the startup further. The test asserts only that both passes reach `{ status: "done" }`; the numbers are observational.

## Limitations and design decisions

- **STDIO transport only.** HTTP/SSE is not in scope for v1. The module is structured so a second transport can be added without touching the tool or resource registrations.
- **Poll-style only.** Tool calls drive the loop one step at a time. No subscription stream of execution events in v1.
- **No prompt surface.** The execution protocol is exposed as a resource (`abtree://docs/execute`), not as an MCP prompt. The `Acknowledge_Protocol` instruct gate that the runtime emits on first `abtree_next` already primes the agent with the protocol text on every execution, so a prompt-side priming would be redundant.
- **Same trust model as the CLI.** The MCP server has the same access the agent's shell would: it can read/write `$LOCAL`, create executions, reset them. MCP clients that render confirmation prompts on `destructiveHint: true` tools will surface that distinction to the user; agent harnesses that skip confirmation should ensure their human-in-the-loop posture is appropriate for the workflow.

## Reference

- Source: `packages/cli/src/mcp/{server,tools,resources}.ts`.
- Functional tests: `packages/cli/tests/mcp.test.ts` (uses `InMemoryTransport`).
- Bench: `packages/cli/tests/mcp-bench.test.ts` (uses a real `StdioClientTransport` subprocess — that's the cost being measured).
