import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

function expandHome(p: string): string {
	if (p === "~") return homedir();
	if (p.startsWith("~/")) return join(homedir(), p.slice(2));
	return p;
}

export const ABTREE_DIR = resolve(process.cwd(), ".abtree");

function resolveExecutionsDir(): string {
	return process.env.ABTREE_EXECUTIONS_DIR
		? resolve(expandHome(process.env.ABTREE_EXECUTIONS_DIR))
		: join(ABTREE_DIR, "executions");
}

function resolveSnapshotsDir(): string {
	return process.env.ABTREE_SNAPSHOTS_DIR
		? resolve(expandHome(process.env.ABTREE_SNAPSHOTS_DIR))
		: join(ABTREE_DIR, "snapshots");
}

// `let` so callers that set `ABTREE_*_DIR` after this module has loaded
// can call `refreshPaths()` to re-resolve. Standard ESM live bindings
// then propagate the new value to every importer.
export let EXECUTIONS_DIR = resolveExecutionsDir();
export let SNAPSHOTS_DIR = resolveSnapshotsDir();

/**
 * Re-read `ABTREE_EXECUTIONS_DIR` / `ABTREE_SNAPSHOTS_DIR` from
 * `process.env` and update the exported bindings. Used by the webapp's
 * `serve()` entrypoint, which can only set the env after its own
 * synchronous setup has finished — by which time the runtime modules
 * have already evaluated this file once.
 */
export function refreshPaths(): void {
	EXECUTIONS_DIR = resolveExecutionsDir();
	SNAPSHOTS_DIR = resolveSnapshotsDir();
}

export function ensureDir(dir: string) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
