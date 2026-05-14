import {
	existsSync,
	readdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { EXECUTIONS_DIR, ensureDir } from "./paths.ts";
import type {
	ExecutionDoc,
	ExecutionRow,
	RuntimeState,
	TraceEntry,
} from "./types.ts";

function emptyRuntime(): RuntimeState {
	return { node_status: {}, step_index: {}, retry_count: {} };
}

// Registered at startup; runs after every successful writeDoc.
// Lets the store own the "after every state change, refresh derived
// artifacts" invariant without depending on the renderer directly.
let mutationListener: ((id: string) => void) | null = null;

export function setMutationListener(fn: (id: string) => void): void {
	mutationListener = fn;
}

const ID_PATTERN = /^[a-z0-9_-]+__[a-z0-9_-]+__\d+$/;

function executionPath(id: string): string {
	if (!ID_PATTERN.test(id)) throw new Error(`Invalid execution id: ${id}`);
	return join(EXECUTIONS_DIR, `${id}.json`);
}

// Exported for use by the sibling RuntimeStore in runtime-store.ts;
// not part of the public API.
export function readDocInternal(id: string): ExecutionDoc | null {
	const path = executionPath(id);
	if (!existsSync(path)) return null;
	let doc: ExecutionDoc;
	try {
		doc = JSON.parse(readFileSync(path, "utf-8"));
	} catch (_e) {
		throw new Error(`Corrupt execution file: ${id}`);
	}
	// Back-compat: pre-trace execution docs on disk have no `trace` field.
	if (!Array.isArray(doc.trace)) doc.trace = [];
	return doc;
}

export function writeDocInternal(doc: ExecutionDoc): void {
	ensureDir(EXECUTIONS_DIR);
	const path = executionPath(doc.id);
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, JSON.stringify(doc, null, 2));
	renameSync(tmp, path);
	if (mutationListener) mutationListener(doc.id);
}

const readDoc = readDocInternal;
const writeDoc = writeDocInternal;

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
	if (!doc) throw new Error(`Execution not found: ${id}`);
	fn(doc[scope]);
	doc.updated_at = new Date().toISOString();
	writeDoc(doc);
}

export const ExecutionStore = {
	findById(id: string): ExecutionDoc | null {
		return readDoc(id);
	},

	list(): ExecutionDoc[] {
		if (!existsSync(EXECUTIONS_DIR)) return [];
		const docs: ExecutionDoc[] = [];
		for (const name of readdirSync(EXECUTIONS_DIR)) {
			if (!name.endsWith(".json")) continue;
			try {
				docs.push(
					JSON.parse(readFileSync(join(EXECUTIONS_DIR, name), "utf-8")),
				);
			} catch {
				// skip corrupt files in list view
			}
		}
		docs.sort((a, b) => a.created_at.localeCompare(b.created_at));
		return docs;
	},

	countByPrefix(prefix: string): number {
		return ExecutionStore.list().filter((d) => d.id.startsWith(prefix)).length;
	},

	create(execution: ExecutionRow): ExecutionDoc {
		const doc: ExecutionDoc = {
			...execution,
			local: {},
			global: {},
			runtime: emptyRuntime(),
		};
		writeDoc(doc);
		return doc;
	},

	update(
		id: string,
		fields: Partial<
			Pick<
				ExecutionRow,
				"status" | "cursor" | "phase" | "protocol_accepted" | "trace"
			>
		>,
	): void {
		const doc = readDoc(id);
		if (!doc) throw new Error(`Execution not found: ${id}`);
		if (fields.status !== undefined) doc.status = fields.status;
		if (fields.cursor !== undefined) doc.cursor = fields.cursor;
		if (fields.phase !== undefined) doc.phase = fields.phase;
		if (fields.protocol_accepted !== undefined)
			doc.protocol_accepted = fields.protocol_accepted;
		if (fields.trace !== undefined) doc.trace = fields.trace;
		doc.updated_at = new Date().toISOString();
		writeDoc(doc);
	},

	appendTrace(id: string, entry: TraceEntry): void {
		const doc = readDoc(id);
		if (!doc) throw new Error(`Execution not found: ${id}`);
		doc.trace.push(entry);
		doc.updated_at = new Date().toISOString();
		writeDoc(doc);
	},

	delete(id: string): void {
		const path = executionPath(id);
		if (existsSync(path)) unlinkSync(path);
	},

	// Scope helpers — scope-parameterised so $LOCAL and $GLOBAL share one implementation.
	getScope(id: string, scope: "local" | "global", path?: string): unknown {
		const doc = readDoc(id);
		if (!doc) return null;
		return path ? walkPath(doc[scope], path) : doc[scope];
	},

	setScope(
		id: string,
		scope: "local" | "global",
		path: string,
		value: unknown,
	): void {
		mutateScope(id, scope, (s) => setPath(s, path, value));
	},

	replaceScope(
		id: string,
		scope: "local" | "global",
		data: Record<string, unknown>,
	): void {
		mutateScope(id, scope, (s) => {
			for (const k of Object.keys(s)) delete s[k];
			Object.assign(s, data);
		});
	},
};

export { emptyRuntime };
