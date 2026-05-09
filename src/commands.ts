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
import { FlowStore } from "./repos.ts";
import {
	generateFlowId,
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

export async function cmdFlowCreate(treeSlug: string, summary: string) {
	const treeDef = await loadTree(treeSlug);
	if (!treeDef) die(`Tree '${treeSlug}' not found`);

	const id = generateFlowId(treeSlug, summary);
	const now = new Date().toISOString();

	FlowStore.create({
		id,
		tree: treeSlug,
		summary,
		status: "running",
		snapshot: JSON.stringify(treeDef),
		cursor: "[]",
		phase: "idle",
		created_at: now,
		updated_at: now,
	});

	FlowStore.replaceLocal(id, treeDef.local);
	FlowStore.replaceGlobal(id, treeDef.global);
	rebuildMermaid(id);

	out({
		id,
		tree: treeSlug,
		summary,
		local: treeDef.local,
		global: treeDef.global,
	});
}

export function cmdFlowList() {
	out(
		FlowStore.list().map((d) => ({
			id: d.id,
			tree: d.tree,
			summary: d.summary,
			status: d.status,
			phase: d.phase,
		})),
	);
}

export function cmdFlowGet(flowId: string) {
	const doc = FlowStore.findById(flowId);
	if (!doc) die(`Flow '${flowId}' not found`);
	out(doc);
}

export function cmdFlowReset(flowId: string) {
	const doc = FlowStore.findById(flowId);
	if (!doc) die(`Flow '${flowId}' not found`);
	const treeDef = JSON.parse(doc.snapshot);
	FlowStore.replaceLocal(flowId, treeDef.local ?? {});
	FlowStore.update(flowId, { status: "running", cursor: "[]", phase: "idle" });
	rebuildMermaid(flowId);
	out({ status: "reset" });
}

export function cmdNext(flowId: string) {
	const doc = FlowStore.findById(flowId);
	if (!doc) die(`Flow '${flowId}' not found`);

	const treeDef = JSON.parse(doc.snapshot);
	const phase = doc.phase;
	const cursor = JSON.parse(doc.cursor);

	if (phase === "evaluating") {
		const node = getNodeAtPath(treeDef.root, cursor.path);
		if (node.type !== "action") die("cursor points to non-action node");
		const step = node.steps[cursor.step];
		out({ type: "evaluate", name: node.name, expression: step.expression });
		return;
	}

	if (phase === "performing") {
		const node = getNodeAtPath(treeDef.root, cursor.path);
		if (node.type !== "action") die("cursor points to non-action node");
		const step = node.steps[cursor.step];
		out({ type: "instruct", name: node.name, instruction: step.instruction });
		return;
	}

	const result = tickRoot(flowId, treeDef.root);

	if (result.type === "done") {
		FlowStore.update(flowId, {
			status: "complete",
			phase: "idle",
			cursor: "null",
		});
		rebuildMermaid(flowId);
		out({ status: "done" });
		return;
	}

	if (result.type === "failure") {
		FlowStore.update(flowId, {
			status: "failed",
			phase: "idle",
			cursor: "null",
		});
		rebuildMermaid(flowId);
		out({ status: "failure" });
		return;
	}

	if (result.type === "evaluate") {
		const cur = JSON.stringify({ path: result.path, step: result.step });
		FlowStore.update(flowId, { phase: "evaluating", cursor: cur });
		out({ type: "evaluate", name: result.name, expression: result.expression });
		return;
	}

	if (result.type === "instruct") {
		const cur = JSON.stringify({ path: result.path, step: result.step });
		FlowStore.update(flowId, { phase: "performing", cursor: cur });
		out({
			type: "instruct",
			name: result.name,
			instruction: result.instruction,
		});
		return;
	}

	out({ status: "done" });
}

export function cmdEval(flowId: string, result: boolean) {
	const doc = FlowStore.findById(flowId);
	if (!doc) die(`Flow '${flowId}' not found`);
	if (doc.phase !== "evaluating")
		die(`Flow is not in evaluating phase (current: ${doc.phase})`);

	const cursor = JSON.parse(doc.cursor);
	const path: number[] = cursor.path;
	const stepIdx: number = cursor.step;

	if (result) {
		setStepIndex(flowId, path, stepIdx + 1);
		FlowStore.update(flowId, { phase: "idle", cursor: "null" });
		rebuildMermaid(flowId);
		out({
			status: "evaluation_passed",
			message: "Precondition met. Advancing.",
		});
	} else {
		setNodeResult(flowId, path, "failure");
		FlowStore.update(flowId, { phase: "idle", cursor: "null" });
		rebuildMermaid(flowId);
		out({
			status: "evaluation_failed",
			message: "Precondition not met. Action failed.",
		});
	}
}

export function cmdSubmit(
	flowId: string,
	status: "success" | "failure" | "running",
) {
	const doc = FlowStore.findById(flowId);
	if (!doc) die(`Flow '${flowId}' not found`);
	if (doc.phase !== "performing")
		die(`Flow is not in performing phase (current: ${doc.phase})`);

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
		setNodeResult(flowId, path, "failure");
		FlowStore.update(flowId, { phase: "idle", cursor: "null" });
		rebuildMermaid(flowId);
		out({
			status: "action_failed",
			message: "Instruction failed. Action marked as failure.",
		});
		return;
	}

	const treeDef = JSON.parse(doc.snapshot);
	const node = getNodeAtPath(treeDef.root, path);
	if (node.type !== "action") die("cursor points to non-action node");
	const nextStep = stepIdx + 1;

	if (nextStep >= node.steps.length) {
		setNodeResult(flowId, path, "success");
		FlowStore.update(flowId, { phase: "idle", cursor: "null" });
		rebuildMermaid(flowId);
		out({
			status: "action_complete",
			message: "All steps done. Action succeeded.",
		});
	} else {
		setStepIndex(flowId, path, nextStep);
		FlowStore.update(flowId, { phase: "idle", cursor: "null" });
		rebuildMermaid(flowId);
		out({ status: "step_complete", message: "Step done. More steps remain." });
	}
}

export function cmdLocalRead(flowId: string, path?: string) {
	if (path) {
		out({ path, value: FlowStore.getLocal(flowId, path) });
	} else {
		out(FlowStore.getLocal(flowId));
	}
}

export function cmdLocalWrite(flowId: string, path: string, value: string) {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		parsed = value;
	}
	FlowStore.setLocal(flowId, path, parsed);
	rebuildMermaid(flowId);
	out({ path, value: parsed });
}

export function cmdGlobalRead(flowId: string, path?: string) {
	if (path) {
		out({ path, value: FlowStore.getGlobal(flowId, path) });
	} else {
		out(FlowStore.getGlobal(flowId));
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
