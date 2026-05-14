import { homedir } from "node:os";
import { join } from "node:path";

// MCP client config targets. `abtree install mcp stdio` writes the
// abtree server entry into whichever of these the user picks. Paths are
// resolved lazily (via callback) so the table can be used in
// non-runtime contexts (tests, completion) without firing the
// platform-specific lookups.
//
// Targets are merged into existing config — never overwritten — so the
// user's other MCP servers are left alone.
export const MCP_TARGETS = {
	"claude-code-project": {
		label: "Claude Code — project (./.mcp.json)",
		path: () => join(process.cwd(), ".mcp.json"),
	},
	"claude-code-user": {
		label: "Claude Code — user (~/.claude.json)",
		path: () => join(homedir(), ".claude.json"),
	},
	"claude-desktop": {
		label: "Claude Desktop (platform-specific user config)",
		path: () => claudeDesktopConfigPath(),
	},
} as const;

export type McpTarget = keyof typeof MCP_TARGETS;

function claudeDesktopConfigPath(): string {
	if (process.platform === "darwin") {
		return join(
			homedir(),
			"Library",
			"Application Support",
			"Claude",
			"claude_desktop_config.json",
		);
	}
	if (process.platform === "win32") {
		const appData =
			process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
		return join(appData, "Claude", "claude_desktop_config.json");
	}
	throw new Error(
		"Claude Desktop has no standard config path on this platform. Use --target claude-code-project or claude-code-user instead.",
	);
}
