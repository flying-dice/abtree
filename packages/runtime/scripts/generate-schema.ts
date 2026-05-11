#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildJsonSchema } from "@abtree/runtime";

const repoRoot = resolve(import.meta.dir, "../../..");
const repoPath = resolve(repoRoot, "tree.schema.json");
// Also publish to the docs site's public/ tree so vitepress serves the
// schema at https://abtree.sh/schemas/tree.schema.json — the canonical URL
// embedded in the schema's $id and in every TREE.yaml's yaml-language-server
// directive. Without this copy the $id is unreachable.
const docsPath = resolve(repoRoot, "docs/public/schemas/tree.schema.json");

const body = `${JSON.stringify(buildJsonSchema(), null, "\t")}\n`;
writeFileSync(repoPath, body);
mkdirSync(dirname(docsPath), { recursive: true });
writeFileSync(docsPath, body);

// Pass through biome so the committed files match project formatting and
// the CI biome job stays green. Biome's output is deterministic, so the
// schema-freshness `git diff --exit-code` check is still reliable.
const result = spawnSync(
	"bunx",
	["biome", "check", "--write", repoPath, docsPath],
	{ stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`wrote ${repoPath}`);
console.log(`wrote ${docsPath}`);
