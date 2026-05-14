// CLI argument parsers. Each one inspects a raw `argv` string, validates it,
// and calls `die()` on bad input — i.e. writes to stderr and `process.exit(1)`.
//
// They live in the CLI package (not the runtime) because the `die()` failure
// mode is a CLI concern: a library consumer importing `@abtree/runtime`
// shouldn't have its process killed by a malformed argument string.
//
// Runtime-side validation (e.g. `validateTreeFile`) throws plain `Error`s
// so embedders can catch them; the CLI wraps those throws and calls `die()`
// at the boundary (see `cmdExecutionCreate`).

import { die } from "@abtree/runtime";

export function parseExecutionId(val: string): string {
	if (!val || typeof val !== "string") die("Execution ID is required");
	return val;
}

export function parseTreePath(val: string): string {
	if (!val || typeof val !== "string") die("Tree file path is required");
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

export function parseNote(val?: string): string | undefined {
	if (typeof val !== "string") return undefined;
	const t = val.trim();
	return t.length === 0 ? undefined : t;
}
