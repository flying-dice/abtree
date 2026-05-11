// One bun:test per bundled tree under .abtree/trees/<slug>/TREE.yaml.
// Each tree is dereferenced via json-schema-ref-parser and parsed through
// TreeFileSchema, mirroring the load path in src/tree.ts. Catches drift
// between the bundled trees and the zod schema before release.
import { expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { TreeFileSchema } from "abtree_runtime";

const TREES_DIR = resolve(import.meta.dir, "../../..", ".abtree", "trees");

for (const slug of readdirSync(TREES_DIR).sort()) {
	const treePath = join(TREES_DIR, slug, "TREE.yaml");
	if (!statSync(join(TREES_DIR, slug)).isDirectory()) continue;
	if (!existsSync(treePath)) continue;
	test(`schema: ${slug}`, async () => {
		const raw = await $RefParser.dereference(treePath, {
			dereference: { circular: "ignore" },
		});
		const result = TreeFileSchema.safeParse(raw);
		if (!result.success) {
			const issues = result.error.issues
				.map((i) => {
					const p = i.path.length ? i.path.join(".") : "(root)";
					return `  ${p}: ${i.message}`;
				})
				.join("\n");
			throw new Error(`${slug} failed schema validation:\n${issues}`);
		}
		expect(result.success).toBe(true);
	});
}
