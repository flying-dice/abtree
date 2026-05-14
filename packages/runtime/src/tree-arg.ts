// Resolution of the string a caller passes to `loadTree(arg)` into a
// concrete YAML/JSON path. The argument must resolve to an existing file
// whose extension is `.json`, `.yaml`, or `.yml`. There is no slug
// lookup, no `package.json:main` inference, and no conventional-filename
// probing — the caller hands in a literal reference; the runtime
// accepts it or refuses it.

import { existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export interface ResolvedTreeArg {
	yamlPath: string;
}

const TREE_FILE_RE = /\.(ya?ml|json)$/i;

export function resolveTreeArg(arg: string): ResolvedTreeArg | null {
	const abs = isAbsolute(arg) ? arg : resolve(process.cwd(), arg);
	if (!existsSync(abs)) return null;
	if (!statSync(abs).isFile()) return null;
	if (!TREE_FILE_RE.test(abs)) return null;
	return { yamlPath: abs };
}

// Execution IDs must match /^[a-z0-9_-]+__[a-z0-9_-]+__\d+$/ (see repos.ts).
// Any character that doesn't fit becomes a hyphen, and the result is trimmed
// of leading/trailing hyphens so an `@scope/name` package collapses cleanly to
// `scope-name`.
export function sanitiseSlug(raw: string): string {
	const cleaned = raw
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return cleaned.length > 0 ? cleaned : "tree";
}
