import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface ServeOptions {
	/**
	 * Either an `.abtree` directory (containing `executions/` and
	 * `snapshots/` subdirs) or an executions directory directly. The
	 * server resolves the right pair of paths automatically.
	 */
	path: string;
	/** HTTP port — defaults to 3000. */
	port?: number;
	/** Hot module reload + browser-console echo. Defaults to NODE_ENV !== "production". */
	development?: boolean;
}

export interface ServeHandle {
	url: string;
	port: number;
	executionsPath: string;
	snapshotsPath: string;
	stop: () => Promise<void>;
}

interface ResolvedPaths {
	executionsPath: string;
	snapshotsPath: string;
}

function resolvePaths(input: string): ResolvedPaths {
	const abs = resolve(input);
	// `.abtree`-style parent dir — keep alongside snapshots/.
	if (existsSync(resolve(abs, "executions"))) {
		return {
			executionsPath: resolve(abs, "executions"),
			snapshotsPath: resolve(abs, "snapshots"),
		};
	}
	// Direct executions dir — snapshots sit beside it.
	return {
		executionsPath: abs,
		snapshotsPath: resolve(abs, "..", "snapshots"),
	};
}

/**
 * Start the abtree inspector webapp pointed at an executions directory
 * (or an `.abtree` parent dir).
 *
 * The runtime resolves its on-disk paths via env vars at import time,
 * so this function sets `ABTREE_EXECUTIONS_DIR` / `ABTREE_SNAPSHOTS_DIR`
 * before dynamically loading the bootstrap.
 */
export async function serve(options: ServeOptions): Promise<ServeHandle> {
	const { executionsPath, snapshotsPath } = resolvePaths(options.path);

	process.env.ABTREE_EXECUTIONS_DIR = executionsPath;
	process.env.ABTREE_SNAPSHOTS_DIR = snapshotsPath;

	// The runtime caches these on first load; rebind to the new env now
	// that the CLI has already imported `@abtree/runtime` at the top.
	const { refreshPaths } = await import("@abtree/runtime");
	refreshPaths();

	const { startServer } = await import("./server/start.ts");
	const handle = startServer({
		executionsPath,
		port: options.port ?? 3000,
		development: options.development ?? process.env.NODE_ENV !== "production",
	});
	return { ...handle, executionsPath, snapshotsPath };
}

export default serve;
