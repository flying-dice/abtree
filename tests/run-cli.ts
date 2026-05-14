#!/usr/bin/env bun
// Run the regression scenario against the CLI transport.

import { resolve } from "node:path";
import {
	AgentHarness,
	CliTransport,
	setupTreePackageFixture,
} from "@abtree/testing";
import { runRegression } from "./regression.ts";

const REPO_ROOT = resolve(import.meta.dir, "..");
const CLI_PATH = resolve(REPO_ROOT, "packages/cli/index.ts");
const TREE_DIR = import.meta.dir;

const fixture = setupTreePackageFixture({
	slug: "abtree-regression",
	treeDir: TREE_DIR,
	prefix: "abtree-regression-cli-",
});

const agent = new AgentHarness(
	new CliTransport({
		cwd: fixture.cwd,
		command: "bun",
		args: [CLI_PATH],
	}),
);

try {
	await agent.start(fixture.treePath, "regression cli");
	await runRegression(agent);
	const finalLocal = await agent.localRead();
	console.log(
		`✓ CLI regression passed. final $LOCAL = ${JSON.stringify(finalLocal)}`,
	);
} catch (err) {
	console.error(`✗ CLI regression failed: ${(err as Error).message}`);
	process.exitCode = 1;
} finally {
	await agent.close();
	fixture.cleanup();
}
