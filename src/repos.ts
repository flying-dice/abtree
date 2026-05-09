import {
	existsSync,
	readdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ensureDir, FLOWS_DIR } from "./paths.ts";
import type { FlowDoc, FlowRow, NodeStatus, RuntimeState } from "./types.ts";

function emptyRuntime(): RuntimeState {
	return { node_status: {}, step_index: {}, retry_count: {} };
}

// Lift the legacy `_node_status__*` and `_step__*` keys out of $LOCAL into
// the new internal-only `runtime` field. Older flow documents predate the
// runtime/local split; this migration is idempotent and runs lazily on
// every read.
function migrateRuntime(doc: FlowDoc): FlowDoc {
	if (doc.runtime) {
		return doc;
	}
	const runtime = emptyRuntime();
	const remainingLocal: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(doc.local ?? {})) {
		if (key === "_node_status" || key.startsWith("_node_status__")) {
			const path =
				key === "_node_status" ? "" : key.slice("_node_status__".length);
			runtime.node_status[path.replace(/_/g, ".")] = value as NodeStatus;
			continue;
		}
		if (key === "_step" || key.startsWith("_step__")) {
			const path = key === "_step" ? "" : key.slice("_step__".length);
			runtime.step_index[path.replace(/_/g, ".")] = value as number;
			continue;
		}
		remainingLocal[key] = value;
	}
	doc.local = remainingLocal;
	doc.runtime = runtime;
	return doc;
}

const ID_PATTERN = /^[a-z0-9_-]+__[a-z0-9_-]+__\d+$/;

function flowPath(id: string): string {
	if (!ID_PATTERN.test(id)) throw new Error(`Invalid flow id: ${id}`);
	return join(FLOWS_DIR, `${id}.json`);
}

function readDoc(id: string): FlowDoc | null {
	const path = flowPath(id);
	if (!existsSync(path)) return null;
	let doc: FlowDoc;
	try {
		doc = JSON.parse(readFileSync(path, "utf-8"));
	} catch (_e) {
		throw new Error(`Corrupt flow file: ${id}`);
	}
	return migrateRuntime(doc);
}

function writeDoc(doc: FlowDoc): void {
	ensureDir(FLOWS_DIR);
	const path = flowPath(doc.id);
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, JSON.stringify(doc, null, 2));
	renameSync(tmp, path);
}

function walkPath(obj: Record<string, unknown>, path: string): unknown {
	if (!path) throw new Error("Path required");
	const segs = path.split(".");
	// biome-ignore lint/suspicious/noExplicitAny: dot-notation walker; cur is intentionally untyped.
	let cur: any = obj;
	for (const seg of segs) {
		if (cur === null || typeof cur !== "object") return null;
		cur = cur[seg];
	}
	return cur ?? null;
}

function setPath(
	obj: Record<string, unknown>,
	path: string,
	value: unknown,
): void {
	if (!path) throw new Error("Path required");
	const segs = path.split(".");
	// biome-ignore lint/suspicious/noExplicitAny: dot-notation walker; cur is intentionally untyped.
	let cur: any = obj;
	for (let i = 0; i < segs.length - 1; i++) {
		// biome-ignore lint/style/noNonNullAssertion: bounded by segs.length - 1.
		const seg = segs[i]!;
		if (cur[seg] === null || typeof cur[seg] !== "object") cur[seg] = {};
		cur = cur[seg];
	}
	// biome-ignore lint/style/noNonNullAssertion: segs is non-empty (path checked above).
	cur[segs[segs.length - 1]!] = value;
}

function mutateScope(
	id: string,
	scope: "local" | "global",
	fn: (s: Record<string, unknown>) => void,
): void {
	const doc = readDoc(id);
	if (!doc) throw new Error(`Flow not found: ${id}`);
	fn(doc[scope]);
	doc.updated_at = new Date().toISOString();
	writeDoc(doc);
}

export const FlowStore = {
	findById(id: string): FlowDoc | null {
		return readDoc(id);
	},

	list(): FlowDoc[] {
		if (!existsSync(FLOWS_DIR)) return [];
		const docs: FlowDoc[] = [];
		for (const name of readdirSync(FLOWS_DIR)) {
			if (!name.endsWith(".json")) continue;
			try {
				docs.push(JSON.parse(readFileSync(join(FLOWS_DIR, name), "utf-8")));
			} catch {
				// skip corrupt files in list view
			}
		}
		docs.sort((a, b) => a.created_at.localeCompare(b.created_at));
		return docs;
	},

	countByPrefix(prefix: string): number {
		return FlowStore.list().filter((d) => d.id.startsWith(prefix)).length;
	},

	create(flow: FlowRow): FlowDoc {
		const doc: FlowDoc = {
			...flow,
			local: {},
			global: {},
			runtime: emptyRuntime(),
		};
		writeDoc(doc);
		return doc;
	},

	update(
		id: string,
		fields: Partial<Pick<FlowRow, "status" | "cursor" | "phase">>,
	): void {
		const doc = readDoc(id);
		if (!doc) throw new Error(`Flow not found: ${id}`);
		if (fields.status !== undefined) doc.status = fields.status;
		if (fields.cursor !== undefined) doc.cursor = fields.cursor;
		if (fields.phase !== undefined) doc.phase = fields.phase;
		doc.updated_at = new Date().toISOString();
		writeDoc(doc);
	},

	delete(id: string): void {
		const path = flowPath(id);
		if (existsSync(path)) unlinkSync(path);
	},

	// Scope helpers
	getLocal(id: string, path?: string): unknown {
		const doc = readDoc(id);
		if (!doc) return null;
		return path ? walkPath(doc.local, path) : doc.local;
	},

	setLocal(id: string, path: string, value: unknown): void {
		mutateScope(id, "local", (s) => setPath(s, path, value));
	},

	replaceLocal(id: string, data: Record<string, unknown>): void {
		mutateScope(id, "local", (s) => {
			for (const k of Object.keys(s)) delete s[k];
			Object.assign(s, data);
		});
	},

	deleteLocal(id: string): void {
		mutateScope(id, "local", (s) => {
			for (const k of Object.keys(s)) delete s[k];
		});
	},

	getGlobal(id: string, path?: string): unknown {
		const doc = readDoc(id);
		if (!doc) return null;
		return path ? walkPath(doc.global, path) : doc.global;
	},

	setGlobal(id: string, path: string, value: unknown): void {
		mutateScope(id, "global", (s) => setPath(s, path, value));
	},

	replaceGlobal(id: string, data: Record<string, unknown>): void {
		mutateScope(id, "global", (s) => {
			for (const k of Object.keys(s)) delete s[k];
			Object.assign(s, data);
		});
	},

	deleteGlobal(id: string): void {
		mutateScope(id, "global", (s) => {
			for (const k of Object.keys(s)) delete s[k];
		});
	},

	// ---- Runtime helpers ----------------------------------------------------
	// Internal-only state used by the tick engine. Not exposed via local read /
	// local write — these maps live in `doc.runtime` and the CLI never touches
	// them directly. Keys are dot-joined paths (e.g. "0.1.2") used as flat
	// dictionary keys, not walked.

	getRuntimeStatus(id: string, path: number[]): NodeStatus | null {
		const doc = readDoc(id);
		if (!doc) return null;
		return doc.runtime.node_status[path.join(".")] ?? null;
	},

	setRuntimeStatus(id: string, path: number[], status: NodeStatus): void {
		const doc = readDoc(id);
		if (!doc) throw new Error(`Flow not found: ${id}`);
		doc.runtime.node_status[path.join(".")] = status;
		doc.updated_at = new Date().toISOString();
		writeDoc(doc);
	},

	getRuntimeStep(id: string, path: number[]): number {
		const doc = readDoc(id);
		if (!doc) return 0;
		return doc.runtime.step_index[path.join(".")] ?? 0;
	},

	setRuntimeStep(id: string, path: number[], step: number): void {
		const doc = readDoc(id);
		if (!doc) throw new Error(`Flow not found: ${id}`);
		doc.runtime.step_index[path.join(".")] = step;
		doc.updated_at = new Date().toISOString();
		writeDoc(doc);
	},

	getRuntimeRetryCount(id: string, path: number[]): number {
		const doc = readDoc(id);
		if (!doc) return 0;
		return doc.runtime.retry_count[path.join(".")] ?? 0;
	},

	incrementRuntimeRetryCount(id: string, path: number[]): number {
		const doc = readDoc(id);
		if (!doc) throw new Error(`Flow not found: ${id}`);
		const key = path.join(".");
		const next = (doc.runtime.retry_count[key] ?? 0) + 1;
		doc.runtime.retry_count[key] = next;
		doc.updated_at = new Date().toISOString();
		writeDoc(doc);
		return next;
	},

	// Wipe all runtime keys whose path begins with `prefix`. Used when a node
	// retries: its node_status / step_index for itself and every descendant
	// must be cleared so the next tick re-attempts from a clean slate.
	// User-written $LOCAL data is untouched — the next attempt sees the
	// previous attempt's outputs, which is the whole point of feedback.
	resetRuntimeSubtree(id: string, prefix: number[]): void {
		const doc = readDoc(id);
		if (!doc) throw new Error(`Flow not found: ${id}`);
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
		doc.updated_at = new Date().toISOString();
		writeDoc(doc);
	},

	resetRuntime(id: string): void {
		const doc = readDoc(id);
		if (!doc) throw new Error(`Flow not found: ${id}`);
		doc.runtime = emptyRuntime();
		doc.updated_at = new Date().toISOString();
		writeDoc(doc);
	},
};
