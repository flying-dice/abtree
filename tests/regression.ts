// Regression scenario — written once, runs against any Transport
// the AgentHarness is built on top of. Read each line as: "when the
// runtime asks me to do X, the agent responds with Y."

import {
	type AgentHarness,
	eval as evalAs,
	evaluate,
	instruct,
	localWrite,
	submit,
} from "@abtree/testing";

const EXPECTED_FINAL_LOCAL = {
	counter: 2,
	greeting: "hello",
	delegate_output: "ok",
};

export async function runRegression(agent: AgentHarness): Promise<void> {
	// Protocol gate
	await agent.when(instruct("Acknowledge_Protocol")).respond(submit("success"));

	// Case A — local state round-trip
	await agent
		.when(instruct("Write_Counter"))
		.respond(localWrite("counter", 1), submit("success"));
	await agent.when(evaluate("Verify_Counter")).respond(evalAs(true));
	await agent
		.when(instruct("Write_Greeting"))
		.respond(localWrite("greeting", "hello"), submit("success"));
	await agent.when(evaluate("Verify_Greeting")).respond(evalAs(true));

	// Case B — selector falls through to recovery
	await agent.when(evaluate("Always_Fail")).respond(evalAs(false));
	await agent
		.when(instruct("Recovery"))
		.respond(localWrite("counter", 2), submit("success"));
	await agent.when(evaluate("Verify_Recovery")).respond(evalAs(true));

	// Case C — $GLOBAL read
	await agent.when(evaluate("Verify_Global_Default")).respond(evalAs(true));

	// Case D — delegate scope, walked end-to-end by the driver
	await agent
		.when(instruct("Spawn_Delegate_Round_Trip"))
		.respond(submit("success"));
	await agent
		.when(instruct("Inner_Work"))
		.respond(localWrite("delegate_output", "ok"), submit("success"));
	await agent
		.when(evaluate("Return_To_Parent_Delegate_Round_Trip"))
		.respond(evalAs(true));
	await agent
		.when(instruct("Return_To_Parent_Delegate_Round_Trip"))
		.respond(submit("success"));

	// Final state
	await agent.expectDone();
	await agent.expectLocal(EXPECTED_FINAL_LOCAL);
}
