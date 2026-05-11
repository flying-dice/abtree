import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ResolverError } from "@apidevtools/json-schema-ref-parser";
import { parseNodeModulesRef } from "./parse.ts";
import type { NodeModulesRef } from "./types.ts";

const SCHEME = "node-modules:";
const NOT_FOUND_HINT = "run 'npm install' / 'pnpm install' / 'bun install'";

// Result of looking up a directory's tree entry. There is intentionally
// NO TREE.yaml fallback — every tree directory must either declare its
// entry via package.json:main, or the caller must pass the YAML path
// directly. Callers handle each kind to produce a context-appropriate
// error message.
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

export function findNodeModulesPkg(
	startDir: string,
	pkgName: string,
): string | null {
	let dir = startDir;
	while (true) {
		const candidate = join(dir, "node_modules", pkgName);
		if (existsSync(candidate)) return candidate;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

export function makeNodeModulesResolver(yamlPath: string) {
	const initialDir = dirname(yamlPath);
	const urlToPkgDir = new Map<string, string>();
	return {
		order: 200,
		canRead: (file: { url: string }) => file.url.startsWith(SCHEME),
		read: async (file: { url: string; baseUrl?: string }) => {
			try {
				return await resolve(file, initialDir, urlToPkgDir);
			} catch (err) {
				if (err instanceof ResolverError) throw err;
				throw new ResolverError(err as Error, file.url);
			}
		},
	};
}

async function resolve(
	file: { url: string; baseUrl?: string },
	initialDir: string,
	urlToPkgDir: Map<string, string>,
): Promise<Buffer> {
	const ref = parseNodeModulesRef(file.url);
	const startDir = startDirFor(file.baseUrl, urlToPkgDir) ?? initialDir;
	const pkgDir = findNodeModulesPkg(startDir, ref.pkgName);
	if (!pkgDir) {
		throw new Error(
			`module '${file.url}' not found in node_modules/; ${NOT_FOUND_HINT}`,
		);
	}
	const target = targetFor(file.url, ref, pkgDir);
	if (!existsSync(target)) {
		throw new Error(
			`module '${file.url}' resolved to '${target}' but the file does not exist`,
		);
	}
	urlToPkgDir.set(file.url, pkgDir);
	return await readFile(target);
}

// Sub-path refs (e.g. `node-modules:foo/fragments/x.yaml`) load the named
// file verbatim. A bare ref (`node-modules:foo`) consults the package's
// `main` field — there is no implicit TREE.yaml default. Authors must
// declare an entry point or consumers must reference a sub-path.
function targetFor(url: string, ref: NodeModulesRef, pkgDir: string): string {
	if (ref.subPath) return join(pkgDir, ref.subPath);
	const entry = resolveEntryYaml(pkgDir);
	if (entry.kind === "ok") return entry.path;
	if (entry.kind === "no-package-json") {
		throw new Error(
			`module '${url}': package at '${entry.pkgDir}' has no package.json. ` +
				`Add a package.json with a 'main' field pointing to the tree YAML, ` +
				`or use a sub-path ref like 'node-modules:${ref.pkgName}/<file>.yaml'.`,
		);
	}
	throw new Error(
		`module '${url}': package.json at '${entry.pkgJsonPath}' has no 'main' field. ` +
			`Add a 'main' pointing to the tree YAML (e.g. "main": "TREE.yaml") ` +
			`or use a sub-path ref like 'node-modules:${ref.pkgName}/<file>.yaml'.`,
	);
}

function startDirFor(
	baseUrl: string | undefined,
	urlToPkgDir: Map<string, string>,
): string | undefined {
	if (!baseUrl) return undefined;
	const bareUrl = baseUrl.split("#")[0];
	return bareUrl ? urlToPkgDir.get(bareUrl) : undefined;
}
