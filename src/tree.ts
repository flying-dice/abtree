import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { TREE_SOURCES } from "./paths.ts";
import { ExecutionStore } from "./repos.ts";
import { RuntimeStore } from "./runtime-store.ts";
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
// Trees live in <source>/<slug>/TREE.yaml. The folder gives the tree
// somewhere to keep its own fragments and playbooks alongside the
// definition (e.g. <slug>/fragments/<name>.yaml).
export async function loadTree(slug: string): Promise<ParsedTree | null> {
	for (const dir of TREE_SOURCES) {
		const yamlPath = join(dir, slug, "TREE.yaml");
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
		for (const entry of readdirSync(dir)) {
			const entryPath = join(dir, entry);
			if (!statSync(entryPath).isDirectory()) continue;
			if (!existsSync(join(entryPath, "TREE.yaml"))) continue;
			if (seen.has(entry)) continue;
			seen.add(entry);
			slugs.push(entry);
		}
	}
	return slugs;
}

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

// Internal bookkeeping is stored in the execution document's `runtime` field —
// never in $LOCAL — so it isn't exposed by `abtree local read` and can't
// be mutated by `abtree local write`. The tick engine owns it; the CLI
// can't reach it.

export function getNodeResult(
	executionId: string,
	path: number[],
): NodeStatus | null {
	return RuntimeStore.getStatus(executionId, path);
}

export function setNodeResult(
	executionId: string,
	path: number[],
	status: NodeStatus,
) {
	RuntimeStore.setStatus(executionId, path, status);
}

function getStepIndex(executionId: string, path: number[]): number {
	return RuntimeStore.getStep(executionId, path);
}

function setStepIndex(executionId: string, path: number[], step: number) {
	RuntimeStore.setStep(executionId, path, step);
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
	executionId: string,
	path: number[],
	node: NormalizedNode,
): boolean {
	if (node.type === "ref") return false;
	const retries = node.retries ?? 0;
	if (retries <= 0) return false;
	const attempts = RuntimeStore.getRetryCount(executionId, path);
	if (attempts >= retries) return false;
	RuntimeStore.incrementRetryCount(executionId, path);
	RuntimeStore.resetSubtree(executionId, path);
	return true;
}

// Top-level entry point for cmdNext. Handles retries on the ROOT node,
// where there's no parent to detect failure and apply maybeRetry on the
// child's behalf. Composite-internal retries are still handled inside
// tickNode via the per-child status checks.
export function tickRoot(
	executionId: string,
	root: NormalizedNode,
): TickResult {
	let result = tickNode(executionId, [], root);
	while (result.type === "failure" && maybeRetry(executionId, [], root)) {
		result = tickNode(executionId, [], root);
	}
	return result;
}

export function tickNode(
	executionId: string,
	path: number[],
	node: NormalizedNode,
): TickResult {
	if (!node) return { type: "done" };

	if (node.type === "ref") {
		// Cyclic $ref preserved at execution-create time. We can't traverse a
		// cycle, so fail cleanly with a marker on the local store so the
		// caller can see what broke.
		console.error(
			`abtree: cyclic ref '${node.ref}' encountered at path [${path.join(",")}] — cannot tick. Marking action as failure.`,
		);
		return { type: "failure" };
	}

	if (node.type === "action") {
		let status = getNodeResult(executionId, path);
		if (status === "failure" && maybeRetry(executionId, path, node)) {
			status = null; // subtree state was wiped — restart this action's steps
		}
		if (status === "success" || status === "failure") {
			return { type: status === "success" ? "done" : "failure" };
		}
		const stepIdx = getStepIndex(executionId, path);
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
			let childStatus = getNodeResult(executionId, childPath);
			if (
				childStatus === "failure" &&
				maybeRetry(executionId, childPath, child)
			) {
				childStatus = null; // child reset — re-tick fresh
			}
			if (childStatus === "failure") return { type: "failure" };
			if (childStatus === "success") continue;
			const result = tickNode(executionId, childPath, child);
			if (result.type === "done") {
				setNodeResult(executionId, childPath, "success");
				continue;
			}
			if (result.type === "failure") {
				setNodeResult(executionId, childPath, "failure");
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
			let childStatus = getNodeResult(executionId, childPath);
			if (
				childStatus === "failure" &&
				maybeRetry(executionId, childPath, child)
			) {
				childStatus = null;
			}
			if (childStatus === "success") return { type: "done" };
			if (childStatus === "failure") continue;
			const result = tickNode(executionId, childPath, child);
			if (result.type === "done") {
				setNodeResult(executionId, childPath, "success");
				return { type: "done" };
			}
			if (result.type === "failure") {
				setNodeResult(executionId, childPath, "failure");
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
			let childStatus = getNodeResult(executionId, childPath);
			if (
				childStatus === "failure" &&
				maybeRetry(executionId, childPath, child)
			) {
				childStatus = null;
			}
			if (childStatus === "failure") return { type: "failure" };
			if (childStatus === "success") continue;
			const result = tickNode(executionId, childPath, child);
			if (result.type === "done") {
				setNodeResult(executionId, childPath, "success");
				continue;
			}
			if (result.type === "failure") {
				setNodeResult(executionId, childPath, "failure");
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
