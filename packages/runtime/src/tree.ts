// The tick engine: advances an execution one tick at a time, honouring
// sequence/selector/parallel/action semantics and retry budgets.
//
// Internal bookkeeping (per-node status, step index, retry counters) lives in
// the execution document's `runtime` field — never in $LOCAL — so it isn't
// exposed by `abtree local read` and can't be mutated by `abtree local write`.
// The tick engine owns it; the CLI can't reach it.

import { RuntimeStore } from "./runtime-store.ts";
import type { NodeStatus, NormalizedNode, TickResult } from "./types.ts";

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
				// Eagerly try the failed child's retries here. The lazy check
				// at the top of the loop only fires on a subsequent tick, but
				// in sequences/selectors/parallels we propagate failure UP
				// immediately — so without an eager check the inner-composite
				// retry budget never sees the failure (the parent's own
				// failure propagation runs first). Re-attempt this child's
				// index so its fresh tick produces the next request.
				if (maybeRetry(executionId, childPath, child)) {
					i--;
					continue;
				}
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
				// Eager retry — see sequence note above.
				if (maybeRetry(executionId, childPath, child)) {
					i--;
					continue;
				}
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
				// Eager retry — see sequence note above.
				if (maybeRetry(executionId, childPath, child)) {
					i--;
					continue;
				}
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

export { getStepIndex, setStepIndex };
