import { ExecutionStore, TreeSnapshotStore } from "@abtree/runtime";
import { describeRoute, resolver, validator } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import ApplicationFactory from "../ApplicationFactory.ts";
import { ErrorData } from "../schemas/ErrorData.ts";
import { TreeGraph } from "../schemas/TreeGraph.ts";
import { layoutTree } from "../services/tree-layout.ts";

/**
 * `GET /api/executions/:id/tree` — laid-out ReactFlow graph for the
 * execution's snapshot. Status per node comes from the execution's
 * runtime state so the client can paint success/failure overlays
 * without a separate request.
 */
export const GetExecutionTree = ApplicationFactory.createHandlers(
	describeRoute({
		operationId: "getExecutionTree",
		summary: "ReactFlow graph for an execution's tree snapshot",
		tags: ["Executions"],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		responses: {
			[StatusCodes.OK]: {
				description: "Tree graph",
				content: { "application/json": { schema: resolver(TreeGraph) } },
			},
			[StatusCodes.NOT_FOUND]: {
				description: "Unknown execution id or missing snapshot",
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
		const parsed = TreeSnapshotStore.get(doc.snapshot);
		const graph = layoutTree(parsed.root, doc.runtime.node_status);
		return c.json(graph, StatusCodes.OK);
	},
);
