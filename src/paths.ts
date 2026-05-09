import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const ABTREE_DIR = resolve(process.cwd(), ".abtree");
export const TREES_DIR = join(ABTREE_DIR, "trees");
export const FLOWS_DIR = join(ABTREE_DIR, "flows");

export function ensureDir(dir: string) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
