import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPathForNode } from "./node-path.ts";
import { EXECUTIONS_DIR, ensureDir } from "./paths.ts";
import { ExecutionStore } from "./repos.ts";
import { TreeSnapshotStore } from "./snapshots.ts";
import { getNodeResult } from "./tree.ts";
import type { NodeStatus, NormalizedNode } from "./types.ts";

export interface RenderTreeMermaidOptions {
	title: string;
	getStatus?: (path: number[]) => NodeStatus | null | undefined;
}

export function renderTreeMermaid(
	root: NormalizedNode,
	opts: RenderTreeMermaidOptions,
): string {
	const lines: string[] = [];
	lines.push(`---`);
	lines.push(`title: "${opts.title}"`);
	lines.push(`---`);
	lines.push(`flowchart TD`);

	const renderNode = (
		node: NormalizedNode,
		parentId: string | null,
		index: number,
		prefix: string,
	) => {
		// Cyclic ref placeholder — render as a labelled marker so the
		// shape of the cycle is visible without traversing into it.
		if (node.type === "ref") {
			const refLabel = `ref → ${node.ref}`.replace(/"/g, "");
			const id = `${prefix}ref_${index}`;
			lines.push(`    ${id}(("${refLabel}"))`);
			if (parentId) lines.push(`    ${parentId} -.-> ${id}`);
			lines.push(
				`    style ${id} stroke-dasharray:4,fill:#fde68a,stroke:#b45309,color:#451a03`,
			);
			return;
		}

		const id = `${prefix}${(node.name || `${node.type}_${index}`).replace(/[^a-zA-Z0-9_]/g, "_")}`;
		const label = node.name ? node.name.replace(/_/g, " ") : node.type;

		let shape: string;
		if (node.type !== "action") {
			shape = `${id}{{"${label}\\n[${node.type}]"}}`;
		} else {
			shape = `${id}["${label}\\n[action]"]`;
		}
		lines.push(`    ${shape}`);
		if (parentId) lines.push(`    ${parentId} --> ${id}`);

		if (opts.getStatus) {
			const nodePath = getPathForNode(root, node);
			if (nodePath) {
				const status = opts.getStatus(nodePath);
				if (status === "success") {
					lines.push(
						`    style ${id} fill:#4ade80,stroke:#16a34a,color:#052e16`,
					);
				} else if (status === "failure") {
					lines.push(
						`    style ${id} fill:#f87171,stroke:#dc2626,color:#450a0a`,
					);
				}
			}
		}

		if (node.type !== "action") {
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];
				if (child) renderNode(child, id, i, `${prefix}${index}_`);
			}
		}
	};

	renderNode(root, null, 0, "");
	return `${lines.join("\n")}\n`;
}

export function rebuildMermaid(executionId: string) {
	try {
		const execution = ExecutionStore.findById(executionId);
		if (!execution) return;
		const tree = TreeSnapshotStore.get(execution.snapshot);

		const out = renderTreeMermaid(tree.root, {
			title: `${execution.summary} (${execution.status})`,
			getStatus: (path) => getNodeResult(executionId, path),
		});

		ensureDir(EXECUTIONS_DIR);
		writeFileSync(join(EXECUTIONS_DIR, `${executionId}.mermaid`), out);
	} catch (e) {
		console.error("rebuildMermaid failed:", e);
	}
}
