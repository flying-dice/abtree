/**
 * Fixture helper for scenarios that need a clean abtree workspace.
 *
 * {@link setupTreePackageFixture} `mkdtemp`s an isolated dir and copies
 * a built tree package's `main.json` into it. Pass the returned
 * {@link TreePackageFixture.treePath} to `agent.start(...)` — the runtime
 * resolves the tree from that absolute path. `.abtree/executions/` and
 * `.abtree/snapshots/` are written relative to the fixture's `cwd`.
 *
 * The fixture's purpose is isolation: each scenario run gets its own
 * `mkdtemp` so executions, snapshots, and SVG traces don't pile up
 * in the caller's project tree.
 *
 * @packageDocumentation
 */

import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Configuration for {@link setupTreePackageFixture}.
 */
export interface TreePackageFixtureOptions {
	/**
	 * Subdirectory name created under the fixture's `cwd` to hold the
	 * staged tree files. Useful for keeping the temp tree layout
	 * recognisable in logs and `mkdtemp` listings.
	 */
	slug: string;

	/**
	 * Absolute path to the built tree package. Must contain `main.json`
	 * (or whatever filenames are listed in {@link files}).
	 */
	treeDir: string;

	/**
	 * Tree-package files to copy into the fixture. Defaults to
	 * `["main.json"]`. The first entry must be the tree file the runtime
	 * loads — its absolute staged path becomes {@link TreePackageFixture.treePath}.
	 *
	 * @defaultValue `["main.json"]`
	 */
	files?: string[];

	/**
	 * Optional prefix for the `mkdtemp`'d directory name. Useful for
	 * debugging — leaving identifying prefixes makes orphaned temp dirs
	 * easier to spot.
	 *
	 * @defaultValue `"abtree-harness-"`
	 */
	prefix?: string;
}

/**
 * Handle returned by {@link setupTreePackageFixture}.
 */
export interface TreePackageFixture {
	/**
	 * The `mkdtemp`'d directory. Pass as `cwd` to a {@link CliTransport}
	 * or {@link McpTransport} constructor.
	 */
	cwd: string;

	/**
	 * Absolute path to the staged tree file. Pass this to
	 * `agent.start(...)` — the runtime resolves the tree from this
	 * literal path.
	 */
	treePath: string;

	/**
	 * Removes the temp directory recursively. Call in the scenario's
	 * `finally` block to guarantee cleanup even on failure.
	 */
	cleanup: () => void;
}

/**
 * Prepare an isolated abtree workspace for one scenario.
 *
 * Creates a `mkdtemp`'d directory, copies the tree package's `main.json`
 * (and any other files listed) into a `<slug>/` subdir, and returns
 * `{ cwd, treePath, cleanup }`. Pass `cwd` to the transport; pass
 * `treePath` to `agent.start(...)`; call `cleanup` from the scenario's
 * `finally` block.
 *
 * @example
 * ```ts
 * import { setupTreePackageFixture, AgentHarness, CliTransport } from "@abtree/testing";
 *
 * const fixture = setupTreePackageFixture({
 *   slug: "hello-world",
 *   treeDir: "/abs/path/to/trees/hello-world",
 * });
 *
 * const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
 * try {
 *   await agent.start(fixture.treePath, "scenario");
 *   // ...
 * } finally {
 *   await agent.close();
 *   fixture.cleanup();
 * }
 * ```
 *
 * @param opts - See {@link TreePackageFixtureOptions}.
 * @returns A {@link TreePackageFixture} carrying `cwd`, `treePath`, and a
 *   `cleanup` callback.
 *
 * @throws If `opts.treeDir` does not contain the requested
 *   files — surfaced as the underlying `node:fs` error from
 *   `copyFileSync`.
 */
export function setupTreePackageFixture(
	opts: TreePackageFixtureOptions,
): TreePackageFixture {
	const cwd = mkdtempSync(join(tmpdir(), opts.prefix ?? "abtree-harness-"));
	const treeRoot = join(cwd, opts.slug);
	mkdirSync(treeRoot, { recursive: true });
	const files = opts.files ?? ["main.json"];
	for (const f of files) {
		copyFileSync(join(opts.treeDir, f), join(treeRoot, f));
	}
	return {
		cwd,
		treePath: join(treeRoot, files[0] as string),
		cleanup: () => rmSync(cwd, { recursive: true, force: true }),
	};
}
