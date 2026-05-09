import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, FLOWS_DIR } from "./paths.ts";
import { FlowStore } from "./repos.ts";
import { getNodeResult, getPathForNode } from "./tree.ts";
import type { NormalizedNode } from "./types.ts";

export function rebuildMermaid(flowId: string) {
	try {
		const flow = FlowStore.findById(flowId);
		if (!flow) return;
		const tree = JSON.parse(flow.snapshot);

		const lines: string[] = [];
		lines.push(`---`);
		lines.push(`title: "${flow.summary} (${flow.status})"`);
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

			const nodePath = getPathForNode(tree.root, node);
			if (nodePath) {
				const status = getNodeResult(flowId, nodePath);
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

			if (node.type !== "action") {
				for (let i = 0; i < node.children.length; i++) {
					renderNode(node.children[i], id, i, `${prefix}${index}_`);
				}
			}
		};

		renderNode(tree.root, null, 0, "");
		ensureDir(FLOWS_DIR);
		writeFileSync(
			join(FLOWS_DIR, `${flowId}.mermaid`),
			`${lines.join("\n")}\n`,
		);
	} catch (e) {
		console.error("rebuildMermaid failed:", e);
	}
}
