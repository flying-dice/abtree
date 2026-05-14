/**
 * AgentHarness — a small testing DSL that reads the way an agent
 * actually drives an abtree execution.
 *
 * The vocabulary mirrors the abtree CLI surface so a scenario reads like
 * a scripted agent–runtime dialogue rather than a table of step
 * configurations.
 *
 * @remarks
 *
 * **Three vocabularies** map directly onto the CLI:
 *
 * | Concept | Helper | CLI equivalent |
 * | --- | --- | --- |
 * | Step matcher (runtime → agent) | {@link instruct}`(name)` | response shape from `abtree next` |
 * | Step matcher (runtime → agent) | {@link evaluate}`(name)` | response shape from `abtree next` |
 * | Agent action (agent → runtime) | {@link submit}`(status)` | `abtree submit <id> <status>` |
 * | Agent action (agent → runtime) | {@link eval}`(result)` | `abtree eval <id> <true\|false>` |
 * | Agent action (agent → runtime) | {@link localWrite}`(path, value)` | `abtree local write <id> <path> <val>` |
 *
 * Each scenario step reads as: "when the runtime asks me to do X, the
 * agent responds with Y." The terminal action in every `.respond(...)`
 * chain is either {@link submit} or {@link eval} — that's what advances
 * the cursor.
 *
 * @example
 * Basic scenario:
 * ```ts
 * import {
 *   AgentHarness, CliTransport, setupTreePackageFixture,
 *   instruct, evaluate, submit, eval as evalAs, localWrite,
 * } from "@abtree/testing";
 *
 * const fixture = setupTreePackageFixture({ slug: "my-tree", treeDir: TREE });
 * const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
 *
 * try {
 *   await agent.start(fixture.treePath, "scenario");
 *
 *   await agent.when(instruct("Acknowledge_Protocol"))
 *     .respond(submit("success"));
 *
 *   await agent.when(instruct("Write_Counter"))
 *     .respond(localWrite("counter", 1), submit("success"));
 *
 *   await agent.when(evaluate("Verify_Counter"))
 *     .respond(evalAs(true));
 *
 *   await agent.expectDone();
 *   await agent.expectLocal({ counter: 1 });
 * } finally {
 *   await agent.close();
 *   fixture.cleanup();
 * }
 * ```
 *
 * @packageDocumentation
 */

import { deepEqual } from "node:assert/strict";

// ─── Transport ───────────────────────────────────────────────────────────

/**
 * Shape of the value returned by an {@link Transport.next} call.
 *
 * Mirrors the JSON the abtree CLI emits from `abtree next`:
 *
 * - `{ type: "instruct" }` — the runtime is asking the agent to perform
 *   the instruction at `instruction`.
 * - `{ type: "evaluate" }` — the runtime is asking the agent to evaluate
 *   the boolean expression at `expression`.
 * - `{ status: "done" }` — the tree completed successfully.
 * - `{ status: "failure" }` — the tree failed.
 */
export type NextResponse =
	| { type: "instruct"; name: string; instruction: string }
	| { type: "evaluate"; name: string; expression: string }
	| { status: "done" }
	| { status: "failure" };

/**
 * Abstraction over the wire that drives an abtree execution.
 *
 * Two reference implementations ship with this package — {@link
 * CliTransport} (per-step subprocess spawn) and {@link McpTransport}
 * (one server process driven via MCP tool calls). Custom transports
 * over HTTP, IPC, or another protocol can be added by implementing
 * this interface; existing scenarios run unchanged against any
 * conforming implementation.
 *
 * Every method maps directly onto a CLI verb. Implementations are
 * responsible for serialising the request, dispatching it to the
 * runtime, and parsing the response — the harness itself never touches
 * the wire format.
 *
 * @remarks
 * - `createExecution` is invoked once per scenario.
 * - `next`, `submit`, `eval`, `localRead`, `localWrite`, `globalRead`
 *   are invoked per step.
 * - `close` is invoked exactly once at scenario teardown.
 */
export interface Transport {
	/**
	 * Create a new execution against the tree file at the given path.
	 *
	 * @param tree - Absolute or cwd-relative path to a `.json`/`.yaml`/`.yml`
	 *   tree file.
	 * @param summary - Short summary; appears in the execution ID prefix.
	 * @returns The newly created execution's `id`.
	 */
	createExecution(tree: string, summary: string): Promise<{ id: string }>;

	/**
	 * Ask the runtime for the next step.
	 *
	 * @param id - Execution ID returned by {@link createExecution}.
	 * @returns A {@link NextResponse} — an `instruct`, `evaluate`, or
	 *   terminal `done`/`failure`.
	 */
	next(id: string): Promise<NextResponse>;

	/**
	 * Submit the outcome of an `instruct` step.
	 *
	 * @param id - Execution ID.
	 * @param status - `"success"` advances the cursor; `"failure"` fails
	 *   the action; `"running"` keeps the cursor in place (for
	 *   long-running external work).
	 */
	submit(
		id: string,
		status: "success" | "failure" | "running",
	): Promise<unknown>;

	/**
	 * Submit the outcome of an `evaluate` step.
	 *
	 * @param id - Execution ID.
	 * @param result - `true` advances to the next step; `false` fails the
	 *   action.
	 */
	eval(id: string, result: boolean): Promise<unknown>;

	/**
	 * Read from `$LOCAL`. Omit `path` to read the whole scope; supply
	 * `path` to read one slot.
	 *
	 * @param id - Execution ID.
	 * @param path - Optional dotted path inside `$LOCAL`.
	 */
	localRead(id: string, path?: string): Promise<unknown>;

	/**
	 * Write a value to `$LOCAL`. Values are JSON-parsed by the runtime
	 * with a string-literal fallback.
	 *
	 * @param id - Execution ID.
	 * @param path - Dotted path inside `$LOCAL`.
	 * @param value - JSON-encoded value (callers typically use
	 *   {@link localWrite}, which handles encoding).
	 */
	localWrite(id: string, path: string, value: string): Promise<unknown>;

	/**
	 * Read from `$GLOBAL`. Omit `path` to read the whole scope.
	 *
	 * @param id - Execution ID.
	 * @param path - Optional dotted path inside `$GLOBAL`.
	 */
	globalRead(id: string, path?: string): Promise<unknown>;

	/**
	 * Tear the transport down. Invoked once at scenario teardown.
	 * Implementations should release any sockets / subprocesses /
	 * handles they hold.
	 */
	close(): Promise<void>;
}

// ─── Step matchers (runtime → agent) ─────────────────────────────────────

/**
 * Tagged shape produced by {@link instruct} / {@link evaluate}. Carried
 * by {@link AgentHarness.when} into the {@link ThenBuilder} so the
 * harness knows what to assert against the next `next` response.
 */
export type StepMatcher =
	| { type: "instruct"; name: string }
	| { type: "evaluate"; name: string };

/**
 * Build a matcher that expects the next runtime step to be an
 * `instruct` with the given name.
 *
 * @example
 * ```ts
 * await agent.when(instruct("Write_Counter"))
 *   .respond(localWrite("counter", 1), submit("success"));
 * ```
 *
 * @param name - The expected step name. Must match the action / step
 *   name in the underlying tree exactly.
 * @returns A {@link StepMatcher} for use with
 *   {@link AgentHarness.when}.
 */
export function instruct(name: string): StepMatcher {
	return { type: "instruct", name };
}

/**
 * Build a matcher that expects the next runtime step to be an
 * `evaluate` with the given name.
 *
 * @example
 * ```ts
 * await agent.when(evaluate("Verify_Counter"))
 *   .respond(evalAs(true));
 * ```
 *
 * @param name - The expected step name. Must match the action / step
 *   name in the underlying tree exactly.
 * @returns A {@link StepMatcher} for use with
 *   {@link AgentHarness.when}.
 */
export function evaluate(name: string): StepMatcher {
	return { type: "evaluate", name };
}

// ─── Agent actions (agent → runtime) ─────────────────────────────────────

/**
 * Tagged union representing one action the agent performs in response
 * to a runtime step. Produced by {@link submit}, {@link eval}, and
 * {@link localWrite}, then handed to {@link ThenBuilder.respond}.
 *
 * - `{ kind: "submit" }` — terminal. Calls the transport's `submit`.
 * - `{ kind: "eval" }` — terminal. Calls the transport's `eval`.
 * - `{ kind: "localWrite" }` — pre-terminal. Calls `localWrite` then
 *   continues to the next action.
 */
export type Action =
	| { kind: "submit"; status: "success" | "failure" | "running" }
	| { kind: "eval"; result: boolean }
	| { kind: "localWrite"; path: string; value: string };

/**
 * Build a terminal `submit` action.
 *
 * Equivalent to running `abtree submit <id> <status>` on the CLI.
 * One `submit` is required as the **last** action in every
 * `.respond(...)` chain that matches an `instruct` step.
 *
 * @example
 * ```ts
 * await agent.when(instruct("Determine_Time"))
 *   .respond(localWrite("time_of_day", "morning"), submit("success"));
 * ```
 *
 * @param status - `"success"` advances the cursor; `"failure"` fails
 *   the action; `"running"` keeps the cursor in place for external
 *   work.
 */
export function submit(status: "success" | "failure" | "running"): Action {
	return { kind: "submit", status };
}

/**
 * Internal name for the {@link eval} export — JavaScript reserves
 * `eval` as a binding in strict-mode locals, so the function is
 * declared as `eval_` and re-exported below under the canonical name.
 *
 * @internal
 */
function eval_(result: boolean): Action {
	return { kind: "eval", result };
}

export {
	/**
	 * Build a terminal `eval` action.
	 *
	 * Equivalent to running `abtree eval <id> <true|false>` on the CLI.
	 * One `eval` is required as the **last** action in every
	 * `.respond(...)` chain that matches an `evaluate` step.
	 *
	 * @example
	 * ```ts
	 * await agent.when(evaluate("Verify_Counter"))
	 *   .respond(eval(true));
	 * ```
	 *
	 * @param result - `true` advances the cursor to the next step;
	 *   `false` fails the action and lets the parent composite handle
	 *   the failure (e.g. a selector advancing to its next child).
	 */
	eval_ as eval,
};

/**
 * Build a pre-terminal `localWrite` action.
 *
 * Writes a JSON-encoded value to `$LOCAL.<path>`. Values are stringified
 * here and JSON-parsed on the runtime side; strings, numbers, booleans,
 * arrays, and plain objects all round-trip correctly.
 *
 * Equivalent to running `abtree local write <id> <path> <val>` on the
 * CLI. `localWrite` is **not** terminal — every `.respond(...)` chain
 * that uses it must still end with a {@link submit} or {@link eval}.
 *
 * @example
 * ```ts
 * await agent.when(instruct("Set_Up_Counters"))
 *   .respond(
 *     localWrite("counter_a", 1),
 *     localWrite("counter_b", { initial: 0 }),
 *     submit("success"),
 *   );
 * ```
 *
 * @param path - Dotted path inside `$LOCAL` (e.g. `"counter"`,
 *   `"workspace.name"`).
 * @param value - Any JSON-serialisable value. Strings, numbers,
 *   booleans, and plain objects all round-trip correctly via
 *   `JSON.stringify` → CLI → `JSON.parse`.
 */
export function localWrite(path: string, value: unknown): Action {
	return {
		kind: "localWrite",
		path,
		value: JSON.stringify(value),
	};
}

// ─── ThenBuilder ─────────────────────────────────────────────────────────

/**
 * Fluent builder returned by {@link AgentHarness.when}. The only
 * method, {@link ThenBuilder.respond}, asserts the matcher against the
 * runtime's next response and then performs the listed actions in
 * order.
 *
 * Constructed only by the harness — callers don't instantiate it
 * directly.
 */
class ThenBuilder {
	constructor(
		private readonly harness: AgentHarness,
		private readonly matcher: StepMatcher,
	) {}

	/**
	 * Assert + respond. Fetches the next runtime step via the harness's
	 * transport, asserts it matches the {@link StepMatcher} carried in,
	 * and then dispatches each action in turn through the same transport.
	 *
	 * @example
	 * ```ts
	 * await agent.when(instruct("Determine_Time"))
	 *   .respond(localWrite("time_of_day", "morning"), submit("success"));
	 * ```
	 *
	 * @param actions - One or more {@link Action}s in dispatch order.
	 *   Exactly one must be a terminal action ({@link submit} or
	 *   {@link eval}) and it must be last in the list. Pre-terminal
	 *   actions ({@link localWrite}) run before the terminal.
	 *
	 * @throws If the next runtime step's `type` or `name` does not match
	 *   the matcher.
	 * @throws If no terminal action is supplied.
	 * @throws If the terminal action is not the last in the list.
	 */
	async respond(...actions: Action[]): Promise<void> {
		const response = await this.harness.__next();
		assertMatch(response, this.matcher);

		const terminalIdx = actions.findIndex(
			(a) => a.kind === "submit" || a.kind === "eval",
		);
		if (terminalIdx === -1) {
			throw new Error(
				`when(${describe(this.matcher)}).respond(...) requires one terminal action — submit() or eval() — and got none`,
			);
		}
		if (terminalIdx !== actions.length - 1) {
			throw new Error(
				`when(${describe(this.matcher)}).respond(...) terminal action submit/eval must be last; got ${actions
					.slice(terminalIdx + 1)
					.map((a) => a.kind)
					.join(", ")} after it`,
			);
		}

		for (const a of actions) {
			await this.harness.__perform(a);
		}
	}
}

function describe(m: StepMatcher): string {
	return `${m.type}("${m.name}")`;
}

function assertMatch(response: NextResponse, matcher: StepMatcher): void {
	if (!("type" in response) || response.type !== matcher.type) {
		throw new Error(
			`expected ${describe(matcher)}; got ${JSON.stringify(response)}`,
		);
	}
	if (response.name !== matcher.name) {
		throw new Error(
			`expected ${describe(matcher)}; got ${response.type}("${response.name}")`,
		);
	}
}

// ─── AgentHarness ────────────────────────────────────────────────────────

/**
 * Drives an abtree execution end-to-end through a {@link Transport}.
 *
 * The harness is **transport-agnostic**: pass {@link CliTransport},
 * {@link McpTransport}, or any custom {@link Transport} implementation;
 * the scenario script runs unchanged against any of them.
 *
 * Lifecycle: construct, {@link start}, run `.when(...).respond(...)`
 * pairs for each step, optionally call {@link expectDone} and
 * {@link expectLocal}, finally {@link close}. The fixture (an isolated
 * directory holding the tree file you point `start(...)` at) is managed
 * independently — the harness only owns the execution and the transport,
 * not the on-disk layout the transport reads from.
 *
 * @example
 * ```ts
 * const fixture = setupTreePackageFixture({ slug: "my-tree", treeDir });
 * const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
 * try {
 *   await agent.start(fixture.treePath, "scenario");
 *   await agent.when(instruct("X")).respond(submit("success"));
 *   await agent.expectDone();
 * } finally {
 *   await agent.close();
 *   fixture.cleanup();
 * }
 * ```
 */
export class AgentHarness {
	private executionId: string | null = null;

	/**
	 * @param transport - The transport that will service every verb on
	 *   this harness. Typically {@link CliTransport} or
	 *   {@link McpTransport}.
	 */
	constructor(private readonly transport: Transport) {}

	/**
	 * Create the execution. Must be called exactly once, before any
	 * {@link when} / {@link localRead} / {@link globalRead} /
	 * {@link expectDone} / {@link expectLocal} call.
	 *
	 * @param tree - Absolute or cwd-relative path to a `.json`/`.yaml`/`.yml`
	 *   tree file. Typically the `treePath` returned by
	 *   {@link setupTreePackageFixture}.
	 * @param summary - Short summary; appears in the generated execution
	 *   ID prefix.
	 */
	async start(tree: string, summary: string): Promise<void> {
		const { id } = await this.transport.createExecution(tree, summary);
		this.executionId = id;
	}

	/**
	 * Stage a `when(matcher) → respond(actions)` pair. Returns a
	 * {@link ThenBuilder} the caller chains `.respond(...)` onto.
	 *
	 * @example
	 * ```ts
	 * await agent.when(instruct("Write_Counter"))
	 *   .respond(localWrite("counter", 1), submit("success"));
	 * ```
	 *
	 * @param matcher - Produced by {@link instruct} or {@link evaluate}.
	 */
	when(matcher: StepMatcher): ThenBuilder {
		return new ThenBuilder(this, matcher);
	}

	/**
	 * Read from `$LOCAL`. Mirrors `abtree local read <id> [path]`.
	 *
	 * @param path - Optional dotted path. Omit to read the whole scope.
	 * @returns The current value at `path` (or the whole scope).
	 */
	async localRead(path?: string): Promise<unknown> {
		return this.transport.localRead(this.requireId(), path);
	}

	/**
	 * Read from `$GLOBAL`. Mirrors `abtree global read <id> [path]`.
	 *
	 * @param path - Optional dotted path. Omit to read the whole scope.
	 * @returns The current value at `path` (or the whole scope).
	 */
	async globalRead(path?: string): Promise<unknown> {
		return this.transport.globalRead(this.requireId(), path);
	}

	/**
	 * Assert that the next runtime step is `{ status: "done" }`.
	 *
	 * Typically the final call of a scenario before {@link expectLocal}
	 * and {@link close}.
	 *
	 * @throws If the next step is anything other than a `done` terminal.
	 */
	async expectDone(): Promise<void> {
		const response = await this.__next();
		if (!("status" in response) || response.status !== "done") {
			throw new Error(
				`expected { status: "done" }; got ${JSON.stringify(response)}`,
			);
		}
	}

	/**
	 * Assert that each named slot in `$LOCAL` deep-equals the expected
	 * value.
	 *
	 * Only the slots named in `expected` are checked; extra slots in
	 * `$LOCAL` are ignored. Uses `node:assert/strict`'s `deepEqual`
	 * under the hood.
	 *
	 * @example
	 * ```ts
	 * await agent.expectLocal({
	 *   counter: 2,
	 *   greeting: "hello",
	 *   workspace: { name: "X", initial: 0 },
	 * });
	 * ```
	 *
	 * @param expected - Slots to assert. Each value is compared via
	 *   `deepEqual` against the live `$LOCAL.<key>` value.
	 *
	 * @throws If any slot's actual value does not deep-equal the
	 *   expected value.
	 */
	async expectLocal(expected: Record<string, unknown>): Promise<void> {
		const actual = (await this.localRead()) as Record<string, unknown>;
		for (const [k, v] of Object.entries(expected)) {
			try {
				deepEqual(actual[k], v);
			} catch {
				throw new Error(
					`expected $LOCAL.${k} = ${JSON.stringify(v)}; got ${JSON.stringify(actual[k])}`,
				);
			}
		}
	}

	/**
	 * Tear down the transport. Should be called exactly once, in a
	 * `finally` block so it runs even on scenario failure.
	 */
	async close(): Promise<void> {
		await this.transport.close();
	}

	/**
	 * Internal — called by {@link ThenBuilder.respond} to fetch the next
	 * step. Underscored to discourage scenario authors from polling
	 * directly (they should use {@link when}).
	 *
	 * @internal
	 */
	async __next(): Promise<NextResponse> {
		return this.transport.next(this.requireId());
	}

	/**
	 * Internal — called by {@link ThenBuilder.respond} to dispatch one
	 * agent action via the transport.
	 *
	 * @internal
	 */
	async __perform(action: Action): Promise<void> {
		const id = this.requireId();
		switch (action.kind) {
			case "submit":
				await this.transport.submit(id, action.status);
				return;
			case "eval":
				await this.transport.eval(id, action.result);
				return;
			case "localWrite":
				await this.transport.localWrite(id, action.path, action.value);
				return;
		}
	}

	private requireId(): string {
		if (this.executionId === null) {
			throw new Error("AgentHarness.start(...) must be called first");
		}
		return this.executionId;
	}
}
