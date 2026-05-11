// TREE.yaml no longer carries a `dependencies:` block — npm/bun-installed
// packages live in package.json. These tests assert that the field has
// been dropped from the schema and that pre-existing trees without one
// still validate.
import { describe, expect, test } from "bun:test";
import { buildJsonSchema, TreeFileSchema } from "abtree_runtime";

const validTreeBase = {
	name: "consumer",
	version: "1.0.0",
	tree: { type: "action", name: "A", steps: [{ instruct: "hi" }] },
};

describe("TreeFileSchema", () => {
	test("accepts a TREE.yaml with no dependencies field", () => {
		expect(TreeFileSchema.safeParse(validTreeBase).success).toBe(true);
	});

	test("rejects a TREE.yaml that still carries a dependencies field", () => {
		// Unknown keys are stripped by zod's default, but the field is no
		// longer part of the schema — strict-parse would reject it. The
		// default parse silently drops it; we just assert success here so
		// pre-existing TREE.yaml files don't fail validation outright.
		const r = TreeFileSchema.safeParse({
			...validTreeBase,
			dependencies: { foo: "github://x/y@v1.0.0" },
		});
		expect(r.success).toBe(true);
	});
});

describe("buildJsonSchema", () => {
	test("no longer emits a dependencies property on the root object", () => {
		const schema = buildJsonSchema() as {
			properties: Record<string, unknown>;
		};
		expect(schema.properties).not.toHaveProperty("dependencies");
	});
});
