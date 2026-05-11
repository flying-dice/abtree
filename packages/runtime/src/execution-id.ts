// Execution IDs are the primary key for every persisted execution document.
// They must match /^[a-z0-9_-]+__[a-z0-9_-]+__\d+$/ — enforced by repos.ts —
// and they must be stable across re-runs of the same (tree, summary) pair
// so users can `abtree resume` deterministically.

import { ExecutionStore } from "./repos.ts";

export function generateExecutionId(tree: string, summary: string): string {
	const slug = summary
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
	const prefix = `${slug}__${tree}__`;
	const count = ExecutionStore.countByPrefix(prefix);
	return `${prefix}${count + 1}`;
}
