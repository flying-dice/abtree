import { z } from "zod";

export const StepSchema = z.union([
	z.object({ evaluate: z.string().min(1) }),
	z.object({ instruct: z.string().min(1) }),
]);

const RetriesSchema = z.int().min(1).optional();

export const RefNodeSchema = z.object({
	$ref: z.string(),
});

export type ActionNode = {
	type: "action";
	name: string;
	steps: z.infer<typeof StepSchema>[];
	retries?: number;
};

export type CompositeNode = {
	type: "sequence" | "selector" | "parallel";
	name: string;
	children: AbtNode[];
	retries?: number;
};

export type RefNode = z.infer<typeof RefNodeSchema>;

export type AbtNode = ActionNode | CompositeNode | RefNode;

export const ActionNodeSchema: z.ZodType<ActionNode> = z.object({
	type: z.literal("action"),
	name: z.string().min(1),
	steps: z.array(StepSchema).min(1),
	retries: RetriesSchema,
});

export const CompositeNodeSchema: z.ZodType<CompositeNode> = z.object({
	type: z.enum(["sequence", "selector", "parallel"]),
	name: z.string().min(1),
	children: z.array(z.lazy(() => AbtNodeSchema)).min(1),
	retries: RetriesSchema,
});

export const AbtNodeSchema: z.ZodType<AbtNode> = z.lazy(() =>
	z.union([RefNodeSchema, ActionNodeSchema, CompositeNodeSchema]),
);

export const TreeFileSchema = z.object({
	$schema: z.string().optional(),
	name: z.string().min(1),
	version: z.string(),
	description: z.string().optional(),
	state: z
		.object({
			local: z.record(z.string(), z.unknown()).optional(),
			global: z.record(z.string(), z.unknown()).optional(),
		})
		.optional(),
	tree: AbtNodeSchema,
});

export type Step = z.infer<typeof StepSchema>;
export type TreeFile = z.infer<typeof TreeFileSchema>;

// Single source of truth for the published JSON Schema. Used at build time
// by scripts/generate-schema.ts and at runtime by `abtree schema`, so the
// CLI output and the committed tree.schema.json are byte-identical.
export function buildJsonSchema(): Record<string, unknown> {
	const schema = z.toJSONSchema(TreeFileSchema, { target: "draft-2020-12" });
	return {
		$schema: "https://json-schema.org/draft/2020-12/schema",
		$id: "https://abtree.sh/schemas/tree.schema.json",
		title: "abtree Tree File",
		description:
			"Schema for abtree behaviour-tree YAML files. Reference via `# yaml-language-server: $schema=...` or `$schema:` field.",
		...schema,
	};
}
