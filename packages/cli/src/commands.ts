import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import {
	decodeCursor,
	die,
	type ExecutionDoc,
	ExecutionStore,
	encodeCursor,
	ensureDir,
	generateExecutionId,
	getNodeAtPath,
	INITIAL_CURSOR,
	loadTree,
	type NormalizedNode,
	NULL_CURSOR,
	out,
	renderTreeSvg,
	setNodeResult,
	setStepIndex,
	type TickResult,
	type TraceKind,
	TreeSnapshotStore,
	tickRoot,
} from "@abtree/runtime";
import { select } from "@inquirer/prompts";
import EXECUTE_DOC from "../../../docs/agents/execute.md" with { type: "text" };
import { MCP_TARGETS, type McpTarget } from "./mcp-targets.ts";
import { SKILL_TARGETS, type SkillScope, type SkillVariant } from "./skills.ts";
import {
	assetUrl,
	compareVersions,
	detectTarget,
	downloadAsset,
	fetchLatestTag,
	installBinary,
	isWritable,
	realpathExec,
	tmpPath,
} from "./upgrade.ts";
import { VERSION } from "./version.ts";

// Each abtree-loop command is split into a pair:
//
//   coreX(...) → returns the payload that would be printed, throws Error on
//                failure. The MCP server consumes these directly.
//   cmdX(...)  → thin commander wrapper. Calls coreX, prints the payload via
//                `out()`, translates thrown errors via `die()`.
//
// Non-loop commands (`docs`, `install-skill`, `render`, `upgrade`) do not
// have a `core*` counterpart — they are not in the MCP tool set and stay
// CLI-only.

export function cmdDocs(content: string) {
	process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
}

export async function coreExecutionCreate(treeArg: string, summary: string) {
	let loaded: Awaited<ReturnType<typeof loadTree>>;
	try {
		loaded = await loadTree(treeArg);
	} catch (err) {
		throw new Error((err as Error).message);
	}
	if (!loaded) throw new Error(`tree file '${treeArg}' not found`);

	const { slug, parsed } = loaded;
	const id = generateExecutionId(slug, summary);
	const now = new Date().toISOString();

	ExecutionStore.create({
		id,
		tree: slug,
		summary,
		status: "running",
		snapshot: TreeSnapshotStore.put(parsed),
		cursor: INITIAL_CURSOR,
		phase: "idle",
		protocol_accepted: false,
		trace: [],
		created_at: now,
		updated_at: now,
	});

	ExecutionStore.replaceScope(id, "local", parsed.local);
	ExecutionStore.replaceScope(id, "global", parsed.global);

	return {
		id,
		tree: slug,
		summary,
		local: parsed.local,
		global: parsed.global,
	};
}

export async function cmdExecutionCreate(treeArg: string, summary: string) {
	try {
		out(await coreExecutionCreate(treeArg, summary));
	} catch (err) {
		die((err as Error).message);
	}
}

export function coreExecutionList() {
	return ExecutionStore.list().map((d) => ({
		id: d.id,
		tree: d.tree,
		summary: d.summary,
		status: d.status,
		phase: d.phase,
	}));
}

export function cmdExecutionList() {
	out(coreExecutionList());
}

export function coreExecutionGet(executionId: string) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) throw new Error(`Execution '${executionId}' not found`);
	return doc;
}

export function cmdExecutionGet(executionId: string) {
	try {
		out(coreExecutionGet(executionId));
	} catch (err) {
		die((err as Error).message);
	}
}

export function coreExecutionReset(executionId: string) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) throw new Error(`Execution '${executionId}' not found`);
	const treeDef = TreeSnapshotStore.get(doc.snapshot);
	ExecutionStore.replaceScope(executionId, "local", treeDef.local ?? {});
	ExecutionStore.update(executionId, {
		status: "running",
		cursor: INITIAL_CURSOR,
		phase: "idle",
		protocol_accepted: false,
		trace: [],
	});
	return { status: "reset" };
}

export function cmdExecutionReset(executionId: string) {
	try {
		out(coreExecutionReset(executionId));
	} catch (err) {
		die((err as Error).message);
	}
}

const PROTOCOL_GATE_NAME = "Acknowledge_Protocol";

// Append one audit entry to execution.trace. Always called *after* the engine
// mutation completes — but `cursor` and `name` must be captured by the caller
// *before* the mutation, so the entry records the agent's view, not the
// engine's post-advance view.
function appendTrace(
	executionId: string,
	kind: TraceKind,
	cursor: string,
	name: string,
	submitted: string,
	outcome: string,
	note?: string,
): void {
	ExecutionStore.appendTrace(executionId, {
		ts: new Date().toISOString(),
		kind,
		cursor,
		name,
		submitted,
		outcome,
		...(note ? { note } : {}),
	});
}

function buildProtocolGate() {
	return {
		type: "instruct",
		name: PROTOCOL_GATE_NAME,
		instruction:
			"Read the runtime protocol below in full. It is the binding contract " +
			"for the rest of this execution — in particular, all $LOCAL/$GLOBAL " +
			"reads must go through `abtree local read` / `abtree global read`, " +
			"never from your own context. Submit success to acknowledge and proceed; " +
			"submit failure to abort.\n\n---\n\n" +
			EXECUTE_DOC,
	};
}

// coreNext is a small dispatcher. Each phase / outcome has its own helper
// that returns the response payload; the dispatcher returns whichever fired.

function runProtocolPhase(executionId: string, doc: ExecutionDoc) {
	// Gate already rejected: don't re-prompt; surface the terminal status.
	if (doc.status === "failed") return { status: "failure" };
	if (doc.phase !== "protocol") {
		ExecutionStore.update(executionId, {
			phase: "protocol",
			cursor: NULL_CURSOR,
		});
	}
	return buildProtocolGate();
}

function buildReplayResponse(treeRoot: NormalizedNode, doc: ExecutionDoc) {
	const cursor = decodeCursor(doc.cursor);
	if (!cursor) throw new Error("cursor missing");
	const node = getNodeAtPath(treeRoot, cursor.path);
	if (node.type !== "action")
		throw new Error("cursor points to non-action node");
	const step = node.steps[cursor.step];
	if (!step) throw new Error(`cursor.step out of range for phase ${doc.phase}`);
	if (doc.phase === "evaluating" && step.kind === "evaluate") {
		return { type: "evaluate", name: node.name, expression: step.expression };
	}
	if (doc.phase === "performing" && step.kind === "instruct") {
		return { type: "instruct", name: node.name, instruction: step.instruction };
	}
	throw new Error(`cursor.step wrong kind for phase ${doc.phase}`);
}

function applyTickResult(executionId: string, result: TickResult) {
	if (result.type === "done") {
		ExecutionStore.update(executionId, {
			status: "complete",
			phase: "idle",
			cursor: NULL_CURSOR,
		});
		return { status: "done" };
	}
	if (result.type === "failure") {
		ExecutionStore.update(executionId, {
			status: "failed",
			phase: "idle",
			cursor: NULL_CURSOR,
		});
		return { status: "failure" };
	}
	const cur = encodeCursor({ path: result.path, step: result.step });
	if (result.type === "evaluate") {
		ExecutionStore.update(executionId, {
			status: "running",
			phase: "evaluating",
			cursor: cur,
		});
		return {
			type: "evaluate",
			name: result.name,
			expression: result.expression,
		};
	}
	// result.type === "instruct"
	ExecutionStore.update(executionId, {
		status: "running",
		phase: "performing",
		cursor: cur,
	});
	return {
		type: "instruct",
		name: result.name,
		instruction: result.instruction,
	};
}

export function coreNext(executionId: string) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) throw new Error(`Execution '${executionId}' not found`);

	if (!doc.protocol_accepted) {
		return runProtocolPhase(executionId, doc);
	}

	const treeDef = TreeSnapshotStore.get(doc.snapshot);

	if (doc.phase === "evaluating" || doc.phase === "performing") {
		return buildReplayResponse(treeDef.root, doc);
	}

	return applyTickResult(executionId, tickRoot(executionId, treeDef.root));
}

export function cmdNext(executionId: string) {
	try {
		out(coreNext(executionId));
	} catch (err) {
		die((err as Error).message);
	}
}

export function coreEval(executionId: string, result: boolean, note?: string) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) throw new Error(`Execution '${executionId}' not found`);
	if (doc.phase !== "evaluating")
		throw new Error(
			`Execution is not in evaluating phase (current: ${doc.phase})`,
		);

	const cursor = decodeCursor(doc.cursor);
	if (!cursor) throw new Error("cursor missing");
	const path: number[] = cursor.path;
	const stepIdx: number = cursor.step;

	const cursorBefore = doc.cursor;
	const treeDef = TreeSnapshotStore.get(doc.snapshot);
	const node = getNodeAtPath(treeDef.root, path);
	if (node.type === "ref") throw new Error("cursor points to ref node");
	const nodeName = node.name;

	if (result) {
		setStepIndex(executionId, path, stepIdx + 1);
		ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
		appendTrace(
			executionId,
			"evaluate",
			cursorBefore,
			nodeName,
			"true",
			"evaluation_passed",
			note,
		);
		return {
			status: "evaluation_passed",
			message: "Precondition met. Advancing.",
		};
	}
	setNodeResult(executionId, path, "failure");
	ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
	appendTrace(
		executionId,
		"evaluate",
		cursorBefore,
		nodeName,
		"false",
		"evaluation_failed",
		note,
	);
	return {
		status: "evaluation_failed",
		message: "Precondition not met. Action failed.",
	};
}

export function cmdEval(executionId: string, result: boolean, note?: string) {
	try {
		out(coreEval(executionId, result, note));
	} catch (err) {
		die((err as Error).message);
	}
}

function runProtocolSubmit(
	executionId: string,
	doc: ExecutionDoc,
	status: "success" | "failure" | "running",
	note?: string,
) {
	const cursorBefore = doc.cursor;
	const submitted =
		status === "success"
			? "accept"
			: status === "failure"
				? "reject"
				: "running";

	if (status === "running") {
		appendTrace(
			executionId,
			"protocol",
			cursorBefore,
			PROTOCOL_GATE_NAME,
			submitted,
			"running",
			note,
		);
		return {
			status: "running",
			message: "Acknowledged. Call next when ready to continue.",
		};
	}
	if (status === "success") {
		ExecutionStore.update(executionId, {
			protocol_accepted: true,
			phase: "idle",
			cursor: NULL_CURSOR,
		});
		appendTrace(
			executionId,
			"protocol",
			cursorBefore,
			PROTOCOL_GATE_NAME,
			submitted,
			"protocol_accepted",
			note,
		);
		return {
			status: "protocol_accepted",
			message: "Protocol acknowledged. Call next to begin the tree.",
		};
	}
	ExecutionStore.update(executionId, {
		status: "failed",
		phase: "idle",
		cursor: NULL_CURSOR,
	});
	appendTrace(
		executionId,
		"protocol",
		cursorBefore,
		PROTOCOL_GATE_NAME,
		submitted,
		"protocol_rejected",
		note,
	);
	return {
		status: "protocol_rejected",
		message: "Protocol not acknowledged. Execution aborted.",
	};
}

function runPerformingSubmit(
	executionId: string,
	doc: ExecutionDoc,
	status: "success" | "failure" | "running",
	note?: string,
) {
	const cursor = decodeCursor(doc.cursor);
	if (!cursor) throw new Error("cursor missing");
	const path: number[] = cursor.path;
	const stepIdx: number = cursor.step;

	const cursorBefore = doc.cursor;
	const treeDef = TreeSnapshotStore.get(doc.snapshot);
	const node = getNodeAtPath(treeDef.root, path);
	if (node.type !== "action")
		throw new Error("cursor points to non-action node");
	const nodeName = node.name;

	if (status === "running") {
		appendTrace(
			executionId,
			"instruct",
			cursorBefore,
			nodeName,
			"running",
			"running",
			note,
		);
		return {
			status: "running",
			message: "Acknowledged. Call next when ready to continue.",
		};
	}

	if (status === "failure") {
		setNodeResult(executionId, path, "failure");
		ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
		appendTrace(
			executionId,
			"instruct",
			cursorBefore,
			nodeName,
			"failure",
			"action_failed",
			note,
		);
		return {
			status: "action_failed",
			message: "Instruction failed. Action marked as failure.",
		};
	}

	const nextStep = stepIdx + 1;

	if (nextStep >= node.steps.length) {
		setNodeResult(executionId, path, "success");
		ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
		appendTrace(
			executionId,
			"instruct",
			cursorBefore,
			nodeName,
			"success",
			"action_complete",
			note,
		);
		return {
			status: "action_complete",
			message: "All steps done. Action succeeded.",
		};
	}
	setStepIndex(executionId, path, nextStep);
	ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
	appendTrace(
		executionId,
		"instruct",
		cursorBefore,
		nodeName,
		"success",
		"step_complete",
		note,
	);
	return { status: "step_complete", message: "Step done. More steps remain." };
}

export function coreSubmit(
	executionId: string,
	status: "success" | "failure" | "running",
	note?: string,
) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) throw new Error(`Execution '${executionId}' not found`);

	if (doc.phase === "protocol") {
		return runProtocolSubmit(executionId, doc, status, note);
	}

	if (doc.phase !== "performing")
		throw new Error(
			`Execution is not in performing phase (current: ${doc.phase})`,
		);

	return runPerformingSubmit(executionId, doc, status, note);
}

export function cmdSubmit(
	executionId: string,
	status: "success" | "failure" | "running",
	note?: string,
) {
	try {
		out(coreSubmit(executionId, status, note));
	} catch (err) {
		die((err as Error).message);
	}
}

export function coreLocalRead(executionId: string, path?: string) {
	if (path) {
		return { path, value: ExecutionStore.getScope(executionId, "local", path) };
	}
	return ExecutionStore.getScope(executionId, "local");
}

export function cmdLocalRead(executionId: string, path?: string) {
	try {
		out(coreLocalRead(executionId, path));
	} catch (err) {
		die((err as Error).message);
	}
}

export function coreLocalWrite(
	executionId: string,
	path: string,
	value: string,
) {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		parsed = value;
	}
	ExecutionStore.setScope(executionId, "local", path, parsed);
	return { path, value: parsed };
}

export function cmdLocalWrite(
	executionId: string,
	path: string,
	value: string,
) {
	try {
		out(coreLocalWrite(executionId, path, value));
	} catch (err) {
		die((err as Error).message);
	}
}

export function coreGlobalRead(executionId: string, path?: string) {
	if (path) {
		return {
			path,
			value: ExecutionStore.getScope(executionId, "global", path),
		};
	}
	return ExecutionStore.getScope(executionId, "global");
}

export function cmdGlobalRead(executionId: string, path?: string) {
	try {
		out(coreGlobalRead(executionId, path));
	} catch (err) {
		die((err as Error).message);
	}
}

export async function cmdInstallSkill(
	skillContent: string,
	opts: { variant?: string; scope?: string } = {},
) {
	const variant = await resolveVariant(opts.variant);
	const scope = await resolveScope(opts.scope);
	const target = SKILL_TARGETS[variant];
	const dir = scope === "project" ? target.project() : target.user();
	ensureDir(dir);
	const path = join(dir, "SKILL.md");
	writeFileSync(path, skillContent);
	out({ variant, scope, path });
}

async function resolveVariant(flag?: string): Promise<SkillVariant> {
	const valid = Object.keys(SKILL_TARGETS) as SkillVariant[];
	if (flag) {
		if (!valid.includes(flag as SkillVariant)) {
			die(`Unknown variant '${flag}'. Valid: ${valid.join(", ")}`);
		}
		return flag as SkillVariant;
	}
	return (await select({
		message: "Which agent platform are you targeting?",
		choices: valid.map((v) => ({
			name: SKILL_TARGETS[v].label,
			value: v,
		})),
	})) as SkillVariant;
}

async function resolveScope(flag?: string): Promise<SkillScope> {
	const valid: SkillScope[] = ["project", "user"];
	if (flag) {
		if (!valid.includes(flag as SkillScope)) {
			die(`Unknown scope '${flag}'. Valid: ${valid.join(", ")}`);
		}
		return flag as SkillScope;
	}
	return (await select({
		message: "Install scope?",
		choices: [
			{ name: "Project — current directory", value: "project" },
			{ name: "User — home directory", value: "user" },
		],
	})) as SkillScope;
}

// ── MCP server install ──────────────────────────────────────────────────

interface McpServerEntry {
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

interface McpConfigShape {
	mcpServers?: Record<string, McpServerEntry>;
}

// Pure merge: returns the new config object without touching disk.
// Exported for unit-testability — the install command is just I/O around
// this function.
export function mergeMcpEntry(
	existing: McpConfigShape,
	name: string,
	entry: McpServerEntry,
): McpConfigShape {
	const next: McpConfigShape = { ...existing };
	next.mcpServers = { ...(existing.mcpServers ?? {}), [name]: entry };
	return next;
}

export async function cmdInstallMcpStdio(
	opts: { target?: string; command?: string } = {},
) {
	const target = await resolveMcpTarget(opts.target);
	const path = MCP_TARGETS[target].path();
	ensureDir(dirname(path));

	const existing: McpConfigShape = existsSync(path)
		? parseJsonObject(readFileSync(path, "utf8"), path)
		: {};

	const entry: McpServerEntry = {
		command: opts.command ?? "abtree",
		args: ["mcp"],
	};

	const merged = mergeMcpEntry(existing, "abtree", entry);
	writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);
	out({ target, path, server: entry });
}

function parseJsonObject(raw: string, path: string): McpConfigShape {
	try {
		const parsed = JSON.parse(raw);
		if (
			parsed === null ||
			typeof parsed !== "object" ||
			Array.isArray(parsed)
		) {
			die(`Config at ${path} is not a JSON object`);
		}
		return parsed as McpConfigShape;
	} catch (err) {
		die(`Failed to parse JSON at ${path}: ${(err as Error).message}`);
	}
}

async function resolveMcpTarget(flag?: string): Promise<McpTarget> {
	const valid = Object.keys(MCP_TARGETS) as McpTarget[];
	if (flag) {
		if (!valid.includes(flag as McpTarget)) {
			die(`Unknown target '${flag}'. Valid: ${valid.join(", ")}`);
		}
		return flag as McpTarget;
	}
	return (await select({
		message: "Which MCP client are you registering with?",
		choices: valid.map((v) => ({
			name: MCP_TARGETS[v].label,
			value: v,
		})),
	})) as McpTarget;
}

async function readLine(): Promise<string> {
	return new Promise((resolve) => {
		process.stdin.setEncoding("utf8");
		let buf = "";
		const onData = (chunk: string) => {
			const nl = chunk.indexOf("\n");
			if (nl !== -1) {
				buf += chunk.slice(0, nl);
				process.stdin.removeListener("data", onData);
				process.stdin.pause();
				resolve(buf.replace(/\r$/, ""));
			} else {
				buf += chunk;
			}
		};
		process.stdin.on("data", onData);
		process.stdin.resume();
	});
}

export async function cmdUpgrade(
	opts: {
		check?: boolean;
		version?: string;
		yes?: boolean;
	},
	fetchFn: typeof fetch = globalThis.fetch,
): Promise<void> {
	const current = `v${VERSION}`;

	let target: ReturnType<typeof detectTarget>;
	try {
		target = detectTarget();
	} catch (err) {
		process.stderr.write(`${(err as Error).message}\n`);
		process.exit(3);
	}

	let execPath = "";
	let installDir = "";
	if (!opts.check) {
		execPath = realpathExec();
		installDir = dirname(execPath);
		if (!isWritable(installDir)) {
			const tmp = tmpPath(installDir);
			process.stderr.write(
				`Install directory ${installDir} is not writable.\n`,
			);
			process.stderr.write(`sudo mv ${tmp} ${execPath}\n`);
			process.exit(1);
		}
	}

	let latest: string;
	if (opts.version) {
		latest = opts.version.startsWith("v") ? opts.version : `v${opts.version}`;
	} else {
		try {
			latest = await fetchLatestTag(fetchFn);
		} catch (err) {
			process.stderr.write(`Network error: ${(err as Error).message}\n`);
			process.exit(2);
		}
	}

	if (opts.check) {
		try {
			if (!opts.version && compareVersions(current, latest) === 0) {
				process.stdout.write(`abtree is up to date (${current})\n`);
			} else {
				process.stdout.write(`current=${current} latest=${latest}\n`);
			}
		} catch {
			process.stdout.write(`current=${current} latest=${latest}\n`);
		}
		return;
	}

	if (!opts.version) {
		try {
			if (compareVersions(current, latest) === 0) {
				process.stdout.write(`abtree is up to date (${current})\n`);
				return;
			}
		} catch {
			// unparseable version — proceed with install
		}
	}

	if (process.stdin.isTTY && !opts.yes) {
		process.stdout.write(`Upgrade abtree ${current} → ${latest}? [y/N] `);
		const answer = await readLine();
		if (!/^(y|yes)$/i.test(answer.trim())) {
			return;
		}
	}

	process.stdout.write(`Installing to: ${execPath}\n`);

	const url = assetUrl(opts.version ? latest : "latest", target.asset);
	const tmp = tmpPath(installDir);

	try {
		await downloadAsset(url, tmp, fetchFn);
	} catch (err) {
		process.stderr.write(`Download failed: ${(err as Error).message}\n`);
		process.exit(2);
	}

	try {
		installBinary(tmp, execPath);
	} catch (err) {
		process.stderr.write(`Install failed: ${(err as Error).message}\n`);
		process.exit(1);
	}

	process.stdout.write(`abtree upgraded to ${latest}\n`);
}

export async function cmdServe(
	pathArg: string,
	opts: { port?: string },
) {
	const port = opts.port ? Number.parseInt(opts.port, 10) : 3000;
	if (Number.isNaN(port) || port < 1 || port > 65535) {
		die(`Invalid port: ${opts.port}`);
	}

	// Resolve relative paths against the user's cwd; absolute paths pass through.
	const resolved = isAbsolute(pathArg) ? pathArg : join(process.cwd(), pathArg);
	if (!existsSync(resolved)) {
		die(
			`Path not found: ${pathArg}\n  expected an '.abtree' directory or an 'executions/' dir.`,
		);
	}

	const { serve } = await import("@abtree/serve");
	const handle = await serve({ path: resolved, port });
	out(`abtree serve → ${handle.url}`);
	out(`  executions: ${handle.executionsPath}`);
	out(`  snapshots:  ${handle.snapshotsPath}`);
}

export async function cmdRender(
	treeArg: string,
	opts: { output?: string; title?: string },
) {
	let loaded: Awaited<ReturnType<typeof loadTree>>;
	try {
		loaded = await loadTree(treeArg);
	} catch (err) {
		die((err as Error).message);
	}
	if (!loaded) die(`tree file '${treeArg}' not found`);

	const root = loaded.parsed.root;
	const fallbackTitle =
		root.type !== "ref" ? root.name.replace(/_/g, " ") : loaded.slug;
	const svg = renderTreeSvg(root, { title: opts.title ?? fallbackTitle });

	if (opts.output) {
		writeFileSync(opts.output, svg);
		process.stdout.write(`wrote ${opts.output}\n`);
	} else {
		process.stdout.write(svg);
	}
}
