#!/usr/bin/env bun
// Build the tree package's main.json from src/tree.ts (DSL-authored) +
// package.json metadata. Run via `bun run build` inside the package.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateTreeFile } from "abtree_runtime";
import { ambient, tree } from "../src/tree.ts";

const pkgDir = resolve(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(resolve(pkgDir, "package.json"), "utf8"));

const state: { local?: Record<string, unknown>; global?: Record<string, unknown> } = {};
if (Object.keys(ambient.local).length > 0) state.local = ambient.local;
if (Object.keys(ambient.global).length > 0) state.global = ambient.global;

const treeFile: Record<string, unknown> = {
	$schema: "https://abtree.sh/schemas/tree.schema.json",
	name: pkg.name,
	version: pkg.version,
	tree,
};
if (pkg.description) treeFile.description = pkg.description;
if (Object.keys(state).length > 0) treeFile.state = state;

// Validate against the canonical schema before writing so DSL output
// errors surface at build time, not at execution-create.
validateTreeFile(treeFile);

const outPath = resolve(pkgDir, "main.json");
writeFileSync(outPath, `${JSON.stringify(treeFile, null, 2)}\n`);
console.log(`wrote ${outPath}`);
