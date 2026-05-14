/**
 * Test harness for driving [abtree](https://abtree.sh) executions
 * deterministically. The vocabulary mirrors the abtree CLI; a scenario
 * reads like a scripted agent–runtime dialogue.
 *
 * @remarks
 *
 * The public surface is intentionally small:
 *
 * - {@link AgentHarness} — the entry point. Wraps a {@link Transport}
 *   and exposes the `.when(...).respond(...)` DSL.
 * - {@link Transport} — abstraction over the wire. Two reference
 *   implementations ship in this package: {@link CliTransport} and
 *   {@link McpTransport}. Custom implementations plug in unchanged.
 * - Step matchers — {@link instruct}, {@link evaluate}. Used inside
 *   `agent.when(...)` to assert against the next runtime step.
 * - Agent actions — {@link submit}, {@link eval}, {@link localWrite}.
 *   Used inside `.respond(...)` to dispatch the agent's response.
 * - {@link setupTreePackageFixture} — `mkdtemp`s an isolated `.abtree/`
 *   workspace for one scenario, returns `{ cwd, cleanup }`.
 *
 * @example
 * End-to-end scenario:
 * ```ts
 * import {
 *   AgentHarness, CliTransport, setupTreePackageFixture,
 *   instruct, evaluate, submit, eval as evalAs, localWrite,
 * } from "@abtree/testing";
 *
 * const fixture = setupTreePackageFixture({
 *   slug: "my-tree",
 *   treeDir: "/abs/path/to/my-tree",
 * });
 *
 * const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
 * try {
 *   await agent.start("my-tree", "scenario");
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

export {
	setupTreePackageFixture,
	type TreePackageFixture,
	type TreePackageFixtureOptions,
} from "./fixture.ts";
export {
	type Action,
	AgentHarness,
	eval,
	evaluate,
	instruct,
	localWrite,
	type NextResponse,
	type StepMatcher,
	submit,
	type Transport,
} from "./harness.ts";
export { CliTransport, type CliTransportOptions } from "./transport-cli.ts";
export { McpTransport, type McpTransportOptions } from "./transport-mcp.ts";
