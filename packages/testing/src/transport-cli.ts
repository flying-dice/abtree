/**
 * {@link Transport} implementation that drives an abtree execution via
 * **per-step subprocess spawns** of the abtree CLI.
 *
 * Tree-agnostic: the caller supplies a `cwd` (a directory whose
 * `.abtree/` layout is already prepared by
 * {@link setupTreePackageFixture}) and optionally overrides the launch
 * command. Defaults assume the `abtree` binary is on `PATH`; for
 * checkout-local invocation pass `command: "bun"` and `args: ["packages/cli/index.ts"]`.
 *
 * Each transport call is independent — `CliTransport` holds no
 * long-running state (no open sockets, no child processes). `close()`
 * is a no-op; fixture cleanup is the caller's responsibility.
 *
 * @packageDocumentation
 */

import type { NextResponse, Transport } from "./harness.ts";

/**
 * Configuration for {@link CliTransport}.
 */
export interface CliTransportOptions {
	/**
	 * Working directory the subprocess inherits. The abtree runtime
	 * resolves `.abtree/executions/` and `.abtree/snapshots/` relative
	 * to this path (tree files are resolved against the path you pass
	 * to `agent.start(...)`).
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
	 * Args to prepend before the abtree subcommand. Useful when
	 * invoking via a runtime that wraps the CLI source — e.g.
	 * `["packages/cli/index.ts"]` for `bun packages/cli/index.ts <verb>`.
	 *
	 * Per-step CLI args (`<verb> <verb-args>`) are appended automatically.
	 *
	 * @defaultValue `[]`
	 */
	args?: string[];
}

/**
 * {@link Transport} that shells out to the abtree CLI once per verb.
 *
 * Mirrors the current human-driven workflow: each scenario step
 * results in a fresh `Bun.spawnSync(["<command>", ...args, "<verb>", ...])`
 * invocation, captures stdout, and JSON-parses the response.
 *
 * @remarks
 * - **Slower than {@link McpTransport}** (~8× by the bundled bench) due
 *   to the per-step subprocess startup tax. Useful when you want to
 *   exercise the exact code path a human-driven CLI flow runs through.
 * - **Stateless** — every spawn is independent, so a misbehaving step
 *   can't leak state into the next.
 *
 * @example
 * Using the installed `abtree` binary:
 * ```ts
 * const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
 * ```
 *
 * @example
 * Using a checkout-local CLI source via `bun`:
 * ```ts
 * const agent = new AgentHarness(new CliTransport({
 *   cwd: fixture.cwd,
 *   command: "bun",
 *   args: ["packages/cli/index.ts"],
 * }));
 * ```
 */
export class CliTransport implements Transport {
	private readonly cwd: string;
	private readonly command: string;
	private readonly baseArgs: string[];

	/**
	 * @param opts - See {@link CliTransportOptions}.
	 */
	constructor(opts: CliTransportOptions) {
		this.cwd = opts.cwd;
		this.command = opts.command ?? "abtree";
		this.baseArgs = opts.args ?? [];
	}

	/** @inheritDoc */
	async createExecution(
		tree: string,
		summary: string,
	): Promise<{ id: string }> {
		return this.spawn(["execution", "create", tree, summary]) as Promise<{
			id: string;
		}>;
	}

	/** @inheritDoc */
	async next(id: string): Promise<NextResponse> {
		return this.spawn(["next", id]) as Promise<NextResponse>;
	}

	/** @inheritDoc */
	async submit(
		id: string,
		status: "success" | "failure" | "running",
	): Promise<unknown> {
		return this.spawn(["submit", id, status]);
	}

	/** @inheritDoc */
	async eval(id: string, result: boolean): Promise<unknown> {
		return this.spawn(["eval", id, String(result)]);
	}

	/** @inheritDoc */
	async localRead(id: string, path?: string): Promise<unknown> {
		const args = ["local", "read", id];
		if (path) args.push(path);
		return this.spawn(args);
	}

	/** @inheritDoc */
	async localWrite(id: string, path: string, value: string): Promise<unknown> {
		return this.spawn(["local", "write", id, path, value]);
	}

	/** @inheritDoc */
	async globalRead(id: string, path?: string): Promise<unknown> {
		const args = ["global", "read", id];
		if (path) args.push(path);
		return this.spawn(args);
	}

	/**
	 * No-op — `CliTransport` is stateless. Fixture cleanup (removing
	 * the temp directory) is the caller's responsibility, typically via
	 * the `cleanup()` callback returned by
	 * {@link setupTreePackageFixture}.
	 */
	async close(): Promise<void> {
		// Stateless — nothing to tear down.
	}

	private spawn(verbArgs: string[]): Promise<unknown> {
		const r = Bun.spawnSync([this.command, ...this.baseArgs, ...verbArgs], {
			cwd: this.cwd,
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = new TextDecoder().decode(r.stdout).trim();
		const stderr = new TextDecoder().decode(r.stderr).trim();
		if ((r.exitCode ?? 0) !== 0) {
			return Promise.reject(
				new Error(
					`${this.command} ${[...this.baseArgs, ...verbArgs].join(" ")} failed: ${stderr || stdout}`,
				),
			);
		}
		try {
			return Promise.resolve(JSON.parse(stdout));
		} catch {
			return Promise.resolve(stdout);
		}
	}
}
