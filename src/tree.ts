import { join } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { TREES_DIR } from "./paths.ts";
import { FlowStore } from "./repos.ts";
import { validateTreeFile, normalizeNode } from "./validate.ts";
import type { NormalizedNode, ParsedTree, TickResult, NodeStatus } from "./types.ts";

export function loadTree(slug: string): ParsedTree | null {
  const yamlPath = join(TREES_DIR, `${slug}.yaml`);
  if (!existsSync(yamlPath)) return null;
  const raw = Bun.YAML.parse(readFileSync(yamlPath, "utf-8"));
  const parsed = validateTreeFile(raw);
  return {
    local: parsed.state?.local ?? {},
    global: parsed.state?.global ?? {},
    root: normalizeNode(parsed.tree),
  };
}

export function listTreeSlugs(): string[] {
  if (!existsSync(TREES_DIR)) return [];
  return readdirSync(TREES_DIR)
    .filter(f => f.endsWith(".yaml"))
    .map(f => f.slice(0, -5));
}

export function generateFlowId(tree: string, summary: string): string {
  const slug = summary.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const prefix = `${slug}__${tree}__`;
  const count = FlowStore.countByPrefix(prefix);
  return `${prefix}${count + 1}`;
}

export function getNodeAtPath(root: NormalizedNode, path: number[]): NormalizedNode {
  let node = root;
  for (const idx of path) {
    if (node.type === "action") break;
    node = node.children[idx];
  }
  return node;
}

function getNodeStatusKey(path: number[]): string {
  return path.length === 0 ? "_node_status" : `_node_status__${path.join("_")}`;
}

function getStepKey(path: number[]): string {
  return path.length === 0 ? "_step" : `_step__${path.join("_")}`;
}

export function getNodeResult(flowId: string, path: number[]): NodeStatus | null {
  return FlowStore.getLocal(flowId, getNodeStatusKey(path)) as NodeStatus | null;
}

export function setNodeResult(flowId: string, path: number[], status: NodeStatus) {
  FlowStore.setLocal(flowId, getNodeStatusKey(path), status);
}

function getStepIndex(flowId: string, path: number[]): number {
  const val = FlowStore.getLocal(flowId, getStepKey(path));
  return (val as number) ?? 0;
}

function setStepIndex(flowId: string, path: number[], step: number) {
  FlowStore.setLocal(flowId, getStepKey(path), step);
}

export function tickNode(flowId: string, path: number[], node: NormalizedNode): TickResult {
  if (!node) return { type: "done" };

  if (node.type === "action") {
    const status = getNodeResult(flowId, path);
    if (status === "success" || status === "failure") {
      return { type: status === "success" ? "done" : "failure" };
    }
    const stepIdx = getStepIndex(flowId, path);
    if (!node.steps || stepIdx >= node.steps.length) return { type: "done" };
    const step = node.steps[stepIdx];
    if (step.kind === "evaluate") {
      return { type: "evaluate", name: node.name, expression: step.expression, path, step: stepIdx };
    }
    return { type: "instruct", name: node.name, instruction: step.instruction, path, step: stepIdx };
  }

  if (node.type === "sequence") {
    for (let i = 0; i < node.children.length; i++) {
      const childPath = [...path, i];
      const childStatus = getNodeResult(flowId, childPath);
      if (childStatus === "failure") return { type: "failure" };
      if (childStatus === "success") continue;
      const result = tickNode(flowId, childPath, node.children[i]);
      if (result.type === "done") { setNodeResult(flowId, childPath, "success"); continue; }
      if (result.type === "failure") { setNodeResult(flowId, childPath, "failure"); return { type: "failure" }; }
      return result;
    }
    return { type: "done" };
  }

  if (node.type === "selector") {
    for (let i = 0; i < node.children.length; i++) {
      const childPath = [...path, i];
      const childStatus = getNodeResult(flowId, childPath);
      if (childStatus === "success") return { type: "done" };
      if (childStatus === "failure") continue;
      const result = tickNode(flowId, childPath, node.children[i]);
      if (result.type === "done") { setNodeResult(flowId, childPath, "success"); return { type: "done" }; }
      if (result.type === "failure") { setNodeResult(flowId, childPath, "failure"); continue; }
      return result;
    }
    return { type: "failure" };
  }

  if (node.type === "parallel") {
    let allDone = true;
    let firstPending: TickResult | null = null;
    for (let i = 0; i < node.children.length; i++) {
      const childPath = [...path, i];
      const childStatus = getNodeResult(flowId, childPath);
      if (childStatus === "failure") return { type: "failure" };
      if (childStatus === "success") continue;
      const result = tickNode(flowId, childPath, node.children[i]);
      if (result.type === "done") { setNodeResult(flowId, childPath, "success"); continue; }
      if (result.type === "failure") { setNodeResult(flowId, childPath, "failure"); return { type: "failure" }; }
      allDone = false;
      if (!firstPending) firstPending = result;
    }
    if (allDone) return { type: "done" };
    return firstPending!;
  }

  return { type: "done" };
}

export function getPathForNode(root: NormalizedNode, target: NormalizedNode, path: number[] = []): number[] | null {
  if (root === target) return path;
  if (root.type !== "action") {
    for (let i = 0; i < root.children.length; i++) {
      const found = getPathForNode(root.children[i], target, [...path, i]);
      if (found) return found;
    }
  }
  return null;
}

export { setStepIndex, getStepIndex };
