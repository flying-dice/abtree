// Internal-only state used by the tick engine. Not exposed via
// `abtree local read` / `local write` — these maps live in `doc.runtime`
// and only tree.ts is meant to call them. Keys are dot-joined paths
// (e.g. "0.1.2") used as flat dictionary keys, not walked.

import { emptyRuntime, readDocInternal, writeDocInternal } from "./repos.ts";
import type { NodeStatus } from "./types.ts";

function mutateRuntime(
	id: string,
	fn: (doc: ReturnType<typeof readDocInternal> & object) => void,
): void {
	const doc = readDocInternal(id);
	if (!doc) throw new Error(`Execution not found: ${id}`);
	fn(doc);
	doc.updated_at = new Date().toISOString();
	writeDocInternal(doc);
}

export const RuntimeStore = {
	getStatus(id: string, path: number[]): NodeStatus | null {
		const doc = readDocInternal(id);
		if (!doc) return null;
		return doc.runtime.node_status[path.join(".")] ?? null;
	},

	setStatus(id: string, path: number[], status: NodeStatus): void {
		mutateRuntime(id, (doc) => {
			doc.runtime.node_status[path.join(".")] = status;
		});
	},

	getStep(id: string, path: number[]): number {
		const doc = readDocInternal(id);
		if (!doc) return 0;
		return doc.runtime.step_index[path.join(".")] ?? 0;
	},

	setStep(id: string, path: number[], step: number): void {
		mutateRuntime(id, (doc) => {
			doc.runtime.step_index[path.join(".")] = step;
		});
	},

	getRetryCount(id: string, path: number[]): number {
		const doc = readDocInternal(id);
		if (!doc) return 0;
		return doc.runtime.retry_count[path.join(".")] ?? 0;
	},

	incrementRetryCount(id: string, path: number[]): number {
		let next = 0;
		mutateRuntime(id, (doc) => {
			const key = path.join(".");
			next = (doc.runtime.retry_count[key] ?? 0) + 1;
			doc.runtime.retry_count[key] = next;
		});
		return next;
	},

	// Wipe all runtime keys whose path begins with `prefix`. Used when a node
	// retries: its node_status / step_index for itself and every descendant
	// must be cleared so the next tick re-attempts from a clean slate.
	// User-written $LOCAL data is untouched — the next attempt sees the
	// previous attempt's outputs, which is the whole point of feedback.
	resetSubtree(id: string, prefix: number[]): void {
		mutateRuntime(id, (doc) => {
			const prefixKey = prefix.join(".");
			const matches = (k: string) =>
				prefixKey === ""
					? true
					: k === prefixKey || k.startsWith(`${prefixKey}.`);
			for (const map of [
				doc.runtime.node_status,
				doc.runtime.step_index,
			] as Record<string, unknown>[]) {
				for (const k of Object.keys(map)) {
					if (matches(k)) delete map[k];
				}
			}
		});
	},

	reset(id: string): void {
		mutateRuntime(id, (doc) => {
			doc.runtime = emptyRuntime();
		});
	},
};
