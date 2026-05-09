// One bun:test per YAML in .abtree/trees/. Each tree is dereferenced via
// json-schema-ref-parser and parsed through TreeFileSchema, mirroring the
// load path in src/tree.ts. Catches drift between the bundled trees and
// the zod schema before release.
import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { TreeFileSchema } from "../src/schemas.ts";

const TREES_DIR = resolve(import.meta.dir, "..", ".abtree", "trees");

for (const file of readdirSync(TREES_DIR).sort()) {
	if (!file.endsWith(".yaml")) continue;
	test(`schema: ${file}`, async () => {
		const raw = await $RefParser.dereference(join(TREES_DIR, file), {
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
			throw new Error(`${file} failed schema validation:\n${issues}`);
		}
		expect(result.success).toBe(true);
	});
}
