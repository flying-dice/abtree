#!/usr/bin/env bun
/**
 * Regenerate the static catalogue inside docs/registry.md from
 * docs/registry.ts. The <RegistryCards /> Vue component renders the
 * same list client-side; this script writes the same data as plain
 * markdown so the catalogue is visible to llms.txt readers, search
 * engines, and anything else that reads the static page body.
 *
 * Run as part of `docs:build`. Idempotent: it only rewrites the region
 * between the `catalogue:start` / `catalogue:end` HTML comments.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { registry } from "../docs/registry.ts";

const START = "<!-- catalogue:start — generated from docs/registry.ts by scripts/generate-registry-md.ts -->";
const END = "<!-- catalogue:end -->";

const lines = registry.map(
	(entry) => `- [\`${entry.name}\`](${entry.link}) — ${entry.description}`,
);
const block = `${START}\n\n${lines.join("\n")}\n\n${END}`;

const registryMd = resolve(import.meta.dir, "..", "docs/registry.md");
const src = readFileSync(registryMd, "utf8");

const startIdx = src.indexOf(START);
const endIdx = src.indexOf(END);
if (startIdx < 0 || endIdx < 0) {
	throw new Error(
		`Catalogue markers not found in ${registryMd}. Ensure both ${START} and ${END} are present.`,
	);
}

const next = src.slice(0, startIdx) + block + src.slice(endIdx + END.length);
writeFileSync(registryMd, next);
console.log(`wrote ${registry.length} trees → ${registryMd}`);
