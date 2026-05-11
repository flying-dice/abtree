import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { makeNodeModulesResolver, resolveEntryYaml } from "./deps/resolve.ts";
import { TREE_SOURCES } from "./paths.ts";
import { ExecutionStore } from "./repos.ts";
import { RuntimeStore } from "./runtime-store.ts";
import type {
	NodeStatus,
	NormalizedNode,
	ParsedTree,
	TickResult,
} from "./types.ts";
import { normalizeNode, validateTreeFile } from "./validate.ts";

// Tree files can split themselves across multiple YAML documents using
// JSON-Schema-style $ref. The ref-parser dereferences relative paths,
// absolute paths, and URLs at load time so the rest of the pipeline
// sees one fully-resolved object.
//
//   tree:
//     type: sequence
//     children:
//       - $ref: "./fragments/auth.yaml"
//       - $ref: "./fragments/work.yaml"
//
// A tree reference is resolved to an explicit YAML path before loading.
// The caller passes either a slug (multi-tree consumer layout) or a path
// (author layout, or vendored fragment under node_modules/). The returned
// `slug` is sanitised for safe use as an execution-ID prefix.
export interface LoadedTree {
	yamlPath: string;
	slug: string;
	parsed: ParsedTree;
}

export async function loadTree(arg: string): Promise<LoadedTree | null> {
	const resolution = resolveTreeArg(arg);
	if (!resolution) return null;
	const parsed = await parseTreeAtPath(resolution.yamlPath);
	return { yamlPath: resolution.yamlPath, slug: resolution.slug, parsed };
}

// circular: 'ignore' leaves cyclic edges as literal { $ref: "..." }
// objects in the resolved tree. Non-cyclic refs are still expanded.
// This stops a cycle from blowing the stack at validate / snapshot
// time; the ref node is preserved in the snapshot and surfaces a
// clean failure if the runtime ever ticks it.
async function parseTreeAtPath(yamlPath: string): Promise<ParsedTree> {
	const raw = await $RefParser.dereference(yamlPath, {
		resolve: { "node-modules": makeNodeModulesResolver(yamlPath) },
		dereference: { circular: "ignore" },
	});
	const parsed = validateTreeFile(raw);
	return {
		local: parsed.state?.local ?? {},
		global: parsed.state?.global ?? {},
		root: normalizeNode(parsed.tree),
	};
}

// Slug lookup first (preserves backwards-compat for `.abtree/trees/<slug>/`),
// then path lookup as a fallback so authors can pass `./TREE.yaml`,
// `node_modules/@acme/bt-retry`, etc.
function resolveTreeArg(
	arg: string,
): { yamlPath: string; slug: string } | null {
	const asSlug = findSlugYaml(arg);
	if (asSlug) return { yamlPath: asSlug, slug: arg };

	const asPath = findPathYaml(arg);
	if (asPath) return { yamlPath: asPath, slug: deriveSlugFromYaml(asPath) };

	return null;
}

function findSlugYaml(slug: string): string | null {
	if (slug.includes("/") || slug.includes("\\")) return null;
	for (const dir of TREE_SOURCES) {
		const slugDir = join(dir, slug);
		if (!existsSync(slugDir)) continue;
		const entry = resolveEntryYaml(slugDir);
		if (entry.kind === "ok" && existsSync(entry.path)) return entry.path;
		throw missingEntryError(
			`tree slug '${slug}' resolved to '${slugDir}'`,
			entry,
		);
	}
	return null;
}

function findPathYaml(arg: string): string | null {
	const abs = isAbsolute(arg) ? arg : resolve(process.cwd(), arg);
	if (!existsSync(abs)) return null;
	const stats = statSync(abs);
	if (stats.isFile() && /\.(ya?ml)$/i.test(abs)) return abs;
	if (stats.isDirectory()) {
		const entry = resolveEntryYaml(abs);
		if (entry.kind === "ok" && existsSync(entry.path)) return entry.path;
		throw missingEntryError(`tree at '${abs}'`, entry);
	}
	return null;
}

// Builds the user-facing error for a directory that doesn't declare a usable
// tree entry. Both kinds end with the same escape hatch — pass the YAML
// path directly — so callers always know how to recover.
function missingEntryError(
	subject: string,
	entry:
		| { kind: "no-package-json"; pkgDir: string }
		| { kind: "no-main"; pkgJsonPath: string },
): Error {
	if (entry.kind === "no-package-json") {
		return new Error(
			`${subject}: no package.json found at '${entry.pkgDir}'. ` +
				`Add a package.json with a 'main' field pointing to the tree YAML, ` +
				`or pass the YAML path directly.`,
		);
	}
	return new Error(
		`${subject}: package.json at '${entry.pkgJsonPath}' has no 'main' field. ` +
			`Add a 'main' pointing to the tree YAML (e.g. "main": "TREE.yaml") ` +
			`or pass the YAML path directly.`,
	);
}

function deriveSlugFromYaml(yamlPath: string): string {
	const dir = dirname(yamlPath);
	const pkgPath = join(dir, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
				name?: string;
			};
			if (typeof pkg.name === "string" && pkg.name.length > 0) {
				return sanitiseSlug(pkg.name);
			}
		} catch {
			// Malformed package.json — fall through to the dirname-basename slug.
		}
	}
	return sanitiseSlug(basename(dir));
}

// Execution IDs must match /^[a-z0-9_-]+__[a-z0-9_-]+__\d+$/ (see repos.ts).
// Any character that doesn't fit becomes a hyphen, and the result is trimmed
// of leading/trailing hyphens so an `@scope/name` package collapses cleanly to
// `scope-name`.
function sanitiseSlug(raw: string): string {
	const cleaned = raw
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return cleaned.length > 0 ? cleaned : "tree";
}

export function generateExecutionId(tree: string, summary: string): string {
	const slug = summary
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
	const prefix = `${slug}__${tree}__`;
	const count = ExecutionStore.countByPrefix(prefix);
	return `${prefix}${count + 1}`;
}

export function getNodeAtPath(
	root: NormalizedNode,
	path: number[],
): NormalizedNode {
	let node = root;
	for (const idx of path) {
		if (node.type === "action" || node.type === "ref") break;
		node = node.children[idx];
	}
	return node;
}

// Internal bookkeeping is stored in the execution document's `runtime` field —
// never in $LOCAL — so it isn't exposed by `abtree local read` and can't
// be mutated by `abtree local write`. The tick engine owns it; the CLI
// can't reach it.

export function getNodeResult(
	executionId: string,
	path: number[],
): NodeStatus | null {
	return RuntimeStore.getStatus(executionId, path);
}

export function setNodeResult(
	executionId: string,
	path: number[],
	status: NodeStatus,
) {
	RuntimeStore.setStatus(executionId, path, status);
}

function getStepIndex(executionId: string, path: number[]): number {
	return RuntimeStore.getStep(executionId, path);
}

function setStepIndex(executionId: string, path: number[], step: number) {
	RuntimeStore.setStep(executionId, path, step);
}

// If `node` has a retries config and we haven't exhausted it, reset the
// node's runtime state (status, step index, descendants) and bump the
// retry counter. Returns true if a retry was consumed and the caller
// should treat the node as unstarted; false if the failure should stand.
//
// Intentionally NOT touching $LOCAL — user-written keys (counter,
// review_notes, draft, etc.) persist across retries because that's how
// the next attempt sees what the previous one produced.
function maybeRetry(
	executionId: string,
	path: number[],
	node: NormalizedNode,
): boolean {
	if (node.type === "ref") return false;
	const retries = node.retries ?? 0;
	if (retries <= 0) return false;
	const attempts = RuntimeStore.getRetryCount(executionId, path);
	if (attempts >= retries) return false;
	RuntimeStore.incrementRetryCount(executionId, path);
	RuntimeStore.resetSubtree(executionId, path);
	return true;
}

// Top-level entry point for cmdNext. Handles retries on the ROOT node,
// where there's no parent to detect failure and apply maybeRetry on the
// child's behalf. Composite-internal retries are still handled inside
// tickNode via the per-child status checks.
export function tickRoot(
	executionId: string,
	root: NormalizedNode,
): TickResult {
	let result = tickNode(executionId, [], root);
	while (result.type === "failure" && maybeRetry(executionId, [], root)) {
		result = tickNode(executionId, [], root);
	}
	return result;
}

export function tickNode(
	executionId: string,
	path: number[],
	node: NormalizedNode,
): TickResult {
	if (!node) return { type: "done" };

	if (node.type === "ref") {
		// Cyclic $ref preserved at execution-create time. We can't traverse a
		// cycle, so fail cleanly with a marker on the local store so the
		// caller can see what broke.
		console.error(
			`abtree: cyclic ref '${node.ref}' encountered at path [${path.join(",")}] — cannot tick. Marking action as failure.`,
		);
		return { type: "failure" };
	}

	if (node.type === "action") {
		let status = getNodeResult(executionId, path);
		if (status === "failure" && maybeRetry(executionId, path, node)) {
			status = null; // subtree state was wiped — restart this action's steps
		}
		if (status === "success" || status === "failure") {
			return { type: status === "success" ? "done" : "failure" };
		}
		const stepIdx = getStepIndex(executionId, path);
		if (!node.steps || stepIdx >= node.steps.length) return { type: "done" };
		const step = node.steps[stepIdx];
		if (step.kind === "evaluate") {
			return {
				type: "evaluate",
				name: node.name,
				expression: step.expression,
				path,
				step: stepIdx,
			};
		}
		return {
			type: "instruct",
			name: node.name,
			instruction: step.instruction,
			path,
			step: stepIdx,
		};
	}

	if (node.type === "sequence") {
		for (let i = 0; i < node.children.length; i++) {
			const childPath = [...path, i];
			const child = node.children[i] as NormalizedNode;
			let childStatus = getNodeResult(executionId, childPath);
			if (
				childStatus === "failure" &&
				maybeRetry(executionId, childPath, child)
			) {
				childStatus = null; // child reset — re-tick fresh
			}
			if (childStatus === "failure") return { type: "failure" };
			if (childStatus === "success") continue;
			const result = tickNode(executionId, childPath, child);
			if (result.type === "done") {
				setNodeResult(executionId, childPath, "success");
				continue;
			}
			if (result.type === "failure") {
				setNodeResult(executionId, childPath, "failure");
				// Eagerly try the failed child's retries here. The lazy check
				// at the top of the loop only fires on a subsequent tick, but
				// in sequences/selectors/parallels we propagate failure UP
				// immediately — so without an eager check the inner-composite
				// retry budget never sees the failure (the parent's own
				// failure propagation runs first). Re-attempt this child's
				// index so its fresh tick produces the next request.
				if (maybeRetry(executionId, childPath, child)) {
					i--;
					continue;
				}
				return { type: "failure" };
			}
			return result;
		}
		return { type: "done" };
	}

	if (node.type === "selector") {
		for (let i = 0; i < node.children.length; i++) {
			const childPath = [...path, i];
			const child = node.children[i] as NormalizedNode;
			let childStatus = getNodeResult(executionId, childPath);
			if (
				childStatus === "failure" &&
				maybeRetry(executionId, childPath, child)
			) {
				childStatus = null;
			}
			if (childStatus === "success") return { type: "done" };
			if (childStatus === "failure") continue;
			const result = tickNode(executionId, childPath, child);
			if (result.type === "done") {
				setNodeResult(executionId, childPath, "success");
				return { type: "done" };
			}
			if (result.type === "failure") {
				setNodeResult(executionId, childPath, "failure");
				// Eager retry — see sequence note above.
				if (maybeRetry(executionId, childPath, child)) {
					i--;
					continue;
				}
				continue;
			}
			return result;
		}
		return { type: "failure" };
	}

	if (node.type === "parallel") {
		let allDone = true;
		let firstPending: TickResult | null = null;
		for (let i = 0; i < node.children.length; i++) {
			const childPath = [...path, i];
			const child = node.children[i] as NormalizedNode;
			let childStatus = getNodeResult(executionId, childPath);
			if (
				childStatus === "failure" &&
				maybeRetry(executionId, childPath, child)
			) {
				childStatus = null;
			}
			if (childStatus === "failure") return { type: "failure" };
			if (childStatus === "success") continue;
			const result = tickNode(executionId, childPath, child);
			if (result.type === "done") {
				setNodeResult(executionId, childPath, "success");
				continue;
			}
			if (result.type === "failure") {
				setNodeResult(executionId, childPath, "failure");
				// Eager retry — see sequence note above.
				if (maybeRetry(executionId, childPath, child)) {
					i--;
					continue;
				}
				return { type: "failure" };
			}
			allDone = false;
			if (!firstPending) firstPending = result;
		}
		if (allDone) return { type: "done" };
		// biome-ignore lint/style/noNonNullAssertion: !allDone implies at least one pending child was recorded.
		return firstPending!;
	}

	return { type: "done" };
}

export function getPathForNode(
	root: NormalizedNode,
	target: NormalizedNode,
	path: number[] = [],
): number[] | null {
	if (root === target) return path;
	if (root.type !== "action" && root.type !== "ref") {
		for (let i = 0; i < root.children.length; i++) {
			const found = getPathForNode(root.children[i], target, [...path, i]);
			if (found) return found;
		}
	}
	return null;
}

export { getStepIndex, setStepIndex };
