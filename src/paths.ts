import { resolve, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export const ABT_DIR = resolve(process.cwd(), ".abt");
export const TREES_DIR = join(ABT_DIR, "trees");
export const FLOWS_DIR = join(ABT_DIR, "flows");

export function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
