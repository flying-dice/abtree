#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildJsonSchema } from "../src/schemas.ts";

const path = resolve(import.meta.dir, "..", "tree.schema.json");
writeFileSync(path, `${JSON.stringify(buildJsonSchema(), null, "\t")}\n`);

// Pass through biome so the committed file matches project formatting and
// the CI biome job stays green. Biome's output is deterministic, so the
// schema-freshness `git diff --exit-code` check is still reliable.
const result = spawnSync("bunx", ["biome", "check", "--write", path], {
	stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`wrote ${path}`);
