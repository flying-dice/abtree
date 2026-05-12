// Resolution of the string a caller passes to `loadTree(arg)` into a
// concrete YAML/JSON path + execution-ID-safe slug. The two recognised
// forms — bare slugs (`.abtree/trees/<slug>/`) and explicit paths — are
// kept here so the loader downstream can focus on file-IO + parsing.

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { TREE_SOURCES } from "./paths.ts";

export interface ResolvedTreeArg {
	yamlPath: string;
	slug: string;
}

// Result of looking up a directory's tree entry. There is intentionally no
// TREE.yaml fallback — every tree directory must either declare its entry
// via package.json:main, or the caller must pass the YAML path directly.
// Callers handle each kind to produce a context-appropriate error message.
export type EntryResolution =
	| { kind: "ok"; path: string }
	| { kind: "no-package-json"; pkgDir: string }
	| { kind: "no-main"; pkgJsonPath: string };

export function resolveEntryYaml(pkgDir: string): EntryResolution {
	const pkgJsonPath = join(pkgDir, "package.json");
	if (!existsSync(pkgJsonPath)) {
		return { kind: "no-package-json", pkgDir };
	}
	try {
		const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
			main?: unknown;
		};
		if (typeof pkg.main === "string" && pkg.main.length > 0) {
			return { kind: "ok", path: join(pkgDir, pkg.main) };
		}
	} catch {
		// Fall through — malformed JSON is reported as "no main".
	}
	return { kind: "no-main", pkgJsonPath };
}

/**
 * Resolve the user's tree argument into a (yamlPath, slug) pair.
 *
 * Slug lookup runs first (preserves backwards-compat for `.abtree/trees/<slug>/`),
 * then path lookup as a fallback so authors can pass `./TREE.yaml`,
 * `./node_modules/@acme/bt-retry`, etc.
 *
 * Returns `null` if the arg matches neither shape. Throws if the matched
 * directory exists but doesn't declare a usable entry (missing
 * `package.json` or missing `main`).
 */
export function resolveTreeArg(arg: string): ResolvedTreeArg | null {
	const asSlug = findSlugYaml(arg);
	if (asSlug) return { yamlPath: asSlug, slug: arg };

	const asPath = findPathYaml(arg);
	if (asPath) return { yamlPath: asPath, slug: deriveSlugFromYaml(asPath) };

	return null;
}

function findSlugYaml(slug: string): string | null {
	if (slug.includes("/") || slug.includes("\\")) return null;
	for (const dir of TREE_SOURCES) {
		const slugDir = join(dir, slug);
		if (!existsSync(slugDir)) continue;
		const entry = resolveEntryYaml(slugDir);
		if (entry.kind === "ok" && existsSync(entry.path)) return entry.path;
		throw missingEntryError(
			`tree slug '${slug}' resolved to '${slugDir}'`,
			entry,
		);
	}
	return null;
}

function findPathYaml(arg: string): string | null {
	const abs = isAbsolute(arg) ? arg : resolve(process.cwd(), arg);
	if (!existsSync(abs)) return null;
	const stats = statSync(abs);
	if (stats.isFile() && /\.(ya?ml)$/i.test(abs)) return abs;
	if (stats.isDirectory()) {
		const entry = resolveEntryYaml(abs);
		if (entry.kind === "ok" && existsSync(entry.path)) return entry.path;
		throw missingEntryError(`tree at '${abs}'`, entry);
	}
	return null;
}

// Builds the user-facing error for a directory that doesn't declare a usable
// tree entry. Both kinds end with the same escape hatch — pass the YAML
// path directly — so callers always know how to recover.
function missingEntryError(
	subject: string,
	entry:
		| { kind: "no-package-json"; pkgDir: string }
		| { kind: "no-main"; pkgJsonPath: string },
): Error {
	if (entry.kind === "no-package-json") {
		return new Error(
			`${subject}: no package.json found at '${entry.pkgDir}'. ` +
				`Add a package.json with a 'main' field pointing to the tree YAML, ` +
				`or pass the YAML path directly.`,
		);
	}
	return new Error(
		`${subject}: package.json at '${entry.pkgJsonPath}' has no 'main' field. ` +
			`Add a 'main' pointing to the tree YAML (e.g. "main": "TREE.yaml") ` +
			`or pass the YAML path directly.`,
	);
}

function deriveSlugFromYaml(yamlPath: string): string {
	const dir = dirname(yamlPath);
	const pkgPath = join(dir, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
				name?: string;
			};
			if (typeof pkg.name === "string" && pkg.name.length > 0) {
				return sanitiseSlug(pkg.name);
			}
		} catch {
			// Malformed package.json — fall through to the dirname-basename slug.
		}
	}
	return sanitiseSlug(basename(dir));
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
