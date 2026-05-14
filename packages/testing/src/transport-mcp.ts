/**
 * {@link Transport} implementation that drives an abtree execution via
 * the `abtree mcp` server over **stdio + MCP tool calls**.
 *
 * Tree-agnostic: the caller supplies a `cwd` (a directory whose
 * `.abtree/` layout is already prepared by
 * {@link setupTreePackageFixture}) and optionally overrides the launch
 * command. Defaults assume the `abtree` binary is on `PATH`.
 *
 * The MCP server subprocess is spawned **once** (lazily, on the first
 * verb), then every subsequent transport call becomes one MCP tool
 * invocation over the same stdio connection. Compared to
 * {@link CliTransport}, this saves the per-step subprocess startup tax
 * — the bundled bench measures roughly 8× wall-clock improvement for
 * end-to-end scenarios.
 *
 * @packageDocumentation
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { NextResponse, Transport } from "./harness.ts";

/**
 * Configuration for {@link McpTransport}.
 */
export interface McpTransportOptions {
	/**
	 * Working directory the spawned MCP server process inherits. The
	 * abtree runtime resolves `.abtree/executions/`,
	 * `.abtree/snapshots/`, and slug-based tree lookups relative to
	 * this path.
	 *
	 * Typically the `cwd` returned by {@link setupTreePackageFixture}.
	 */
	cwd: string;

	/**
	 * Executable to invoke. Defaults to `"abtree"` (assumes the
	 * installed binary is on `PATH`). Override to point at a different
	 * launcher — e.g. `"bun"` when invoking via a TypeScript source
	 * file.
	 *
	 * @defaultValue `"abtree"`
	 */
	command?: string;

	/**
	 * Args to prepend before the `mcp` subcommand. Useful when invoking
	 * via a runtime that wraps the CLI source — e.g.
	 * `["packages/cli/index.ts"]` for `bun packages/cli/index.ts mcp`.
	 *
	 * The literal `"mcp"` is appended automatically.
	 *
	 * @defaultValue `[]`
	 */
	args?: string[];

	/**
	 * Client name announced to the MCP server during handshake.
	 *
	 * @defaultValue `"abtree-harness"`
	 */
	clientName?: string;

	/**
	 * Client version announced to the MCP server during handshake.
	 *
	 * @defaultValue `"0.0.0"`
	 */
	clientVersion?: string;
}

/**
 * {@link Transport} that drives the abtree MCP server.
 *
 * Spawns one `<command> <...args> mcp` subprocess lazily on the first
 * verb, then maps each subsequent transport call to one MCP tool
 * invocation over the same stdio stream. Tool results carry
 * `structuredContent` per MCP spec ≥ 2025-06, which the transport
 * returns directly to the harness.
 *
 * @remarks
 * - **Faster than {@link CliTransport}** (~8× by the bundled bench)
 *   because the subprocess startup is paid once rather than per step.
 * - **Stateful** — the underlying MCP client + child process persist
 *   between verbs. {@link close} is mandatory to release them.
 * - **Error translation** — tool calls that come back with
 *   `isError: true` are turned into thrown JS errors so the harness's
 *   assertion paths surface them naturally.
 *
 * @example
 * Using the installed `abtree` binary:
 * ```ts
 * const agent = new AgentHarness(new McpTransport({ cwd: fixture.cwd }));
 * try {
 *   await agent.start(fixture.treePath, "scenario");
 *   // ...
 * } finally {
 *   await agent.close();   // tears down the MCP client + child
 * }
 * ```
 *
 * @example
 * Using a checkout-local CLI source via `bun`:
 * ```ts
 * const agent = new AgentHarness(new McpTransport({
 *   cwd: fixture.cwd,
 *   command: "bun",
 *   args: ["packages/cli/index.ts"],
 * }));
 * ```
 */
export class McpTransport implements Transport {
	private readonly opts: McpTransportOptions;
	private readonly client: Client;
	private connected = false;

	/**
	 * @param opts - See {@link McpTransportOptions}.
	 */
	constructor(opts: McpTransportOptions) {
		this.opts = opts;
		this.client = new Client({
			name: opts.clientName ?? "abtree-harness",
			version: opts.clientVersion ?? "0.0.0",
		});
	}

	/**
	 * Lazily spawn the MCP server subprocess + connect the client.
	 * No-op after the first call.
	 */
	private async ensureConnected(): Promise<void> {
		if (this.connected) return;
		const transport = new StdioClientTransport({
			command: this.opts.command ?? "abtree",
			args: [...(this.opts.args ?? []), "mcp"],
			cwd: this.opts.cwd,
		});
		await this.client.connect(transport);
		this.connected = true;
	}

	/** @inheritDoc */
	async createExecution(
		tree: string,
		summary: string,
	): Promise<{ id: string }> {
		return this.call("abtree_execution_create", { tree, summary }) as Promise<{
			id: string;
		}>;
	}

	/** @inheritDoc */
	async next(id: string): Promise<NextResponse> {
		return this.call("abtree_next", { execution: id }) as Promise<NextResponse>;
	}

	/** @inheritDoc */
	async submit(
		id: string,
		status: "success" | "failure" | "running",
	): Promise<unknown> {
		return this.call("abtree_submit", { execution: id, status });
	}

	/** @inheritDoc */
	async eval(id: string, result: boolean): Promise<unknown> {
		return this.call("abtree_eval", { execution: id, result });
	}

	/** @inheritDoc */
	async localRead(id: string, path?: string): Promise<unknown> {
		const args: Record<string, unknown> = { execution: id };
		if (path) args.path = path;
		return this.call("abtree_local_read", args);
	}

	/** @inheritDoc */
	async localWrite(id: string, path: string, value: string): Promise<unknown> {
		return this.call("abtree_local_write", { execution: id, path, value });
	}

	/** @inheritDoc */
	async globalRead(id: string, path?: string): Promise<unknown> {
		const args: Record<string, unknown> = { execution: id };
		if (path) args.path = path;
		return this.call("abtree_global_read", args);
	}

	/**
	 * Close the MCP client connection. Sends a graceful shutdown to the
	 * server subprocess. Idempotent — safe to call if `start` was never
	 * called (no connection ever opened).
	 */
	async close(): Promise<void> {
		if (this.connected) await this.client.close();
	}

	private async call(
		name: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		await this.ensureConnected();
		const r = await this.client.callTool({ name, arguments: args });
		if (r.isError) {
			const content = r.content as { type: string; text: string }[];
			throw new Error(`${name} failed: ${content[0]?.text ?? "unknown"}`);
		}
		return r.structuredContent;
	}
}
