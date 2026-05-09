import type { AbtNode, NormalizedNode, NormalizedStep, Step, TreeFile } from "./types.ts";
import { die } from "./utils.ts";

export function parseFlowId(val: string): string {
  if (!val || typeof val !== "string") die("Flow ID is required");
  return val;
}

export function parseTreeSlug(val: string): string {
  if (!val || typeof val !== "string") die("Tree slug is required");
  return val;
}

export function parseSummary(val: string): string {
  if (!val || typeof val !== "string") die("Summary is required");
  return val;
}

export function parseScopePath(val: string): string {
  if (!val || typeof val !== "string") die("Path is required");
  return val;
}

export function parseEvalResult(val: string): boolean {
  if (val !== "true" && val !== "false") die('Result must be "true" or "false"');
  return val === "true";
}

export function parseSubmitStatus(val: string): "success" | "failure" | "running" {
  if (val !== "success" && val !== "failure" && val !== "running")
    die('Status must be "success", "failure", or "running"');
  return val as "success" | "failure" | "running";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateStep(raw: unknown, ctx: string): Step {
  if (!isObject(raw)) die(`${ctx}: step must be an object`);
  const keys = Object.keys(raw);
  if (keys.length !== 1) die(`${ctx}: step must have exactly one key`);
  if ("evaluate" in raw) {
    if (typeof raw.evaluate !== "string" || !raw.evaluate)
      die(`${ctx}: evaluate must be a non-empty string`);
    return { evaluate: raw.evaluate };
  }
  if ("instruct" in raw) {
    if (typeof raw.instruct !== "string" || !raw.instruct)
      die(`${ctx}: instruct must be a non-empty string`);
    return { instruct: raw.instruct };
  }
  die(`${ctx}: step must have key "evaluate" or "instruct"`);
}

function validateNode(raw: unknown, ctx: string): AbtNode {
  if (!isObject(raw)) die(`${ctx}: node must be an object`);
  if (typeof raw.type !== "string" || !raw.type) die(`${ctx}: node.type is required`);
  if (typeof raw.name !== "string" || !raw.name) die(`${ctx}: node.name is required`);

  if (raw.type === "action") {
    if (!Array.isArray(raw.steps) || raw.steps.length === 0)
      die(`${ctx}.${raw.name}: action node must have at least one step`);
    return {
      type: "action",
      name: raw.name,
      steps: raw.steps.map((s, i) => validateStep(s, `${ctx}.${raw.name}.steps[${i}]`)),
    };
  }

  if (raw.type === "sequence" || raw.type === "selector" || raw.type === "parallel") {
    if (!Array.isArray(raw.children) || raw.children.length === 0)
      die(`${ctx}.${raw.name}: composite node must have at least one child`);
    return {
      type: raw.type,
      name: raw.name,
      children: raw.children.map((c, i) => validateNode(c, `${ctx}.${raw.name}.children[${i}]`)),
    };
  }

  die(`${ctx}.${raw.name}: unknown node type "${raw.type}"`);
}

export function validateTreeFile(raw: unknown): TreeFile {
  if (!isObject(raw)) die("tree file must be an object");
  if (typeof raw.name !== "string" || !raw.name) die("tree.name is required");
  if (typeof raw.version !== "string") die("tree.version is required");

  let state: TreeFile["state"];
  if (raw.state !== undefined) {
    if (!isObject(raw.state)) die("tree.state must be an object");
    state = {};
    if (raw.state.local !== undefined) {
      if (!isObject(raw.state.local)) die("tree.state.local must be an object");
      state.local = raw.state.local as Record<string, unknown>;
    }
    if (raw.state.global !== undefined) {
      if (!isObject(raw.state.global)) die("tree.state.global must be an object");
      state.global = raw.state.global as Record<string, unknown>;
    }
  }

  return {
    name: raw.name,
    version: raw.version,
    description: typeof raw.description === "string" ? raw.description : undefined,
    state,
    tree: validateNode(raw.tree, "tree"),
  };
}

export function normalizeStep(step: Step): NormalizedStep {
  if ("evaluate" in step) return { kind: "evaluate", expression: step.evaluate.trim() };
  return { kind: "instruct", instruction: step.instruct.trim() };
}

export function normalizeNode(node: AbtNode): NormalizedNode {
  if (node.type === "action") {
    return { type: "action", name: node.name, steps: node.steps.map(normalizeStep) };
  }
  return { type: node.type, name: node.name, children: node.children.map(normalizeNode) };
}
