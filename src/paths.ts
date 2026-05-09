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

// Executions directory — override with ABTREE_EXECUTIONS_DIR (absolute, relative, or ~/-prefixed).
export const EXECUTIONS_DIR = process.env.ABTREE_EXECUTIONS_DIR
	? resolve(expandHome(process.env.ABTREE_EXECUTIONS_DIR))
	: join(ABTREE_DIR, "executions");

export const HOME_ABTREE_DIR = join(homedir(), ".abtree");
export const HOME_TREES_DIR = join(HOME_ABTREE_DIR, "trees");

// Tree lookup order: project-local first, then user-global.
// First match wins, so a project tree can shadow a global one of the same slug.
export const TREE_SOURCES: readonly string[] = [TREES_DIR, HOME_TREES_DIR];

// Agent-skill install targets. Different platforms ship skills under
// different conventions; `abtree install skill` prompts the user to pick
// variant + scope (or accept --variant / --scope flags) rather than
// relying on a single env var that can't capture the variation.
export const SKILL_TARGETS = {
	claude: {
		label: "Claude Code (.claude/skills)",
		project: () => join(process.cwd(), ".claude", "skills", "abtree"),
		user: () => join(homedir(), ".claude", "skills", "abtree"),
	},
	agents: {
		label: "agentskills.io (.agents/skills)",
		project: () => join(process.cwd(), ".agents", "skills", "abtree"),
		user: () => join(homedir(), ".agents", "skills", "abtree"),
	},
} as const;

export type SkillVariant = keyof typeof SKILL_TARGETS;
export type SkillScope = "project" | "user";

export function ensureDir(dir: string) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
