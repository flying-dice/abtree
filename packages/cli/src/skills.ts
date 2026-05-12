import { homedir } from "node:os";
import { join } from "node:path";

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
