import { ExecutionStore } from "@abtree/runtime";
import { describeRoute, resolver, validator } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import ApplicationFactory from "../ApplicationFactory.ts";
import { ErrorData } from "../schemas/ErrorData.ts";
import { Execution } from "../schemas/Execution.ts";

/** `GET /api/executions/:id` — full doc, including trace + state blobs. */
export const GetExecution = ApplicationFactory.createHandlers(
	describeRoute({
		operationId: "getExecution",
		summary: "Get a single execution",
		tags: ["Executions"],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		responses: {
			[StatusCodes.OK]: {
				description: "Execution doc",
				content: { "application/json": { schema: resolver(Execution) } },
			},
			[StatusCodes.NOT_FOUND]: {
				description: "Unknown execution id",
				content: { "application/json": { schema: resolver(ErrorData) } },
			},
		},
	}),
	validator("param", z.object({ id: z.string() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const doc = ExecutionStore.findById(id);
		if (!doc) {
			return c.json(
				{
					timestamp: new Date().toISOString(),
					status: StatusCodes.NOT_FOUND,
					error: "execution_not_found",
					message: `No execution with id ${id}`,
				},
				StatusCodes.NOT_FOUND,
			);
		}
		const out: Execution = {
			id: doc.id,
			tree: doc.tree,
			summary: doc.summary,
			status: doc.status,
			phase: doc.phase,
			cursor: doc.cursor,
			snapshot: doc.snapshot,
			protocolAccepted: doc.protocol_accepted,
			trace: doc.trace,
			local: doc.local,
			global: doc.global,
			runtime: {
				nodeStatus: doc.runtime.node_status,
				stepIndex: doc.runtime.step_index,
				retryCount: doc.runtime.retry_count,
			},
			createdAt: doc.created_at,
			updatedAt: doc.updated_at,
		};
		return c.json(out, StatusCodes.OK);
	},
);
