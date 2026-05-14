import { ExecutionStore } from "@abtree/runtime";
import { describeRoute, resolver } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import ApplicationFactory from "../ApplicationFactory.ts";
import { ExecutionSummary } from "../schemas/Execution.ts";

/** `GET /api/executions` — list every execution doc on disk, oldest first. */
export const GetExecutions = ApplicationFactory.createHandlers(
	describeRoute({
		operationId: "getExecutions",
		summary: "List executions",
		tags: ["Executions"],
		responses: {
			[StatusCodes.OK]: {
				description: "Execution summaries",
				content: {
					"application/json": {
						schema: resolver(z.array(ExecutionSummary)),
					},
				},
			},
		},
	}),
	async (c) => {
		const docs = ExecutionStore.list();
		const summaries: ExecutionSummary[] = docs.map((d) => ({
			id: d.id,
			tree: d.tree,
			summary: d.summary,
			status: d.status,
			phase: d.phase,
			cursor: d.cursor,
			snapshot: d.snapshot,
			protocolAccepted: d.protocol_accepted,
			// Pre-trace docs on disk skip the `trace` field — ExecutionStore.list()
			// reads them raw, so coerce to length 0 here.
			traceCount: Array.isArray(d.trace) ? d.trace.length : 0,
			createdAt: d.created_at,
			updatedAt: d.updated_at,
		}));
		return c.json(summaries, StatusCodes.OK);
	},
);
