import type { z } from "zod";
import { TreeFileSchema } from "./schemas.ts";
import type {
	AbtNode,
	NormalizedNode,
	NormalizedStep,
	Step,
	TreeFile,
} from "./types.ts";
import { die } from "./utils.ts";

export function parseExecutionId(val: string): string {
	if (!val || typeof val !== "string") die("Execution ID is required");
	return val;
}

export function parseTreeSlug(val: string): string {
	if (!val || typeof val !== "string") die("Tree slug is required");
	return val;
}

export function parseSummary(val: string): string {
	if (!val || typeof val !== "string") die("Summary is required");
	return val;
}

export function parseScopePath(val: string): string {
	if (!val || typeof val !== "string") die("Path is required");
	return val;
}

export function parseEvalResult(val: string): boolean {
	if (val !== "true" && val !== "false")
		die('Result must be "true" or "false"');
	return val === "true";
}

export function parseSubmitStatus(
	val: string,
): "success" | "failure" | "running" {
	if (val !== "success" && val !== "failure" && val !== "running")
		die('Status must be "success", "failure", or "running"');
	return val as "success" | "failure" | "running";
}

export function validateTreeFile(raw: unknown): TreeFile {
	const result = TreeFileSchema.safeParse(raw);
	if (!result.success) {
		const issues = result.error.issues
			.map((i: z.core.$ZodIssue) => {
				const path = i.path.length ? i.path.join(".") : "(root)";
				return `  ${path}: ${i.message}`;
			})
			.join("\n");
		die(`tree file failed validation:\n${issues}`);
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
