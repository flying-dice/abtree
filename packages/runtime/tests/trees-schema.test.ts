// One bun:test per bundled tree package — load each package's main file
// (whatever main points at: .json, .yaml, or .yml), dereference via
// json-schema-ref-parser, and parse through TreeFileSchema. Catches drift
// between published trees and the zod schema before release.
import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { TreeFileSchema } from "@abtree/runtime";
import $RefParser from "@apidevtools/json-schema-ref-parser";

const TREES_DIR = resolve(import.meta.dir, "../../..", "trees");

for (const pkgName of readdirSync(TREES_DIR).sort()) {
	const pkgDir = join(TREES_DIR, pkgName);
	const pkgPath = join(pkgDir, "package.json");
	if (!statSync(pkgDir).isDirectory()) continue;
	if (!existsSync(pkgPath)) continue;

	const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
		main?: string;
	};
	if (!pkg.main) continue;
	const main = join(pkgDir, pkg.main);
	if (!/\.(json|ya?ml)$/i.test(main)) continue;
	if (!existsSync(main)) continue;

	test(`schema: ${pkgName}`, async () => {
		const raw = await $RefParser.dereference(main, {
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
			throw new Error(`${pkgName} failed schema validation:\n${issues}`);
		}
		expect(result.success).toBe(true);
	});
}
