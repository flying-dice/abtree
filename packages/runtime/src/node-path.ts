// Index-path navigation over a normalised tree. Used by the tick engine,
// the CLI (for `abtree at`-style lookups), and the snapshot/report
// emitters. Pure functions — no state, no IO.

import type { NormalizedNode } from "./types.ts";

export function getNodeAtPath(
	root: NormalizedNode,
	path: number[],
): NormalizedNode {
	let node = root;
	for (const idx of path) {
		if (node.type === "action" || node.type === "ref") break;
		node = node.children[idx];
	}
	return node;
}

export function getPathForNode(
	root: NormalizedNode,
	target: NormalizedNode,
	path: number[] = [],
): number[] | null {
	if (root === target) return path;
	if (root.type !== "action" && root.type !== "ref") {
		for (let i = 0; i < root.children.length; i++) {
			const found = getPathForNode(root.children[i], target, [...path, i]);
			if (found) return found;
		}
	}
	return null;
}
