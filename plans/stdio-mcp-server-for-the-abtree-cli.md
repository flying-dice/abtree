---
id: 1779000100-stdio-server-exposes
title: STDIO MCP server for the abtree CLI
status: refined
author: Starscream
created: 2026-05-13
reviewed_by: Starscream
---

## Summary

Add an `abtree mcp` subcommand that runs the abtree CLI surface as a Model Context Protocol (MCP) server over stdio, so agents that natively speak MCP (Claude Code, Claude Desktop, others) can drive an abtree execution through structured tool calls instead of spawning a fresh `bun packages/cli/index.ts <args>` subprocess per `next/eval/submit`. The existing commander-based CLI remains the canonical surface; MCP is additive and shares the same underlying repository / runtime code paths. A small comparison harness runs inside `bun test` so the efficiency hypothesis (less per-step subprocess tax, structured I/O instead of stdout-parsing) is measured rather than assumed.

## Requirements

- New subcommand `abtree mcp` that starts an MCP server using the `@modelcontextprotocol/sdk` STDIO transport. The process stays alive on stdin/stdout until the client disconnects; nothing is written to stderr except fatal startup errors. The subcommand takes no positional args; `--help` describes the subcommand (the tool/resource catalogue lives in the docs guide, not in `--help` output).
- One MCP tool per existing CLI verb, named with the `abtree_` prefix in snake_case so it is unambiguous in a multi-server agent context. Mapping (CLI → tool):
  - `abtree next <execution>` → `abtree_next({ execution })`
  - `abtree eval <execution> <result>` → `abtree_eval({ execution, result })`
  - `abtree submit <execution> <status>` → `abtree_submit({ execution, status })`
  - `abtree local read <execution> [path]` → `abtree_local_read({ execution, path? })`
  - `abtree local write <execution> <path> <value>` → `abtree_local_write({ execution, path, value })`
  - `abtree global read <execution> [path]` → `abtree_global_read({ execution, path? })`
  - `abtree execution create <tree> <summary>` → `abtree_execution_create({ tree, summary })`
  - `abtree execution list` → `abtree_execution_list({})`
  - `abtree execution get <id>` → `abtree_execution_get({ execution })`
  - `abtree execution reset <id>` → `abtree_execution_reset({ execution })`
- Each tool carries a one-line `description`, a `inputSchema` (JSON Schema), and `annotations` set per-tool to match MCP-spec semantics rather than a blanket value:
  - `readOnlyHint: true` on `local_read`, `global_read`, `execution_list`, `execution_get`. No other hints needed.
  - `destructiveHint: true` on `execution_reset` (overwrites prior progress) and `local_write` (overwrites existing slot). All other mutating tools (`next`, `eval`, `submit`, `execution_create`) are non-destructive (additive cursor or new-state writes), so `destructiveHint: false`.
  - `idempotentHint: true` on `local_write` (same value → same effect) and `execution_reset` (re-resetting a reset execution is a no-op). All other mutating tools are not idempotent.
- Tool results are returned as `{ content: [{ type: "text", text: "<JSON>" }], structuredContent: <object> }`. The `structuredContent` mirrors what the CLI currently prints — callers that want the raw object can read it directly and skip JSON parsing. `structuredContent` requires MCP spec ≥ 2025-06; the SDK version pin (next bullet) must satisfy that.
- Errors thrown by `core*` functions translate to MCP tool errors via `{ isError: true, content: [{ type: "text", text: "<error message>" }] }`. The same error text that the CLI's `die()` writes to stderr is what the MCP error content carries — one error vocabulary, two surfaces.
- Embedded documentation (`docs/agents/execute.md`, `docs/agents/author.md`, `tree.schema.json`, `packages/cli/src/SKILL.md`) is exposed as MCP **resources** at `abtree://docs/{execute,author,schema,skill}`. The execute doc is *not* additionally registered as an MCP prompt — `Acknowledge_Protocol` already primes the agent with the protocol text on first `abtree next`, so a prompt would be redundant.
- The underlying CLI command functions are refactored into pairs: `coreX(...)` returns a value or throws an `Error`; `cmdX(...)` is the commander wrapper that prints the returned JSON to stdout and translates errors via `die()`. MCP tool handlers consume `core*` exports directly. One source of truth, two thin presenters.
- `setMutationListener` (the Mermaid/SVG-rebuild hook the CLI registers at process start) is also registered when the MCP server starts, so writes via tool calls produce the same on-disk diagnostics as writes via the CLI.
- STDIO is the only transport in v1. The plan deliberately keeps `tools.ts` and `resources.ts` independent of the transport so a future HTTP/SSE addition can bind to the same registrations without touching either file. The server is poll-style only; no subscription stream in v1.
- Bench: `packages/cli/tests/mcp-bench.test.ts` runs hello-world end-to-end twice — once spawning `bun packages/cli/index.ts <args>` per step (the current pattern), once via an in-process MCP client driving the server over its stdio. It captures wall-clock, tool-call count, and bytes exchanged per pass, prints a two-column comparison via `console.log` (numbers land in `bun test` output), and asserts only that both passes reach `{ status: "done" }`. Numbers are observational, not a pass/fail gate.
- The `@modelcontextprotocol/sdk` version is pinned explicitly in `package.json`. The SDK is pre-1.0 and the surface has shifted; pinning protects against silent surface drift on `bun install`.

## Technical Approach

1. **Refactor `packages/cli/src/commands.ts`** — split each `cmdX` into `coreX` (returns value / throws `Error`) + `cmdX` (commander wrapper that prints JSON and translates errors via `die`). The commander surface stays byte-identical; the existing CLI integration test (`packages/cli/tests/cli.test.ts`) is the regression check.
2. **Add `@modelcontextprotocol/sdk`** to `packages/cli/package.json` dependencies with an explicit pinned version. Run `bun install`.
3. **Co-locate JSON Schemas in `packages/cli/src/parse-args.ts`** — for each existing `parseX` function, export a sibling `JSONSchema7` object describing the same shape. The parse functions remain commander predicates; the schema objects are what `tools.ts` consumes.
4. **`packages/cli/src/mcp/server.ts`** (new file) — constructs the `Server`, wires `StdioServerTransport`, registers tools from `tools.ts` and resources from `resources.ts`, exports `runMcpServer(): Promise<void>`. Registers `setMutationListener` at startup.
5. **`packages/cli/src/mcp/tools.ts`** (new file) — declarative table `{ name, description, inputSchema, annotations, handler }`. Handlers are 2–4 lines each: parse args via the existing `parse-args` validators, call the matching `core*` function, return the result as `{ content: [...], structuredContent }`.
6. **`packages/cli/src/mcp/resources.ts`** (new file) — registers four resources under `abtree://docs/`. Bodies come from the same `with { type: "text" }` imports `packages/cli/index.ts` already uses. `mimeType` is `text/markdown` for the three markdown files and `application/json` for the schema.
7. **`packages/cli/index.ts`** — register one new commander command: `program.command("mcp").description(...).action(runMcpServer)`. No other changes.
8. **`packages/cli/tests/mcp.test.ts`** (new file) — functional tests using the SDK's **`InMemoryTransport`** (paired client/server in-process, no subprocess) so the cases are fast and flake-free: `tools/list` membership and count (10 expected tool names, order not asserted); each tool's `inputSchema` deep-equals its source schema in `parse-args.ts`; `resources/list` returns four `abtree://docs/*` entries; calling `abtree_next` against a fresh hello-world execution returns the `Acknowledge_Protocol` instruct as `structuredContent`; the full hello-world walk reaches `{ status: "done" }`. Also covers the error path: a `core*` function that throws produces `{ isError: true, content: [...] }`.
9. **`packages/cli/tests/mcp-bench.test.ts`** (new file) — uses **a real subprocess** (`Bun.spawn(["bun", "<cli>", "mcp"])`) connected over its actual stdio, so the bench measures the same subprocess cost the production agent flow pays. Runs hello-world end-to-end twice (CLI-spawn-per-step vs single MCP server + tool-call-per-step), captures wall-clock, tool-call count, and bytes-on-wire per pass, prints a two-column comparison via `console.log`, and asserts only that both passes reach `{ status: "done" }`. Uses the same temp-dir + tree-copy pattern as `cli.test.ts`.
10. **`docs/guide/mcp.md`** (new file) — guide in the same voice as `delegating-to-subagents.md`. Snippets for Claude Code's `.mcp.json` and Claude Desktop's `claude_desktop_config.json`. Minimal worked example: register the server, drive hello-world end-to-end via tool calls, point at the bench output for measured efficiency. Sidebar entry in `docs/.vitepress/config.ts` under Guide, after "Delegating to subagents".

## Affected Systems

- `packages/cli/package.json` — new dependency `@modelcontextprotocol/sdk` (version-pinned).
- `packages/cli/src/commands.ts` — refactor each command into a `core*` + `cmd*` pair. No new functionality, only a structural split.
- `packages/cli/src/parse-args.ts` — export JSON Schemas alongside the existing parse functions.
- `packages/cli/src/mcp/server.ts`, `tools.ts`, `resources.ts` — new module.
- `packages/cli/index.ts` — register the `mcp` subcommand.
- `packages/cli/tests/mcp.test.ts` — new file (functional tests).
- `packages/cli/tests/mcp-bench.test.ts` — new file (observational bench, asserts only liveness).
- `docs/guide/mcp.md` — new guide page.
- `docs/.vitepress/config.ts` — sidebar entry.
- Unchanged: `packages/runtime/*`, `packages/dsl/*`, every tree under `trees/*`.

## Acceptance Criteria

- `abtree mcp` starts an STDIO MCP server. An MCP-aware test harness lists exactly 10 tools (names in the order from Requirements) and exactly 4 resources under `abtree://docs/*`.
- The full hello-world workflow can be driven end-to-end via MCP tool calls — `abtree_execution_create` through to `{ status: "done" }` — and the resulting `$LOCAL.greeting` matches what the existing CLI flow produces with the same inputs.
- The existing `packages/cli/tests/cli.test.ts` continues to pass unchanged. This is the regression check that the `core*` / `cmd*` split did not change observable CLI behaviour.
- `tools/list` returns exactly 10 tool names matching the set in Requirements (order not asserted, since the MCP SDK does not guarantee registration order).
- `resources/list` returns the four `abtree://docs/*` entries; `resources/read` for each returns body bytes equal to the source file's embedded import.
- `bun test packages/cli/tests/mcp.test.ts` passes.
- `bun test packages/cli/tests/mcp-bench.test.ts` passes (asserts liveness; the comparison table is printed for inspection, not asserted).
- `bunx biome check packages/cli` reports no new errors or warnings beyond the project baseline.

## Risks & Considerations

- **`@modelcontextprotocol/sdk` API churn.** The SDK is pre-1.0 and the surface has shifted (tool registration, resource registration, transport classes). The pinned version protects against silent breakage on `bun install`. If a breaking change ships during implementation, surface it as a follow-up rather than spreading workaround code through `tools.ts`.
- **Two surfaces, one truth.** The whole point of the `core*` / `cmd*` split is that any future change goes through `core*`. If a future refactor adds logic to a `cmd*` wrapper, the MCP surface diverges silently. Tests on the `core*` exports + the byte-identical-stdout regression check on `cli.test.ts` keep this honest.
- **Side-effect tools and client confirmation rendering.** MCP clients may show `destructiveHint: false` tools with extra confirmation. `abtree_submit`, `abtree_eval`, `abtree_local_write`, `abtree_execution_create`, `abtree_execution_reset`, `abtree_next` (which mutates the cursor) are all flagged. Plays nicely with the human-in-the-loop model abtree already expects.
- **Bench interpretation.** The bench measures one tree on one machine over one transport. Numbers are directionally useful, not authoritative SLAs. The acceptance criteria explicitly do not assert thresholds — if the numbers come out a wash, both surfaces stay; if MCP wins materially, the guide can recommend it.
- **Embedded resources vs filesystem reads.** Exposing docs as MCP resources duplicates content the agent could fetch from disk. The win is that sandboxed agents (no filesystem access) can still read the protocol. Cost is the bytes on the wire when a client lists resources. Acceptable.
- **No HTTP/SSE transport, no subscription stream in v1.** STDIO + poll-style only. The modules are arranged so an HTTP transport could be added without touching `tools.ts`/`resources.ts`; subscriptions are a more invasive change and tracked separately if wanted.
- **Project memory: no backwards compatibility.** abtree is pre-release; the `core*` / `cmd*` split is internal to `@abtree/cli` and not part of any user-facing contract. No migration shim required.

## Open Questions

(none — all prior open questions resolved into committed decisions: bench runs as part of `bun test`; server is poll-style with no subscription stream; the execute doc is a resource only, not an MCP prompt.)
