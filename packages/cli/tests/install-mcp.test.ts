// Tests for `abtree install mcp stdio`.
//
// `mergeMcpEntry` is a pure function — covered with unit tests that don't
// touch disk. The end-to-end behaviour (resolving target paths + writing
// JSON) is exercised by spawning `abtree install mcp stdio --target …`
// into a temp HOME so the user's real config files are untouched.

import { afterAll, beforeAll, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mergeMcpEntry } from "../src/commands.ts";

const CLI_PATH = resolve(import.meta.dir, "../index.ts");

let tmp: string;
let tmpHome: string;

beforeAll(() => {
	tmp = mkdtempSync(join(tmpdir(), "abtree-install-mcp-"));
	tmpHome = join(tmp, "home");
	mkdirSync(tmpHome, { recursive: true });
});

afterAll(() => {
	rmSync(tmp, { recursive: true, force: true });
});

function abtree(
	args: string[],
	cwd: string,
): { stdout: string; stderr: string; exitCode: number } {
	const r = Bun.spawnSync(["bun", CLI_PATH, ...args], {
		cwd,
		// Override HOME so user-scoped targets land inside the temp dir.
		env: { ...process.env, HOME: tmpHome },
		stdout: "pipe",
		stderr: "pipe",
	});
	return {
		stdout: new TextDecoder().decode(r.stdout).trim(),
		stderr: new TextDecoder().decode(r.stderr).trim(),
		exitCode: r.exitCode ?? 0,
	};
}

test("mergeMcpEntry adds an entry to an empty config", () => {
	const merged = mergeMcpEntry({}, "abtree", {
		command: "abtree",
		args: ["mcp"],
	});
	expect(merged.mcpServers).toEqual({
		abtree: { command: "abtree", args: ["mcp"] },
	});
});

test("mergeMcpEntry preserves existing servers", () => {
	const existing = {
		mcpServers: {
			"some-other-server": { command: "other", args: ["serve"] },
		},
	};
	const merged = mergeMcpEntry(existing, "abtree", {
		command: "abtree",
		args: ["mcp"],
	});
	expect(merged.mcpServers).toEqual({
		"some-other-server": { command: "other", args: ["serve"] },
		abtree: { command: "abtree", args: ["mcp"] },
	});
});

test("mergeMcpEntry overwrites a same-named entry", () => {
	const existing = {
		mcpServers: { abtree: { command: "stale-path", args: ["old"] } },
	};
	const merged = mergeMcpEntry(existing, "abtree", {
		command: "abtree",
		args: ["mcp"],
	});
	expect(merged.mcpServers?.abtree).toEqual({
		command: "abtree",
		args: ["mcp"],
	});
});

test("mergeMcpEntry leaves non-mcpServers config keys untouched", () => {
	const existing = {
		mcpServers: {},
		theme: "dark",
		other: { nested: true },
	} as Record<string, unknown>;
	const merged = mergeMcpEntry(existing, "abtree", {
		command: "abtree",
		args: ["mcp"],
	}) as Record<string, unknown>;
	expect(merged.theme).toBe("dark");
	expect(merged.other).toEqual({ nested: true });
});

test("install mcp stdio --target claude-code-project writes ./.mcp.json", () => {
	const cwd = join(tmp, "proj-fresh");
	mkdirSync(cwd, { recursive: true });
	const r = abtree(
		["install", "mcp", "stdio", "--target", "claude-code-project"],
		cwd,
	);
	expect(r.exitCode).toBe(0);

	const configPath = join(cwd, ".mcp.json");
	expect(existsSync(configPath)).toBe(true);
	const config = JSON.parse(readFileSync(configPath, "utf8")) as {
		mcpServers: Record<string, { command: string; args: string[] }>;
	};
	expect(config.mcpServers.abtree).toEqual({
		command: "abtree",
		args: ["mcp"],
	});
});

test("install mcp stdio --target ... preserves existing mcpServers entries", () => {
	const cwd = join(tmp, "proj-existing");
	mkdirSync(cwd, { recursive: true });
	writeFileSync(
		join(cwd, ".mcp.json"),
		JSON.stringify({
			mcpServers: {
				"some-other-server": { command: "other", args: ["serve"] },
			},
		}),
	);

	const r = abtree(
		["install", "mcp", "stdio", "--target", "claude-code-project"],
		cwd,
	);
	expect(r.exitCode).toBe(0);

	const config = JSON.parse(readFileSync(join(cwd, ".mcp.json"), "utf8")) as {
		mcpServers: Record<string, unknown>;
	};
	expect(config.mcpServers["some-other-server"]).toEqual({
		command: "other",
		args: ["serve"],
	});
	expect(config.mcpServers.abtree).toEqual({
		command: "abtree",
		args: ["mcp"],
	});
});

test("install mcp stdio --command <path> overrides the launch command", () => {
	const cwd = join(tmp, "proj-custom-command");
	mkdirSync(cwd, { recursive: true });
	const r = abtree(
		[
			"install",
			"mcp",
			"stdio",
			"--target",
			"claude-code-project",
			"--command",
			"/opt/abtree/bin/abtree",
		],
		cwd,
	);
	expect(r.exitCode).toBe(0);

	const config = JSON.parse(readFileSync(join(cwd, ".mcp.json"), "utf8")) as {
		mcpServers: { abtree: { command: string } };
	};
	expect(config.mcpServers.abtree.command).toBe("/opt/abtree/bin/abtree");
});

test("install mcp stdio --target claude-code-user writes ~/.claude.json", () => {
	const cwd = join(tmp, "proj-user");
	mkdirSync(cwd, { recursive: true });
	const r = abtree(
		["install", "mcp", "stdio", "--target", "claude-code-user"],
		cwd,
	);
	expect(r.exitCode).toBe(0);

	const userConfig = join(tmpHome, ".claude.json");
	expect(existsSync(userConfig)).toBe(true);
	const config = JSON.parse(readFileSync(userConfig, "utf8")) as {
		mcpServers: Record<string, unknown>;
	};
	expect(config.mcpServers.abtree).toEqual({
		command: "abtree",
		args: ["mcp"],
	});
});

test("install mcp stdio --target rejects an unknown target", () => {
	const cwd = join(tmp, "proj-bad-target");
	mkdirSync(cwd, { recursive: true });
	const r = abtree(
		["install", "mcp", "stdio", "--target", "no-such-target"],
		cwd,
	);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain("Unknown target");
});
