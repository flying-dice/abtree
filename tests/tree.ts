// Regression suite tree. Each child of the root sequence exercises a
// specific runtime behaviour. The companion driver scripts
// (`scripts/run-cli.ts`, `scripts/run-mcp.ts`) walk this tree
// deterministically — they hardcode the expected step sequence and the
// values to write, so the suite needs no LLM in the loop.
//
// The point isn't to test the tree's content; it's to prove that the
// CLI and MCP transports produce byte-identical observable behaviour
// against the same tree.

import {
	action,
	ambient,
	delegate,
	evaluate,
	global,
	instruct,
	local,
	selector,
	sequence,
} from "@abtree/dsl";

// Module-scope state: unmangled keys so the driver's $LOCAL paths are
// stable and short.
const counter = local("counter", null);
const greeting = local("greeting", null);
const delegateOutput = local("delegate_output", null);
const expectedStatus = global("expected_status", "ok");

export const tree = sequence("Regression_Suite", () => {
	// ── Case A: local state round-trip ───────────────────────────────────
	// Writes two values to $LOCAL across two separate actions, then
	// verifies each via evaluate. Covers: instruct→submit, local_write,
	// evaluate→eval with both numeric and string equality.
	sequence("Local_State_Round_Trip", () => {
		action("Write_Counter", () => {
			instruct(`Write the integer 1 to ${counter} and submit success.`);
		});
		action("Verify_Counter", () => {
			evaluate(`${counter} is 1`);
		});
		action("Write_Greeting", () => {
			instruct(
				`Write the literal string "hello" to ${greeting} and submit success.`,
			);
		});
		action("Verify_Greeting", () => {
			evaluate(`${greeting} is "hello"`);
		});
	});

	// ── Case B: selector falls through to recovery ───────────────────────
	// First child's evaluate returns false; selector advances to the next
	// child which submits success. Covers: selector semantics, evaluate
	// false → action failure → sibling promotion.
	selector("Selector_Fall_Through", () => {
		action("Always_Fail", () => {
			evaluate(`${counter} is 999`);
		});
		action("Recovery", () => {
			instruct(`Write the integer 2 to ${counter} and submit success.`);
		});
	});

	action("Verify_Recovery", () => {
		evaluate(`${counter} is 2`);
	});

	// ── Case C: $GLOBAL read ─────────────────────────────────────────────
	// Read a $GLOBAL value with a default declared at module scope.
	// Covers: global_read tool, global default, evaluate against $GLOBAL.
	action("Verify_Global_Default", () => {
		evaluate(`${expectedStatus} is "ok"`);
	});

	// ── Case D: delegate scope (output gate honoured) ────────────────────
	// The driver walks the spawn marker → inner action → return marker
	// without actually spawning a subagent. The output gate on the
	// Return action verifies $LOCAL.delegate_output is set. Covers: the
	// delegate() DSL helper, the marker pair, the output gate.
	delegate(
		"Delegate_Round_Trip",
		{
			brief:
				'Write the literal string "ok" to the delegate output slot. Driver-only walk — no subagent is actually spawned.',
			model: "haiku",
			output: delegateOutput,
		},
		() => {
			action("Inner_Work", () => {
				instruct(
					`Write the literal string "ok" to ${delegateOutput} and submit success.`,
				);
			});
		},
	);
});

export { ambient };
