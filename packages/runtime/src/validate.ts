// Runtime-side tree-file validation and normalisation.
//
// `validateTreeFile` throws plain `Error`s so embedders can catch them.
// The CLI wraps the throw at the boundary (see `cmdExecutionCreate`); it
// is NOT the runtime's job to terminate the process. CLI input parsers
// live separately in `packages/cli/src/parse-args.ts`.

import type { z } from "zod";
import { TreeFileSchema } from "./schemas.ts";
import type {
	AbtNode,
	NormalizedNode,
	NormalizedStep,
	Step,
	TreeFile,
} from "./types.ts";

export function validateTreeFile(raw: unknown): TreeFile {
	const result = TreeFileSchema.safeParse(raw);
	if (!result.success) {
		const issues = result.error.issues
			.map((i: z.core.$ZodIssue) => {
				const path = i.path.length ? i.path.join(".") : "(root)";
				return `  ${path}: ${i.message}`;
			})
			.join("\n");
		throw new Error(`tree file failed validation:\n${issues}`);
	}
	return result.data;
}

export function normalizeStep(step: Step): NormalizedStep {
	if ("evaluate" in step)
		return { kind: "evaluate", expression: step.evaluate.trim() };
	return { kind: "instruct", instruction: step.instruct.trim() };
}

export function normalizeNode(node: AbtNode): NormalizedNode {
	if ("$ref" in node) {
		return { type: "ref", ref: node.$ref };
	}
	if (node.type === "action") {
		return {
			type: "action",
			name: node.name,
			steps: node.steps.map(normalizeStep),
			...(node.retries !== undefined ? { retries: node.retries } : {}),
		};
	}
	return {
		type: node.type,
		name: node.name,
		children: node.children.map(normalizeNode),
		...(node.retries !== undefined ? { retries: node.retries } : {}),
	};
}
