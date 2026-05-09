import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

function expandHome(p: string): string {
	if (p === "~") return homedir();
	if (p.startsWith("~/")) return join(homedir(), p.slice(2));
	return p;
}

export const ABTREE_DIR = resolve(process.cwd(), ".abtree");
export const TREES_DIR = join(ABTREE_DIR, "trees");

// Flows directory — override with ABTREE_FLOWS_DIR (absolute, relative, or ~/-prefixed).
export const FLOWS_DIR = process.env.ABTREE_FLOWS_DIR
	? resolve(expandHome(process.env.ABTREE_FLOWS_DIR))
	: join(ABTREE_DIR, "flows");

export const HOME_ABTREE_DIR = join(homedir(), ".abtree");
export const HOME_TREES_DIR = join(HOME_ABTREE_DIR, "trees");

// Tree lookup order: project-local first, then user-global.
// First match wins, so a project tree can shadow a global one of the same slug.
export const TREE_SOURCES: readonly string[] = [TREES_DIR, HOME_TREES_DIR];

export function ensureDir(dir: string) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
