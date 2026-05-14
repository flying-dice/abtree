// CLI-vs-MCP bench. Drives hello-world end-to-end twice — once spawning
// the CLI subprocess per step (current flow), once via a single MCP
// server subprocess driven by tool calls. Reports wall-clock + step
// count via `console.log` so the numbers land in `bun test` output.
//
// Assertions are liveness only: both passes must reach
// `{ status: "done" }`. The actual numbers are observational; a future
// commit can promote them to thresholds once we know what good looks
// like.

import { afterAll, beforeAll, expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const CLI_PATH = resolve(import.meta.dir, "../index.ts");

let tmp: string;
let treePath: string;

beforeAll(() => {
	tmp = mkdtempSync(join(tmpdir(), "abtree-bench-"));
	const src = resolve(import.meta.dir, "../../../trees/hello-world/main.json");
	treePath = join(tmp, "main.json");
	copyFileSync(src, treePath);
});

afterAll(() => {
	rmSync(tmp, { recursive: true, force: true });
});

// ── Pass A: drive the CLI via per-step subprocesses ──────────────────────

function cliSpawn(args: string[]): { stdout: string; exitCode: number } {
	const r = Bun.spawnSync(["bun", CLI_PATH, ...args], {
		cwd: tmp,
		stdout: "pipe",
		stderr: "pipe",
	});
	return {
		stdout: new TextDecoder().decode(r.stdout).trim(),
		exitCode: r.exitCode ?? 0,
	};
}

function cliJson(args: string[]): Record<string, unknown> {
	const r = cliSpawn(args);
	expect(r.exitCode).toBe(0);
	return JSON.parse(r.stdout) as Record<string, unknown>;
}

function driveCli(): { wallNs: bigint; calls: number; done: boolean } {
	const start = Bun.nanoseconds();
	let calls = 0;
	const created = cliJson(["execution", "create", treePath, "cli-bench"]);
	calls++;
	const id = created.id as string;

	function next() {
		calls++;
		return cliJson(["next", id]);
	}
	function submit(status: "success" | "failure") {
		calls++;
		return cliJson(["submit", id, status]);
	}
	function evalStep(result: boolean) {
		calls++;
		return cliJson(["eval", id, String(result)]);
	}
	function localWrite(path: string, value: string) {
		calls++;
		cliJson(["local", "write", id, path, value]);
	}

	next(); // Acknowledge_Protocol
	submit("success");
	next(); // Determine_Time
	localWrite("time_of_day", "morning");
	submit("success");
	next(); // Spawn_Compose_Greeting
	submit("success");
	next(); // Morning_Greeting evaluate
	evalStep(true);
	next(); // Morning_Greeting instruct
	localWrite("greeting", "Good morning!");
	submit("success");
	next(); // Return_To_Parent evaluate
	evalStep(true);
	next(); // Return_To_Parent instruct
	submit("success");
	next(); // Announce_Greeting
	submit("success");
	const final = next();

	return {
		wallNs: Bun.nanoseconds() - start,
		calls,
		done: final.status === "done",
	};
}

// ── Pass B: drive the MCP server via tool calls over stdio ───────────────

async function driveMcp(): Promise<{
	wallNs: bigint;
	calls: number;
	done: boolean;
}> {
	// Time includes server startup so the comparison is honest for the
	// "one execution, one agent process" case. Sustained-use efficiency
	// would amortize startup across many executions and look even better
	// for MCP.
	const start = Bun.nanoseconds();
	const transport = new StdioClientTransport({
		command: "bun",
		args: [CLI_PATH, "mcp"],
		cwd: tmp,
	});
	const client = new Client({ name: "abtree-bench", version: "0.0.0" });
	await client.connect(transport);

	let calls = 0;

	async function call(
		name: string,
		args: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		calls++;
		const r = await client.callTool({ name, arguments: args });
		if (r.isError) {
			const content = r.content as { type: string; text: string }[];
			throw new Error(content[0]?.text ?? "tool error");
		}
		return r.structuredContent as Record<string, unknown>;
	}

	const created = await call("abtree_execution_create", {
		tree: treePath,
		summary: "mcp-bench",
	});
	const id = created.id as string;
	const next = () => call("abtree_next", { execution: id });
	const submit = (status: string) =>
		call("abtree_submit", { execution: id, status });
	const evalStep = (result: boolean) =>
		call("abtree_eval", { execution: id, result });
	const localWrite = (path: string, value: string) =>
		call("abtree_local_write", { execution: id, path, value });

	await next();
	await submit("success");
	await next();
	await localWrite("time_of_day", "morning");
	await submit("success");
	await next();
	await submit("success");
	await next();
	await evalStep(true);
	await next();
	await localWrite("greeting", "Good morning!");
	await submit("success");
	await next();
	await evalStep(true);
	await next();
	await submit("success");
	await next();
	await submit("success");
	const final = await next();

	const wallNs = Bun.nanoseconds() - start;
	await client.close();
	return { wallNs, calls, done: final.status === "done" };
}

function nsToMs(ns: bigint): string {
	return (Number(ns) / 1_000_000).toFixed(1);
}

test("bench: hello-world via CLI vs MCP — both reach done", async () => {
	const cli = driveCli();
	const mcp = await driveMcp();

	expect(cli.done).toBe(true);
	expect(mcp.done).toBe(true);

	console.log("\n┌─ MCP vs CLI bench (hello-world end-to-end) ──────────");
	console.log(
		`│  CLI : ${nsToMs(cli.wallNs)} ms  (${cli.calls} subprocess spawns)`,
	);
	console.log(
		`│  MCP : ${nsToMs(mcp.wallNs)} ms  (${mcp.calls} tool calls, 1 subprocess)`,
	);
	const ratio = Number(cli.wallNs) / Number(mcp.wallNs);
	console.log(`│  CLI / MCP = ${ratio.toFixed(2)}× wall-clock`);
	console.log("└──────────────────────────────────────────────────────");
}, 60_000);
