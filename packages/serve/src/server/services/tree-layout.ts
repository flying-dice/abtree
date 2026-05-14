import type { NormalizedNode } from "@abtree/runtime";
import type { TreeEdgeData, TreeGraph, TreeNodeData } from "../schemas/TreeGraph.ts";

// Layout constants — mirror the SVG renderer so the React graph looks
// like the static export. Widths are in CSS pixels.
const NODE_WIDTH = 180;
const NODE_HEIGHT = 92;
const H_GAP = 32;
const V_GAP = 80;
const MARGIN = 40;

interface Laid {
	node: NormalizedNode;
	path: number[];
	subtreeWidth: number;
	children: Laid[];
	x: number;
	y: number;
}

function pathKey(p: number[]): string {
	return p.length === 0 ? "" : p.join(".");
}

function build(node: NormalizedNode, path: number[]): Laid {
	const children =
		node.type === "action" || node.type === "ref"
			? []
			: node.children.map((c, i) => build(c, [...path, i]));
	const childrenWidth = children.length
		? children.reduce((s, c) => s + c.subtreeWidth, 0) +
			(children.length - 1) * H_GAP
		: 0;
	return {
		node,
		path,
		subtreeWidth: Math.max(NODE_WIDTH, childrenWidth),
		children,
		x: 0,
		y: 0,
	};
}

function position(node: Laid, slotLeft: number, depth: number): number {
	node.x = slotLeft + node.subtreeWidth / 2 - NODE_WIDTH / 2;
	node.y = MARGIN + depth * (NODE_HEIGHT + V_GAP);
	let maxDepth = depth;
	if (node.children.length > 0) {
		const childrenWidth =
			node.children.reduce((s, c) => s + c.subtreeWidth, 0) +
			(node.children.length - 1) * H_GAP;
		const centre = node.x + NODE_WIDTH / 2;
		let cursor = centre - childrenWidth / 2;
		for (const c of node.children) {
			const d = position(c, cursor, depth + 1);
			if (d > maxDepth) maxDepth = d;
			cursor += c.subtreeWidth + H_GAP;
		}
	}
	return maxDepth;
}

function flatten(
	laid: Laid,
	statuses: Record<string, "success" | "failure" | "running">,
	nodes: TreeNodeData[],
	edges: TreeEdgeData[],
): void {
	const id = pathKey(laid.path) || "root";
	const n = laid.node;
	const status = statuses[pathKey(laid.path)] ?? null;
	const name = n.type === "ref" ? n.ref : n.name || n.type;

	nodes.push({
		id,
		path: pathKey(laid.path),
		name,
		kind: n.type,
		ref: n.type === "ref" ? n.ref : null,
		steps:
			n.type === "action"
				? n.steps.map((s) =>
						s.kind === "evaluate"
							? { kind: "evaluate" as const, text: s.expression }
							: { kind: "instruct" as const, text: s.instruction },
					)
				: undefined,
		status,
		retries: n.type !== "ref" ? n.retries : undefined,
		x: laid.x,
		y: laid.y,
	});

	for (const child of laid.children) {
		const childId = pathKey(child.path);
		edges.push({ id: `${id}->${childId}`, source: id, target: childId });
		flatten(child, statuses, nodes, edges);
	}
}

export function layoutTree(
	root: NormalizedNode,
	statuses: Record<string, "success" | "failure" | "running"> = {},
): TreeGraph {
	const laid = build(root, []);
	const maxDepth = position(laid, 0, 0);
	const nodes: TreeNodeData[] = [];
	const edges: TreeEdgeData[] = [];
	flatten(laid, statuses, nodes, edges);
	const width = laid.subtreeWidth + 2 * MARGIN;
	const height = maxDepth * (NODE_HEIGHT + V_GAP) + NODE_HEIGHT + 2 * MARGIN;
	return { nodes, edges, width, height };
}
