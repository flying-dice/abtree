import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { TREE_SOURCES } from "./paths.ts";
import { FlowStore } from "./repos.ts";
import type {
	NodeStatus,
	NormalizedNode,
	ParsedTree,
	TickResult,
} from "./types.ts";
import { normalizeNode, validateTreeFile } from "./validate.ts";

// Tree files can split themselves across multiple YAML documents using
// JSON-Schema-style $ref. The ref-parser dereferences relative paths,
// absolute paths, and URLs at load time so the rest of the pipeline
// sees one fully-resolved object.
//
//   tree:
//     type: sequence
//     children:
//       - $ref: "./fragments/auth.yaml"
//       - $ref: "./fragments/work.yaml"
//
// The dereferenced object is identical in shape to a single-file tree.
export async function loadTree(slug: string): Promise<ParsedTree | null> {
	for (const dir of TREE_SOURCES) {
		const yamlPath = join(dir, `${slug}.yaml`);
		if (!existsSync(yamlPath)) continue;
		// circular: 'ignore' leaves cyclic edges as literal { $ref: "..." }
		// objects in the resolved tree. Non-cyclic refs are still expanded.
		// This stops a cycle from blowing the stack at validate / snapshot
		// time; the ref node is preserved in the snapshot and surfaces a
		// clean failure if the runtime ever ticks it.
		const raw = await $RefParser.dereference(yamlPath, {
			dereference: { circular: "ignore" },
		});
		const parsed = validateTreeFile(raw);
		return {
			local: parsed.state?.local ?? {},
			global: parsed.state?.global ?? {},
			root: normalizeNode(parsed.tree),
		};
	}
	return null;
}

export function listTreeSlugs(): string[] {
	const seen = new Set<string>();
	const slugs: string[] = [];
	for (const dir of TREE_SOURCES) {
		if (!existsSync(dir)) continue;
		for (const f of readdirSync(dir)) {
			if (!f.endsWith(".yaml")) continue;
			const slug = f.slice(0, -5);
			if (seen.has(slug)) continue;
			seen.add(slug);
			slugs.push(slug);
		}
	}
	return slugs;
}

export function generateFlowId(tree: string, summary: string): string {
	const slug = summary
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
	const prefix = `${slug}__${tree}__`;
	const count = FlowStore.countByPrefix(prefix);
	return `${prefix}${count + 1}`;
}

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

// Internal bookkeeping is stored in the flow document's `runtime` field —
// never in $LOCAL — so it isn't exposed by `abtree local read` and can't
// be mutated by `abtree local write`. The tick engine owns it; the CLI
// can't reach it.

export function getNodeResult(
	flowId: string,
	path: number[],
): NodeStatus | null {
	return FlowStore.getRuntimeStatus(flowId, path);
}

export function setNodeResult(
	flowId: string,
	path: number[],
	status: NodeStatus,
) {
	FlowStore.setRuntimeStatus(flowId, path, status);
}

function getStepIndex(flowId: string, path: number[]): number {
	return FlowStore.getRuntimeStep(flowId, path);
}

function setStepIndex(flowId: string, path: number[], step: number) {
	FlowStore.setRuntimeStep(flowId, path, step);
}

// If `node` has a retries config and we haven't exhausted it, reset the
// node's runtime state (status, step index, descendants) and bump the
// retry counter. Returns true if a retry was consumed and the caller
// should treat the node as unstarted; false if the failure should stand.
//
// Intentionally NOT touching $LOCAL — user-written keys (counter,
// review_notes, draft, etc.) persist across retries because that's how
// the next attempt sees what the previous one produced.
function maybeRetry(
	flowId: string,
	path: number[],
	node: NormalizedNode,
): boolean {
	if (node.type === "ref") return false;
	const retries = node.retries ?? 0;
	if (retries <= 0) return false;
	const attempts = FlowStore.getRuntimeRetryCount(flowId, path);
	if (attempts >= retries) return false;
	FlowStore.incrementRuntimeRetryCount(flowId, path);
	FlowStore.resetRuntimeSubtree(flowId, path);
	return true;
}

// Top-level entry point for cmdNext. Handles retries on the ROOT node,
// where there's no parent to detect failure and apply maybeRetry on the
// child's behalf. Composite-internal retries are still handled inside
// tickNode via the per-child status checks.
export function tickRoot(flowId: string, root: NormalizedNode): TickResult {
	let result = tickNode(flowId, [], root);
	while (result.type === "failure" && maybeRetry(flowId, [], root)) {
		result = tickNode(flowId, [], root);
	}
	return result;
}

export function tickNode(
	flowId: string,
	path: number[],
	node: NormalizedNode,
): TickResult {
	if (!node) return { type: "done" };

	if (node.type === "ref") {
		// Cyclic $ref preserved at flow-create time. We can't traverse a
		// cycle, so fail cleanly with a marker on the local store so the
		// caller can see what broke.
		console.error(
			`abtree: cyclic ref '${node.ref}' encountered at path [${path.join(",")}] — cannot tick. Marking action as failure.`,
		);
		return { type: "failure" };
	}

	if (node.type === "action") {
		let status = getNodeResult(flowId, path);
		if (status === "failure" && maybeRetry(flowId, path, node)) {
			status = null; // subtree state was wiped — restart this action's steps
		}
		if (status === "success" || status === "failure") {
			return { type: status === "success" ? "done" : "failure" };
		}
		const stepIdx = getStepIndex(flowId, path);
		if (!node.steps || stepIdx >= node.steps.length) return { type: "done" };
		const step = node.steps[stepIdx];
		if (step.kind === "evaluate") {
			return {
				type: "evaluate",
				name: node.name,
				expression: step.expression,
				path,
				step: stepIdx,
			};
		}
		return {
			type: "instruct",
			name: node.name,
			instruction: step.instruction,
			path,
			step: stepIdx,
		};
	}

	if (node.type === "sequence") {
		for (let i = 0; i < node.children.length; i++) {
			const childPath = [...path, i];
			const child = node.children[i] as NormalizedNode;
			let childStatus = getNodeResult(flowId, childPath);
			if (childStatus === "failure" && maybeRetry(flowId, childPath, child)) {
				childStatus = null; // child reset — re-tick fresh
			}
			if (childStatus === "failure") return { type: "failure" };
			if (childStatus === "success") continue;
			const result = tickNode(flowId, childPath, child);
			if (result.type === "done") {
				setNodeResult(flowId, childPath, "success");
				continue;
			}
			if (result.type === "failure") {
				setNodeResult(flowId, childPath, "failure");
				return { type: "failure" };
			}
			return result;
		}
		return { type: "done" };
	}

	if (node.type === "selector") {
		for (let i = 0; i < node.children.length; i++) {
			const childPath = [...path, i];
			const child = node.children[i] as NormalizedNode;
			let childStatus = getNodeResult(flowId, childPath);
			if (childStatus === "failure" && maybeRetry(flowId, childPath, child)) {
				childStatus = null;
			}
			if (childStatus === "success") return { type: "done" };
			if (childStatus === "failure") continue;
			const result = tickNode(flowId, childPath, child);
			if (result.type === "done") {
				setNodeResult(flowId, childPath, "success");
				return { type: "done" };
			}
			if (result.type === "failure") {
				setNodeResult(flowId, childPath, "failure");
				continue;
			}
			return result;
		}
		return { type: "failure" };
	}

	if (node.type === "parallel") {
		let allDone = true;
		let firstPending: TickResult | null = null;
		for (let i = 0; i < node.children.length; i++) {
			const childPath = [...path, i];
			const child = node.children[i] as NormalizedNode;
			let childStatus = getNodeResult(flowId, childPath);
			if (childStatus === "failure" && maybeRetry(flowId, childPath, child)) {
				childStatus = null;
			}
			if (childStatus === "failure") return { type: "failure" };
			if (childStatus === "success") continue;
			const result = tickNode(flowId, childPath, child);
			if (result.type === "done") {
				setNodeResult(flowId, childPath, "success");
				continue;
			}
			if (result.type === "failure") {
				setNodeResult(flowId, childPath, "failure");
				return { type: "failure" };
			}
			allDone = false;
			if (!firstPending) firstPending = result;
		}
		if (allDone) return { type: "done" };
		// biome-ignore lint/style/noNonNullAssertion: !allDone implies at least one pending child was recorded.
		return firstPending!;
	}

	return { type: "done" };
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

export { getStepIndex, setStepIndex };
