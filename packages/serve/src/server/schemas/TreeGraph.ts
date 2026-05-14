import { z } from "zod";

export type TreeNodeKind = z.infer<typeof TreeNodeKind>;
export const TreeNodeKind = z.enum([
	"action",
	"sequence",
	"selector",
	"parallel",
	"ref",
]);

export type TreeNodeData = z.infer<typeof TreeNodeData>;

/**
 * Pre-laid-out node for the ReactFlow graph. The server does the layout
 * so the client renders deterministically without a layout dependency.
 *
 * `path` is the runtime's index-path string ("1.1.0") — used as the key
 * everywhere a node is addressed (runtime status, trace cursor decode).
 */
export const TreeNodeData = z
	.object({
		id: z.string(),
		path: z.string(),
		name: z.string(),
		kind: TreeNodeKind,
		ref: z.string().nullable(),
		steps: z
			.array(
				z.object({
					kind: z.enum(["evaluate", "instruct"]),
					text: z.string(),
				}),
			)
			.optional(),
		status: z.enum(["success", "failure", "running"]).nullable(),
		retries: z.number().int().optional(),
		x: z.number(),
		y: z.number(),
	})
	.meta({ ref: "TreeNodeData" });

export type TreeEdgeData = z.infer<typeof TreeEdgeData>;

export const TreeEdgeData = z
	.object({
		id: z.string(),
		source: z.string(),
		target: z.string(),
	})
	.meta({ ref: "TreeEdgeData" });

export type TreeGraph = z.infer<typeof TreeGraph>;

export const TreeGraph = z
	.object({
		nodes: z.array(TreeNodeData),
		edges: z.array(TreeEdgeData),
		width: z.number(),
		height: z.number(),
	})
	.meta({ ref: "TreeGraph" });
