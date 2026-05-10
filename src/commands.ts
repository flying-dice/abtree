import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { select } from "@inquirer/prompts";
import EXECUTE_DOC from "../docs/agents/execute.md" with { type: "text" };
import {
	decodeCursor,
	encodeCursor,
	INITIAL_CURSOR,
	NULL_CURSOR,
} from "./cursor.ts";
import { ensureDir } from "./paths.ts";
import { ExecutionStore } from "./repos.ts";
import { SKILL_TARGETS, type SkillScope, type SkillVariant } from "./skills.ts";
import { TreeSnapshotStore } from "./snapshots.ts";
import {
	generateExecutionId,
	getNodeAtPath,
	listTreeSlugs,
	loadTree,
	setNodeResult,
	setStepIndex,
	tickRoot,
} from "./tree.ts";
import type { ExecutionDoc, NormalizedNode, TickResult } from "./types.ts";
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
import { die, out } from "./utils.ts";
import { VERSION } from "./version.ts";

export function cmdTreeList() {
	out(listTreeSlugs());
}

export function cmdDocs(content: string) {
	process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
}

export async function cmdExecutionCreate(treeSlug: string, summary: string) {
	const treeDef = await loadTree(treeSlug);
	if (!treeDef) die(`Tree '${treeSlug}' not found`);

	const id = generateExecutionId(treeSlug, summary);
	const now = new Date().toISOString();

	ExecutionStore.create({
		id,
		tree: treeSlug,
		summary,
		status: "running",
		snapshot: TreeSnapshotStore.put(treeDef),
		cursor: INITIAL_CURSOR,
		phase: "idle",
		protocol_accepted: false,
		created_at: now,
		updated_at: now,
	});

	ExecutionStore.replaceScope(id, "local", treeDef.local);
	ExecutionStore.replaceScope(id, "global", treeDef.global);

	out({
		id,
		tree: treeSlug,
		summary,
		local: treeDef.local,
		global: treeDef.global,
	});
}

export function cmdExecutionList() {
	out(
		ExecutionStore.list().map((d) => ({
			id: d.id,
			tree: d.tree,
			summary: d.summary,
			status: d.status,
			phase: d.phase,
		})),
	);
}

export function cmdExecutionGet(executionId: string) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) die(`Execution '${executionId}' not found`);
	out(doc);
}

export function cmdExecutionReset(executionId: string) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) die(`Execution '${executionId}' not found`);
	const treeDef = TreeSnapshotStore.get(doc.snapshot);
	ExecutionStore.replaceScope(executionId, "local", treeDef.local ?? {});
	ExecutionStore.update(executionId, {
		status: "running",
		cursor: INITIAL_CURSOR,
		phase: "idle",
		protocol_accepted: false,
	});
	out({ status: "reset" });
}

const PROTOCOL_GATE_NAME = "Acknowledge_Protocol";

function emitProtocolGate(): void {
	out({
		type: "instruct",
		name: PROTOCOL_GATE_NAME,
		instruction:
			"Read the runtime protocol below in full. It is the binding contract " +
			"for the rest of this execution — in particular, all $LOCAL/$GLOBAL " +
			"reads must go through `abtree local read` / `abtree global read`, " +
			"never from your own context. Submit success to acknowledge and proceed; " +
			"submit failure to abort.\n\n---\n\n" +
			EXECUTE_DOC,
	});
}

// cmdNext is a small dispatcher. Each phase / outcome has its own helper
// so the routing reads top-down: gate? phase replay? fresh tick?

function handleProtocolPhase(executionId: string, doc: ExecutionDoc): void {
	// Gate already rejected: don't re-prompt; surface the terminal status.
	if (doc.status === "failed") {
		out({ status: "failure" });
		return;
	}
	if (doc.phase !== "protocol") {
		ExecutionStore.update(executionId, {
			phase: "protocol",
			cursor: NULL_CURSOR,
		});
	}
	emitProtocolGate();
}

function replayCurrentStep(treeRoot: NormalizedNode, doc: ExecutionDoc): void {
	const cursor = decodeCursor(doc.cursor);
	if (!cursor) die("cursor missing");
	const node = getNodeAtPath(treeRoot, cursor.path);
	if (node.type !== "action") die("cursor points to non-action node");
	const step = node.steps[cursor.step];
	if (!step) die(`cursor.step out of range for phase ${doc.phase}`);
	if (doc.phase === "evaluating" && step.kind === "evaluate") {
		out({ type: "evaluate", name: node.name, expression: step.expression });
		return;
	}
	if (doc.phase === "performing" && step.kind === "instruct") {
		out({ type: "instruct", name: node.name, instruction: step.instruction });
		return;
	}
	die(`cursor.step wrong kind for phase ${doc.phase}`);
}

function emitTickResult(executionId: string, result: TickResult): void {
	if (result.type === "done") {
		ExecutionStore.update(executionId, {
			status: "complete",
			phase: "idle",
			cursor: NULL_CURSOR,
		});
		out({ status: "done" });
		return;
	}
	if (result.type === "failure") {
		ExecutionStore.update(executionId, {
			status: "failed",
			phase: "idle",
			cursor: NULL_CURSOR,
		});
		out({ status: "failure" });
		return;
	}
	const cur = encodeCursor({ path: result.path, step: result.step });
	if (result.type === "evaluate") {
		ExecutionStore.update(executionId, {
			status: "running",
			phase: "evaluating",
			cursor: cur,
		});
		out({ type: "evaluate", name: result.name, expression: result.expression });
		return;
	}
	if (result.type === "instruct") {
		ExecutionStore.update(executionId, {
			status: "running",
			phase: "performing",
			cursor: cur,
		});
		out({
			type: "instruct",
			name: result.name,
			instruction: result.instruction,
		});
	}
}

export function cmdNext(executionId: string) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) die(`Execution '${executionId}' not found`);

	if (!doc.protocol_accepted) {
		handleProtocolPhase(executionId, doc);
		return;
	}

	const treeDef = TreeSnapshotStore.get(doc.snapshot);

	if (doc.phase === "evaluating" || doc.phase === "performing") {
		replayCurrentStep(treeDef.root, doc);
		return;
	}

	emitTickResult(executionId, tickRoot(executionId, treeDef.root));
}

export function cmdEval(executionId: string, result: boolean) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) die(`Execution '${executionId}' not found`);
	if (doc.phase !== "evaluating")
		die(`Execution is not in evaluating phase (current: ${doc.phase})`);

	const cursor = decodeCursor(doc.cursor);
	if (!cursor) die("cursor missing");
	const path: number[] = cursor.path;
	const stepIdx: number = cursor.step;

	if (result) {
		setStepIndex(executionId, path, stepIdx + 1);
		ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
		out({
			status: "evaluation_passed",
			message: "Precondition met. Advancing.",
		});
	} else {
		setNodeResult(executionId, path, "failure");
		ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
		out({
			status: "evaluation_failed",
			message: "Precondition not met. Action failed.",
		});
	}
}

function handleProtocolSubmit(
	executionId: string,
	status: "success" | "failure" | "running",
): void {
	if (status === "running") {
		out({
			status: "running",
			message: "Acknowledged. Call next when ready to continue.",
		});
		return;
	}
	if (status === "success") {
		ExecutionStore.update(executionId, {
			protocol_accepted: true,
			phase: "idle",
			cursor: NULL_CURSOR,
		});
		out({
			status: "protocol_accepted",
			message: "Protocol acknowledged. Call next to begin the tree.",
		});
		return;
	}
	ExecutionStore.update(executionId, {
		status: "failed",
		phase: "idle",
		cursor: NULL_CURSOR,
	});
	out({
		status: "protocol_rejected",
		message: "Protocol not acknowledged. Execution aborted.",
	});
}

function handlePerformingSubmit(
	executionId: string,
	doc: ExecutionDoc,
	status: "success" | "failure" | "running",
): void {
	const cursor = decodeCursor(doc.cursor);
	if (!cursor) die("cursor missing");
	const path: number[] = cursor.path;
	const stepIdx: number = cursor.step;

	if (status === "running") {
		out({
			status: "running",
			message: "Acknowledged. Call next when ready to continue.",
		});
		return;
	}

	if (status === "failure") {
		setNodeResult(executionId, path, "failure");
		ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
		out({
			status: "action_failed",
			message: "Instruction failed. Action marked as failure.",
		});
		return;
	}

	const treeDef = TreeSnapshotStore.get(doc.snapshot);
	const node = getNodeAtPath(treeDef.root, path);
	if (node.type !== "action") die("cursor points to non-action node");
	const nextStep = stepIdx + 1;

	if (nextStep >= node.steps.length) {
		setNodeResult(executionId, path, "success");
		ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
		out({
			status: "action_complete",
			message: "All steps done. Action succeeded.",
		});
	} else {
		setStepIndex(executionId, path, nextStep);
		ExecutionStore.update(executionId, { phase: "idle", cursor: NULL_CURSOR });
		out({ status: "step_complete", message: "Step done. More steps remain." });
	}
}

export function cmdSubmit(
	executionId: string,
	status: "success" | "failure" | "running",
) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) die(`Execution '${executionId}' not found`);

	if (doc.phase === "protocol") {
		handleProtocolSubmit(executionId, status);
		return;
	}

	if (doc.phase !== "performing")
		die(`Execution is not in performing phase (current: ${doc.phase})`);

	handlePerformingSubmit(executionId, doc, status);
}

export function cmdLocalRead(executionId: string, path?: string) {
	if (path) {
		out({ path, value: ExecutionStore.getScope(executionId, "local", path) });
	} else {
		out(ExecutionStore.getScope(executionId, "local"));
	}
}

export function cmdLocalWrite(
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
	out({ path, value: parsed });
}

export function cmdGlobalRead(executionId: string, path?: string) {
	if (path) {
		out({ path, value: ExecutionStore.getScope(executionId, "global", path) });
	} else {
		out(ExecutionStore.getScope(executionId, "global"));
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

	const execPath = realpathExec();
	process.stdout.write(`Installing to: ${execPath}\n`);
	const installDir = dirname(execPath);

	if (!isWritable(installDir)) {
		const dest = execPath;
		const tmp = tmpPath(installDir);
		process.stderr.write(`Install directory ${installDir} is not writable.\n`);
		process.stderr.write(`sudo mv ${tmp} ${dest}\n`);
		process.exit(1);
	}

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
