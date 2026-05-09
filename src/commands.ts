import { FlowRepo, LocalRepo, GlobalRepo } from "./repos.ts";
import { loadTree, listTreeSlugs, generateFlowId, tickNode, getNodeAtPath, setNodeResult, getStepIndex, setStepIndex } from "./tree.ts";
import { rebuildMermaid } from "./mermaid.ts";
import { out, die } from "./utils.ts";

export function cmdTreeList() {
  out(listTreeSlugs());
}

export function cmdFlowCreate(treeSlug: string, summary: string) {
  const treeDef = loadTree(treeSlug);
  if (!treeDef) die(`Tree '${treeSlug}' not found`);

  const id = generateFlowId(treeSlug, summary);
  const now = new Date().toISOString();

  FlowRepo.create({
    id, tree: treeSlug, summary, status: "running",
    snapshot: JSON.stringify(treeDef), cursor: "[]", phase: "idle",
    created_at: now, updated_at: now,
  });

  LocalRepo.bulkSet(id, treeDef.local);
  GlobalRepo.bulkSet(id, treeDef.global);
  rebuildMermaid(id);

  out({ id, tree: treeSlug, summary, local: treeDef.local, global: treeDef.global });
}

export function cmdFlowList() {
  out(FlowRepo.listAll());
}

export function cmdFlowGet(flowId: string) {
  const row = FlowRepo.findById(flowId);
  if (!row) die(`Flow '${flowId}' not found`);
  out({ ...row, local: LocalRepo.getAll(flowId), global: GlobalRepo.getAll(flowId) });
}

export function cmdFlowReset(flowId: string) {
  const row = FlowRepo.findById(flowId);
  if (!row) die(`Flow '${flowId}' not found`);
  const treeDef = JSON.parse(row.snapshot);
  LocalRepo.bulkSet(flowId, treeDef.local ?? {});
  FlowRepo.update(flowId, { status: "running", cursor: "[]", phase: "idle" });
  rebuildMermaid(flowId);
  out({ status: "reset" });
}

export function cmdNext(flowId: string) {
  const row = FlowRepo.findById(flowId);
  if (!row) die(`Flow '${flowId}' not found`);

  const treeDef = JSON.parse(row.snapshot);
  const phase = row.phase;
  const cursor = JSON.parse(row.cursor);

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

  const result = tickNode(flowId, [], treeDef.root);

  if (result.type === "done") {
    FlowRepo.update(flowId, { status: "complete", phase: "idle", cursor: "null" });
    rebuildMermaid(flowId);
    out({ status: "done" });
    return;
  }

  if (result.type === "failure") {
    FlowRepo.update(flowId, { status: "failed", phase: "idle", cursor: "null" });
    rebuildMermaid(flowId);
    out({ status: "failure" });
    return;
  }

  if (result.type === "evaluate") {
    const cur = JSON.stringify({ path: result.path, step: result.step });
    FlowRepo.update(flowId, { phase: "evaluating", cursor: cur });
    out({ type: "evaluate", name: result.name, expression: result.expression });
    return;
  }

  if (result.type === "instruct") {
    const cur = JSON.stringify({ path: result.path, step: result.step });
    FlowRepo.update(flowId, { phase: "performing", cursor: cur });
    out({ type: "instruct", name: result.name, instruction: result.instruction });
    return;
  }

  out({ status: "done" });
}

export function cmdEval(flowId: string, result: boolean) {
  const row = FlowRepo.findById(flowId);
  if (!row) die(`Flow '${flowId}' not found`);
  if (row.phase !== "evaluating") die(`Flow is not in evaluating phase (current: ${row.phase})`);

  const cursor = JSON.parse(row.cursor);
  const path: number[] = cursor.path;
  const stepIdx: number = cursor.step;

  if (result) {
    setStepIndex(flowId, path, stepIdx + 1);
    FlowRepo.update(flowId, { phase: "idle", cursor: "null" });
    rebuildMermaid(flowId);
    out({ status: "evaluation_passed", message: "Precondition met. Advancing." });
  } else {
    setNodeResult(flowId, path, "failure");
    FlowRepo.update(flowId, { phase: "idle", cursor: "null" });
    rebuildMermaid(flowId);
    out({ status: "evaluation_failed", message: "Precondition not met. Action failed." });
  }
}

export function cmdSubmit(flowId: string, status: "success" | "failure" | "running") {
  const row = FlowRepo.findById(flowId);
  if (!row) die(`Flow '${flowId}' not found`);
  if (row.phase !== "performing") die(`Flow is not in performing phase (current: ${row.phase})`);

  const cursor = JSON.parse(row.cursor);
  const path: number[] = cursor.path;
  const stepIdx: number = cursor.step;

  if (status === "running") {
    out({ status: "running", message: "Acknowledged. Call next when ready to continue." });
    return;
  }

  if (status === "failure") {
    setNodeResult(flowId, path, "failure");
    FlowRepo.update(flowId, { phase: "idle", cursor: "null" });
    rebuildMermaid(flowId);
    out({ status: "action_failed", message: "Instruction failed. Action marked as failure." });
    return;
  }

  const treeDef = JSON.parse(row.snapshot);
  const node = getNodeAtPath(treeDef.root, path);
  if (node.type !== "action") die("cursor points to non-action node");
  const nextStep = stepIdx + 1;

  if (nextStep >= node.steps.length) {
    setNodeResult(flowId, path, "success");
    FlowRepo.update(flowId, { phase: "idle", cursor: "null" });
    rebuildMermaid(flowId);
    out({ status: "action_complete", message: "All steps done. Action succeeded." });
  } else {
    setStepIndex(flowId, path, nextStep);
    FlowRepo.update(flowId, { phase: "idle", cursor: "null" });
    rebuildMermaid(flowId);
    out({ status: "step_complete", message: "Step done. More steps remain." });
  }
}

export function cmdLocalRead(flowId: string, path?: string) {
  if (path) {
    out({ path, value: LocalRepo.getValue(flowId, path) });
  } else {
    out(LocalRepo.getAll(flowId));
  }
}

export function cmdLocalWrite(flowId: string, path: string, value: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { parsed = value; }
  LocalRepo.setValue(flowId, path, parsed);
  rebuildMermaid(flowId);
  out({ path, value: parsed });
}

export function cmdGlobalRead(flowId: string, path?: string) {
  if (path) {
    out({ path, value: GlobalRepo.getValue(flowId, path) });
  } else {
    out(GlobalRepo.getAll(flowId));
  }
}
