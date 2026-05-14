// MCP tool registrations. One entry per abtree-loop verb.
//
// Each handler is a 2–4 line wrapper:
//   1. coerce/validate input via the Zod shape on the tool's `inputSchema`,
//   2. call the matching `core*` function from `commands.ts`,
//   3. return `{ content: [...], structuredContent }` on success or
//      `{ isError: true, content: [...] }` on a thrown Error.
//
// The single source of truth for behaviour is the `core*` exports. The
// commander wrappers (`cmd*`) and these tool handlers are two thin
// presenters over the same code path.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	coreEval,
	coreExecutionCreate,
	coreExecutionGet,
	coreExecutionList,
	coreExecutionReset,
	coreGlobalRead,
	coreLocalRead,
	coreLocalWrite,
	coreNext,
	coreSubmit,
} from "../commands.ts";

// `structuredContent` per the MCP spec must be a JSON object — never a
// bare array, number, or string. `coreExecutionList` returns an array, so
// the list wrapper boxes it under a `items` key before returning.
type ToolResult = {
	content: { type: "text"; text: string }[];
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
};

function ok(payload: unknown): ToolResult {
	const text = JSON.stringify(payload, null, 2);
	const structuredContent =
		payload !== null && typeof payload === "object" && !Array.isArray(payload)
			? (payload as Record<string, unknown>)
			: { value: payload };
	return {
		content: [{ type: "text", text }],
		structuredContent,
	};
}

function err(message: string): ToolResult {
	return {
		isError: true,
		content: [{ type: "text", text: message }],
	};
}

function runCore<T>(
	fn: () => T | Promise<T>,
): Promise<ToolResult> | ToolResult {
	try {
		const result = fn();
		if (result instanceof Promise) {
			return result.then(ok).catch((e: Error) => err(e.message));
		}
		return ok(result);
	} catch (e) {
		return err((e as Error).message);
	}
}

const executionField = z
	.string()
	.min(1)
	.describe("Execution ID returned by `abtree_execution_create`.");

const scopePathField = z
	.string()
	.min(1)
	.describe("Dotted path inside the scope (e.g. `greeting`).");

const noteField = z
	.string()
	.trim()
	.min(1)
	.optional()
	.describe(
		"Optional one-sentence justification of this decision — name the values that drove it. Recorded in the execution trace for later review.",
	);

export function registerTools(server: McpServer): void {
	server.registerTool(
		"abtree_next",
		{
			description:
				"Get the next request from the abtree execution loop (an `evaluate`, `instruct`, or terminal `done`/`failure`).",
			inputSchema: { execution: executionField },
			annotations: {
				title: "Get next step",
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
			},
		},
		({ execution }) => runCore(() => coreNext(execution)),
	);

	server.registerTool(
		"abtree_eval",
		{
			description: "Submit the outcome of an `evaluate` step (true/false).",
			inputSchema: {
				execution: executionField,
				result: z
					.boolean()
					.describe(
						"Evaluation outcome — true to advance, false to fail the action.",
					),
				note: noteField,
			},
			annotations: {
				title: "Submit evaluation result",
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
			},
		},
		({ execution, result, note }) =>
			runCore(() => coreEval(execution, result, note)),
	);

	server.registerTool(
		"abtree_submit",
		{
			description:
				"Submit the outcome of an `instruct` step (success / failure / running).",
			inputSchema: {
				execution: executionField,
				status: z
					.enum(["success", "failure", "running"])
					.describe(
						"Outcome of the current instruct. `running` keeps the cursor in place.",
					),
				note: noteField,
			},
			annotations: {
				title: "Submit instruct outcome",
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
			},
		},
		({ execution, status, note }) =>
			runCore(() => coreSubmit(execution, status, note)),
	);

	server.registerTool(
		"abtree_local_read",
		{
			description:
				"Read from $LOCAL. Omit `path` to read the entire scope; supply `path` to read one slot.",
			inputSchema: {
				execution: executionField,
				path: scopePathField
					.optional()
					.describe("Optional path inside $LOCAL."),
			},
			annotations: {
				title: "Read $LOCAL",
				readOnlyHint: true,
			},
		},
		({ execution, path }) => runCore(() => coreLocalRead(execution, path)),
	);

	server.registerTool(
		"abtree_local_write",
		{
			description:
				"Write a value to $LOCAL. Value is JSON-parsed if possible; otherwise stored as a string literal.",
			inputSchema: {
				execution: executionField,
				path: scopePathField,
				value: z
					.string()
					.describe(
						"Value to write. JSON-parsed if it parses; otherwise stored as a string literal.",
					),
			},
			annotations: {
				title: "Write to $LOCAL",
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: true,
			},
		},
		({ execution, path, value }) =>
			runCore(() => coreLocalWrite(execution, path, value)),
	);

	server.registerTool(
		"abtree_global_read",
		{
			description:
				"Read from $GLOBAL. Omit `path` to read the entire scope; supply `path` to read one slot.",
			inputSchema: {
				execution: executionField,
				path: scopePathField
					.optional()
					.describe("Optional path inside $GLOBAL."),
			},
			annotations: {
				title: "Read $GLOBAL",
				readOnlyHint: true,
			},
		},
		({ execution, path }) => runCore(() => coreGlobalRead(execution, path)),
	);

	server.registerTool(
		"abtree_execution_create",
		{
			description:
				"Create a new abtree execution from a path to a .json/.yaml/.yml tree file.",
			inputSchema: {
				tree: z
					.string()
					.min(1)
					.describe("Path to a .json/.yaml/.yml tree file."),
				summary: z
					.string()
					.min(1)
					.describe("Short summary of what this execution is for."),
			},
			annotations: {
				title: "Create execution",
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
			},
		},
		({ tree, summary }) => runCore(() => coreExecutionCreate(tree, summary)),
	);

	server.registerTool(
		"abtree_execution_list",
		{
			description: "List all executions on disk.",
			inputSchema: {},
			annotations: {
				title: "List executions",
				readOnlyHint: true,
			},
		},
		() =>
			runCore(() => {
				const items = coreExecutionList();
				return { items };
			}),
	);

	server.registerTool(
		"abtree_execution_get",
		{
			description: "Get the full execution document for an execution ID.",
			inputSchema: { execution: executionField },
			annotations: {
				title: "Get execution",
				readOnlyHint: true,
			},
		},
		({ execution }) => runCore(() => coreExecutionGet(execution)),
	);

	server.registerTool(
		"abtree_execution_reset",
		{
			description:
				"Reset an execution to its initial state, including the protocol gate.",
			inputSchema: { execution: executionField },
			annotations: {
				title: "Reset execution",
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: true,
			},
		},
		({ execution }) => runCore(() => coreExecutionReset(execution)),
	);
}

// Tool names in registration order — exported so tests can assert
// membership + count without hard-coding the literal strings twice.
export const TOOL_NAMES = [
	"abtree_next",
	"abtree_eval",
	"abtree_submit",
	"abtree_local_read",
	"abtree_local_write",
	"abtree_global_read",
	"abtree_execution_create",
	"abtree_execution_list",
	"abtree_execution_get",
	"abtree_execution_reset",
] as const;
