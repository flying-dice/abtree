import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { select } from "@inquirer/prompts";
import { rebuildMermaid } from "./mermaid.ts";
import {
	ensureDir,
	SKILL_TARGETS,
	type SkillScope,
	type SkillVariant,
} from "./paths.ts";
import { ExecutionStore } from "./repos.ts";
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
import { die, out } from "./utils.ts";

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
		cursor: "[]",
		phase: "idle",
		created_at: now,
		updated_at: now,
	});

	ExecutionStore.replaceLocal(id, treeDef.local);
	ExecutionStore.replaceGlobal(id, treeDef.global);
	rebuildMermaid(id);

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
	ExecutionStore.replaceLocal(executionId, treeDef.local ?? {});
	ExecutionStore.update(executionId, {
		status: "running",
		cursor: "[]",
		phase: "idle",
	});
	rebuildMermaid(executionId);
	out({ status: "reset" });
}

export function cmdNext(executionId: string) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) die(`Execution '${executionId}' not found`);

	const treeDef = TreeSnapshotStore.get(doc.snapshot);
	const phase = doc.phase;
	const cursor = JSON.parse(doc.cursor);

	if (phase === "evaluating") {
		const node = getNodeAtPath(treeDef.root, cursor.path);
		if (node.type !== "action") die("cursor points to non-action node");
		const step = node.steps[cursor.step];
		if (!step || step.kind !== "evaluate")
			die(`cursor.step out of range or wrong kind for phase ${phase}`);
		out({ type: "evaluate", name: node.name, expression: step.expression });
		return;
	}

	if (phase === "performing") {
		const node = getNodeAtPath(treeDef.root, cursor.path);
		if (node.type !== "action") die("cursor points to non-action node");
		const step = node.steps[cursor.step];
		if (!step || step.kind !== "instruct")
			die(`cursor.step out of range or wrong kind for phase ${phase}`);
		out({ type: "instruct", name: node.name, instruction: step.instruction });
		return;
	}

	const result = tickRoot(executionId, treeDef.root);

	if (result.type === "done") {
		ExecutionStore.update(executionId, {
			status: "complete",
			phase: "idle",
			cursor: "null",
		});
		rebuildMermaid(executionId);
		out({ status: "done" });
		return;
	}

	if (result.type === "failure") {
		ExecutionStore.update(executionId, {
			status: "failed",
			phase: "idle",
			cursor: "null",
		});
		rebuildMermaid(executionId);
		out({ status: "failure" });
		return;
	}

	if (result.type === "evaluate") {
		const cur = JSON.stringify({ path: result.path, step: result.step });
		ExecutionStore.update(executionId, { phase: "evaluating", cursor: cur });
		out({ type: "evaluate", name: result.name, expression: result.expression });
		return;
	}

	if (result.type === "instruct") {
		const cur = JSON.stringify({ path: result.path, step: result.step });
		ExecutionStore.update(executionId, { phase: "performing", cursor: cur });
		out({
			type: "instruct",
			name: result.name,
			instruction: result.instruction,
		});
		return;
	}

	out({ status: "done" });
}

export function cmdEval(executionId: string, result: boolean) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) die(`Execution '${executionId}' not found`);
	if (doc.phase !== "evaluating")
		die(`Execution is not in evaluating phase (current: ${doc.phase})`);

	const cursor = JSON.parse(doc.cursor);
	const path: number[] = cursor.path;
	const stepIdx: number = cursor.step;

	if (result) {
		setStepIndex(executionId, path, stepIdx + 1);
		ExecutionStore.update(executionId, { phase: "idle", cursor: "null" });
		rebuildMermaid(executionId);
		out({
			status: "evaluation_passed",
			message: "Precondition met. Advancing.",
		});
	} else {
		setNodeResult(executionId, path, "failure");
		ExecutionStore.update(executionId, { phase: "idle", cursor: "null" });
		rebuildMermaid(executionId);
		out({
			status: "evaluation_failed",
			message: "Precondition not met. Action failed.",
		});
	}
}

export function cmdSubmit(
	executionId: string,
	status: "success" | "failure" | "running",
) {
	const doc = ExecutionStore.findById(executionId);
	if (!doc) die(`Execution '${executionId}' not found`);
	if (doc.phase !== "performing")
		die(`Execution is not in performing phase (current: ${doc.phase})`);

	const cursor = JSON.parse(doc.cursor);
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
		ExecutionStore.update(executionId, { phase: "idle", cursor: "null" });
		rebuildMermaid(executionId);
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
		ExecutionStore.update(executionId, { phase: "idle", cursor: "null" });
		rebuildMermaid(executionId);
		out({
			status: "action_complete",
			message: "All steps done. Action succeeded.",
		});
	} else {
		setStepIndex(executionId, path, nextStep);
		ExecutionStore.update(executionId, { phase: "idle", cursor: "null" });
		rebuildMermaid(executionId);
		out({ status: "step_complete", message: "Step done. More steps remain." });
	}
}

export function cmdLocalRead(executionId: string, path?: string) {
	if (path) {
		out({ path, value: ExecutionStore.getLocal(executionId, path) });
	} else {
		out(ExecutionStore.getLocal(executionId));
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
	ExecutionStore.setLocal(executionId, path, parsed);
	rebuildMermaid(executionId);
	out({ path, value: parsed });
}

export function cmdGlobalRead(executionId: string, path?: string) {
	if (path) {
		out({ path, value: ExecutionStore.getGlobal(executionId, path) });
	} else {
		out(ExecutionStore.getGlobal(executionId));
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
