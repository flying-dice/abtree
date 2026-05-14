/**
 * Tiny jest-style DSL for authoring abtree behaviour trees in TypeScript.
 *
 * A file's "output" is just a node (composite or action). Package metadata
 * (`name`, `version`) lives in `package.json`; the build pipeline pairs it
 * with the emitted node at write time.
 *
 * @remarks
 *
 * **State scopes.** Two flat, execution-wide scopes with different *roles*:
 *
 * - **locals** — read/write containers the tree fills in as it runs.
 *   Actions write values into `$LOCAL`; later steps read them out. Initial
 *   values declared here can be `null` (or anything else) — they are just
 *   the starting state of the container.
 * - **globals** — values substituted into instructions at runtime. The
 *   agent reads `$GLOBAL.<key>` while performing a step and interpolates
 *   whatever the consumer set at execution-create (or, if they didn't
 *   override, the default declared here). Defaults SHOULD be concrete
 *   values, not `null` — a `null` global interpolated into an instruction
 *   is almost always a bug.
 *
 * Each handle is its own variable. {@link local} and {@link global}
 * register the key + value and return a path **string** branded with type
 * information. Drop the string into a template literal anywhere:
 *
 * ```ts
 * const greeting = local("greeting", null);
 * instruct(`write to ${greeting}`);   // → "write to $LOCAL.greeting"
 * ```
 *
 * Rename the variable in your editor and TypeScript surfaces every
 * reference; rename the key string and you only have to update one place.
 *
 * **Module scope vs in-body.** You can call {@link local} / {@link global}
 * either at module scope or inside a composite/action body:
 *
 * - **Module scope** — registers into a tree-wide {@link ambient} bucket
 *   (the build pipeline tacks it onto the root).
 * - **In-body** — attaches state to the **current** node and **mangles**
 *   the key with that node's name (so two components declaring overlapping
 *   key names don't collide when the runtime flattens).
 *
 * The runtime flattens state from every node into one `$LOCAL` and one
 * `$GLOBAL` at execution-create.
 *
 * @example
 * ```ts
 * import { action, global, instruct, local, sequence } from "./dsl.ts";
 *
 * const program = sequence("Greet", (n) => {
 *   n.description = "Greet the current user.";
 *   const greeting = local("greeting", null);
 *   const currentUser = global("current_user", "world");
 *
 *   action("Write_Greeting", () => {
 *     instruct(`Write "Hello, ${currentUser}" to ${greeting}.`);
 *   });
 * });
 * ```
 *
 * @packageDocumentation
 */

import { createHash } from "node:crypto";
import pkg from "../package.json" with { type: "json" };
import { returnInstruct, spawnInstruct } from "./delegate-templates.ts";

// ─── node shape ──────────────────────────────────────────────────────────

/**
 * The composite (children-bearing) node kinds. Maps directly onto the
 * abtree runtime's three branching primitives.
 *
 * - `sequence` — run children left-to-right; fail on first child failure.
 * - `selector` — run children left-to-right; succeed on first child success.
 * - `parallel` — run all children together; succeed when all succeed.
 */
export type CompositeKind = "sequence" | "selector" | "parallel";

/**
 * One leaf inside an {@link ActionNode}'s `steps` array.
 *
 * - `{ evaluate }` — the action asks the runtime to gate on a string
 *   expression. The runtime parses the expression, reads any referenced
 *   `$LOCAL.<key>` / `$GLOBAL.<key>` paths, and returns success/failure
 *   accordingly.
 * - `{ instruct }` — the action instructs an agent (or user) to perform
 *   the named work. The string is interpolated with current `$LOCAL`/
 *   `$GLOBAL` values at execution time.
 */
export type Step = { evaluate: string } | { instruct: string };

/**
 * Metadata fields that can appear on any node (composite or action).
 *
 * Assign these via the node argument passed into a body callback —
 * `sequence("X", (n) => { n.description = "..."; n.retries = 2; })` —
 * rather than via a separate options object.
 */
export interface NodeMeta {
	/** Human-readable description of the node's purpose. Surfaced in tooling and the registry. */
	description?: string;

	/**
	 * Number of times the runtime should retry the node on failure before
	 * giving up. Omit (or set to `0`) for no retries.
	 */
	retries?: number;

	/**
	 * Per-node state declarations. Populated automatically by in-body calls
	 * to {@link local} / {@link global}.
	 *
	 * The runtime flattens `state.local` and `state.global` across every
	 * node in the tree into one `$LOCAL` and one `$GLOBAL` at
	 * execution-create; collisions are last-write-wins.
	 */
	state?: {
		local?: Record<string, unknown>;
		global?: Record<string, unknown>;
	};
}

/**
 * A composite node — branches on its children. Produced by
 * {@link sequence}, {@link selector}, or {@link parallel}.
 */
export interface CompositeNode extends NodeMeta {
	type: CompositeKind;
	name: string;
	children: TreeNode[];
}

/**
 * A leaf action node — carries an ordered list of evaluate/instruct steps.
 * Produced by {@link action}.
 */
export interface ActionNode extends NodeMeta {
	type: "action";
	name: string;
	steps: Step[];
}

/** Discriminated union of every node kind that the DSL produces. */
export type TreeNode = CompositeNode | ActionNode;

// ─── ambient state ───────────────────────────────────────────────────────

/**
 * Module-scope state bucket. {@link local} and {@link global} calls made
 * **outside** any composite/action body deposit their key + value here
 * (unmangled).
 *
 * Read this after the authoring module evaluates; the build pipeline
 * writes it wherever the package keeps tree-execution defaults
 * (`package.json:abtree.state`, a sibling state file, etc.). The runtime
 * folds these into the flat `$LOCAL` / `$GLOBAL` at execution-create
 * alongside per-node `state` declarations.
 */
export const ambient: {
	local: Record<string, unknown>;
	global: Record<string, unknown>;
} = { local: {}, global: {} };

// Brand tags — declared but never assigned at runtime; purely type-level.
declare const localRefBrand: unique symbol;
declare const globalRefBrand: unique symbol;

/**
 * A reference to a `$LOCAL.<key>` path, returned by {@link local}.
 *
 * At runtime this is a plain string (so template-literal interpolation
 * just works). At the type level it carries:
 *
 * - the **scope brand** (so a `LocalRef` cannot be assigned to a
 *   {@link GlobalRef} and vice-versa), and
 * - **`T`** — the value type stored at the reference.
 *
 * @typeParam T - The value type stored at the reference.
 */
export type LocalRef<T = unknown> = string & {
	readonly [localRefBrand]: T;
};

/**
 * A reference to a `$GLOBAL.<key>` path, returned by {@link global}.
 *
 * At runtime this is a plain string (so template-literal interpolation
 * just works). At the type level it carries:
 *
 * - the **scope brand** (so a `GlobalRef` cannot be assigned to a
 *   {@link LocalRef} and vice-versa), and
 * - **`T`** — the value type substituted into instructions at runtime.
 *
 * @typeParam T - The value type stored at the reference.
 */
export type GlobalRef<T = unknown> = string & {
	readonly [globalRefBrand]: T;
};

/**
 * Either a {@link LocalRef} or {@link GlobalRef}. Useful for APIs that
 * accept a reference from either scope.
 *
 * @typeParam T - The value type stored at the reference.
 */
export type Ref<T = unknown> = LocalRef<T> | GlobalRef<T>;

// In-body declarations mangle the key with the enclosing node's name so
// independent components can declare overlapping key names without
// colliding when the runtime flattens. Module-scope declarations don't
// mangle — that's the author's tree-wide ambient bucket, intentionally
// global.
function attach(
	scope: "local" | "global",
	key: string,
	value: unknown,
): string {
	const top = stack[stack.length - 1];
	if (!top) {
		ambient[scope][key] = value;
		return key;
	}
	const mangled = `${top.node.name}__${key}`;
	const node = top.node;
	node.state ??= {};
	node.state[scope] ??= {};
	(node.state[scope] as Record<string, unknown>)[mangled] = value;
	return mangled;
}

/**
 * Declare a `$LOCAL` read/write container and return a path reference
 * pointing at it.
 *
 * The container's initial value goes into `$LOCAL.<mangled-key>` at
 * execution-create; actions read and write the container during the run.
 *
 * - Called at **module scope** → registers into the tree-wide
 *   {@link ambient} bucket using `key` as-is.
 * - Called **inside** a composite/action body → attaches to the current
 *   node's `state.local` with the key mangled as `<NodeName>__<key>`.
 *
 * The returned {@link LocalRef} is a branded string. Interpolate it
 * inline in {@link evaluate} / {@link instruct} expressions:
 *
 * @example
 * ```ts
 * const greeting = local("greeting", null);
 * instruct(`write the result to ${greeting}`);
 * // → "write the result to $LOCAL.<NodeName>__greeting"
 * ```
 *
 * @typeParam T - The value type the container holds.
 *
 * @param key - Identifier for the container. Mangled with the enclosing
 *   node's name when called inside a body.
 * @param defaultValue - Initial value placed into `$LOCAL.<key>` at
 *   execution-create. `null` is fine — the container will be filled in
 *   as the tree runs.
 *
 * @returns A branded path string `$LOCAL.<mangled-key>`, typed as
 *   {@link LocalRef}.
 */
export function local<T>(key: string, defaultValue: T): LocalRef<T> {
	const mangled = attach("local", key, defaultValue);
	return `$LOCAL.${mangled}` as LocalRef<T>;
}

/**
 * Declare a `$GLOBAL` variable and return a path reference pointing at
 * it.
 *
 * Globals are values **substituted into instructions** at runtime. The
 * consumer can override the value at execution-create; if they don't, the
 * default declared here is what the agent interpolates.
 *
 * - Called at **module scope** → registers into the tree-wide
 *   {@link ambient} bucket using `key` as-is.
 * - Called **inside** a composite/action body → attaches to the current
 *   node's `state.global` with the key mangled as `<NodeName>__<key>`.
 *
 * The returned {@link GlobalRef} is a branded string. Interpolate it
 * inline in {@link evaluate} / {@link instruct} expressions:
 *
 * @example
 * ```ts
 * const currentUser = global("current_user", "world");
 * instruct(`Write "Hello, ${currentUser}".`);
 * // → 'Write "Hello, $GLOBAL.<NodeName>__current_user".'
 * ```
 *
 * @typeParam T - The value type stored at the reference.
 *
 * @param key - Identifier for the variable. Mangled with the enclosing
 *   node's name when called inside a body.
 * @param value - Default value used if the consumer doesn't override at
 *   execution-create. Should be **concrete** — a `null` global
 *   interpolated into an instruction is almost always a bug.
 *
 * @returns A branded path string `$GLOBAL.<mangled-key>`, typed as
 *   {@link GlobalRef}.
 */
export function global<T>(key: string, value: T): GlobalRef<T> {
	const mangled = attach("global", key, value);
	return `$GLOBAL.${mangled}` as GlobalRef<T>;
}

// ─── implicit-frame stack ────────────────────────────────────────────────

type Frame =
	| { kind: "composite"; node: CompositeNode }
	| { kind: "action"; node: ActionNode };

const stack: Frame[] = [];

function compositeParent(): CompositeNode | null {
	const top = stack[stack.length - 1];
	if (!top) return null;
	if (top.kind !== "composite") {
		throw new Error(
			`expected a composite parent, got <${top.node.type}> "${top.node.name}"`,
		);
	}
	return top.node;
}

function actionFrame(): ActionNode {
	const top = stack[stack.length - 1];
	if (!top || top.kind !== "action") {
		throw new Error("evaluate()/instruct() must be inside action()");
	}
	return top.node;
}

// ─── primitives ──────────────────────────────────────────────────────────

function composite(
	kind: CompositeKind,
	name: string,
	body: (node: CompositeNode) => void,
): CompositeNode {
	const node: CompositeNode = { type: kind, name, children: [] };
	compositeParent()?.children.push(node);
	stack.push({ kind: "composite", node });
	try {
		body(node);
	} finally {
		stack.pop();
	}
	return node;
}

/**
 * Declare a `sequence` composite. Children run left-to-right; the
 * sequence fails on the first child failure and succeeds when every
 * child succeeds.
 *
 * The body callback receives the newly-created {@link CompositeNode} —
 * assign `n.description`, `n.retries`, etc. directly:
 *
 * @example
 * ```ts
 * sequence("Authenticate", (n) => {
 *   n.description = "Read user, then verify session.";
 *   action("Read_User", () => instruct("..."));
 *   action("Verify_Session", () => instruct("..."));
 * });
 * ```
 *
 * @param name - The sequence's name. Used as a key-mangling prefix for
 *   any {@link local} / {@link global} calls made inside the body.
 * @param body - Body callback. Register children via {@link sequence} /
 *   {@link selector} / {@link parallel} / {@link action} calls.
 *
 * @returns The created {@link CompositeNode}.
 */
export function sequence(
	name: string,
	body: (node: CompositeNode) => void,
): CompositeNode {
	return composite("sequence", name, body);
}

/**
 * Declare a `selector` composite. Children run left-to-right; the
 * selector succeeds on the first child success and fails when every
 * child fails.
 *
 * The body callback receives the newly-created {@link CompositeNode} —
 * assign `n.description`, `n.retries`, etc. directly.
 *
 * @example
 * ```ts
 * selector("Choose_Greeting", () => {
 *   action("Morning",  () => { evaluate("..."); instruct("..."); });
 *   action("Evening",  () => { evaluate("..."); instruct("..."); });
 *   action("Fallback", () => { instruct("..."); });
 * });
 * ```
 *
 * @param name - The selector's name. Used as a key-mangling prefix for
 *   any {@link local} / {@link global} calls made inside the body.
 * @param body - Body callback. Register children via {@link sequence} /
 *   {@link selector} / {@link parallel} / {@link action} calls.
 *
 * @returns The created {@link CompositeNode}.
 */
export function selector(
	name: string,
	body: (node: CompositeNode) => void,
): CompositeNode {
	return composite("selector", name, body);
}

/**
 * Declare a `parallel` composite. All children run together; the
 * parallel succeeds when every child has succeeded and fails as soon as
 * any child fails.
 *
 * The body callback receives the newly-created {@link CompositeNode} —
 * assign `n.description`, `n.retries`, etc. directly.
 *
 * @param name - The parallel's name. Used as a key-mangling prefix for
 *   any {@link local} / {@link global} calls made inside the body.
 * @param body - Body callback. Register children via {@link sequence} /
 *   {@link selector} / {@link parallel} / {@link action} calls.
 *
 * @returns The created {@link CompositeNode}.
 */
export function parallel(
	name: string,
	body: (node: CompositeNode) => void,
): CompositeNode {
	return composite("parallel", name, body);
}

/**
 * Declare a leaf `action` node. The body callback registers ordered
 * evaluate/instruct steps via {@link evaluate} / {@link instruct}.
 *
 * The callback receives the newly-created {@link ActionNode} — assign
 * `a.description`, `a.retries`, etc. directly:
 *
 * @example
 * ```ts
 * action("Authenticate", (a) => {
 *   a.retries = 2;
 *   a.description = "Authenticate the current user.";
 *   evaluate(`${userId} is set`);
 *   instruct(`Read auth token for ${userId} and write it to ${authToken}.`);
 * });
 * ```
 *
 * @param name - The action's name. Used as a key-mangling prefix for any
 *   {@link local} / {@link global} calls made inside the body.
 * @param body - Body callback. Register steps via {@link evaluate} /
 *   {@link instruct} calls in the order they should run.
 *
 * @returns The created {@link ActionNode}.
 */
export function action(
	name: string,
	body: (node: ActionNode) => void,
): ActionNode {
	const node: ActionNode = { type: "action", name, steps: [] };
	compositeParent()?.children.push(node);
	stack.push({ kind: "action", node });
	try {
		body(node);
	} finally {
		stack.pop();
	}
	return node;
}

/**
 * Add an `evaluate` step to the current action.
 *
 * The runtime parses the expression, reads every `$LOCAL.<key>` /
 * `$GLOBAL.<key>` path it references, and decides whether the step
 * succeeds or fails accordingly.
 *
 * Must be called inside an {@link action} body — calling outside throws.
 *
 * @example
 * ```ts
 * action("Determine_Time", () => {
 *   const timeOfDay = local("time_of_day", null);
 *   evaluate(`${timeOfDay} is set`);
 * });
 * ```
 *
 * @param expression - The expression the runtime should evaluate. Use
 *   {@link local} / {@link global} refs via template-literal
 *   interpolation to reference state.
 *
 * @throws If called outside an {@link action} body.
 */
export function evaluate(expression: string): void {
	actionFrame().steps.push({ evaluate: expression });
}

/**
 * Add an `instruct` step to the current action.
 *
 * The runtime hands the rendered string to the agent (or user) driving
 * the action. References to `$LOCAL.<key>` / `$GLOBAL.<key>` are resolved
 * to their current values at execution time.
 *
 * Whitespace in the input is normalised: leading/trailing whitespace is
 * trimmed, and any run of internal whitespace (spaces, tabs, newlines)
 * collapses to a single space. That lets you write multi-line template
 * literals without leaking indentation into the emitted instruction.
 *
 * Must be called inside an {@link action} body — calling outside throws.
 *
 * @example
 * ```ts
 * action("Write_Greeting", () => {
 *   const greeting = local("greeting", null);
 *   const currentUser = global("current_user", "world");
 *   instruct(`Write "Hello, ${currentUser}" to ${greeting}.`);
 * });
 * ```
 *
 * @param text - The instruction text. Use {@link local} / {@link global}
 *   refs via template-literal interpolation to reference state.
 *
 * @throws If called outside an {@link action} body.
 */
export function instruct(text: string): void {
	actionFrame().steps.push({ instruct: text.trim().replace(/\s+/g, " ") });
}

// ─── delegate sugar ──────────────────────────────────────────────────────

/**
 * Author-supplied options for a {@link delegate} scope.
 *
 * All three fields are optional. They control how the boilerplate
 * baked into the `Spawn_<name>` and `Return_To_Parent_<name>` marker
 * actions reads, and whether the Return action gates on a `$LOCAL`
 * write.
 */
export interface DelegateOptions {
	/**
	 * Free-form text describing what the subagent should do. Interpolated
	 * verbatim into the Spawn instruct under a `BRIEF:` label so it is
	 * distinguishable from the surrounding boilerplate.
	 */
	brief?: string;

	/**
	 * Model hint for the spawned subagent (e.g. `"haiku"`, `"sonnet"`,
	 * `"opus"`). Advisory only — abtree does not enforce it; whether the
	 * parent agent's harness honours the hint is up to the harness. The
	 * generated Spawn instruct says so explicitly.
	 */
	model?: string;

	/**
	 * Optional `$LOCAL` reference the inner work is expected to populate.
	 * When set, the `Return_To_Parent_<name>` action gets a leading
	 * `evaluate("${output} is set")` step so the scope fails if the
	 * subagent submitted success for every inner action without actually
	 * writing the declared slot. (Inner-body action failures already
	 * surface via the standard tree-walk failure path and do not need the
	 * gate.)
	 */
	output?: LocalRef<unknown>;
}

// Build-time-deterministic exit token. Same scope name + same DSL version
// → same token, so a regenerated tree file is reproducible across builds.
// The token is a clean-exit signal, not a security boundary; baking it
// into the tree file in plaintext is intentional.
function deriveExitToken(scopeName: string): string {
	const hash = createHash("sha256")
		.update(`${scopeName}:${pkg.version}`)
		.digest("hex")
		.slice(0, 8);
	return `DLG__${scopeName}__${hash}`;
}

/**
 * Declare a delegated subagent scope.
 *
 * `delegate` is pure DSL sugar — the runtime does not know about it. It
 * desugars into a fresh `sequence` named exactly `name` whose children
 * are `[Spawn_<name>, ...body-children, Return_To_Parent_<name>]`:
 *
 * - The `Spawn_<name>` marker action carries an `instruct` that tells
 *   the parent agent to submit success, spawn a subagent (honouring
 *   `opts.brief` and `opts.model`), block until the subagent returns a
 *   build-time-generated exit token, and resume.
 * - The user's `body` children sit between the markers as ordinary
 *   tree nodes. The spawned subagent drives them via `abtree
 *   next/eval/submit` exactly like the parent would.
 * - The `Return_To_Parent_<name>` marker action is the subagent's exit
 *   point. Its `instruct` tells the subagent to submit success and
 *   return only the exit token; if `opts.output` was supplied, the
 *   action also gates on `${output} is set` so the scope fails when the
 *   subagent didn't actually populate the declared slot.
 *
 * Wrapping the markers + body in their own `sequence` preserves
 * single-unit semantics: a `delegate(...)` placed inside a `selector`
 * parent behaves as "try this delegated path; on failure, fall through
 * to the next sibling".
 *
 * Nested `delegate(...)` calls work by construction — each scope gets
 * its own token derived from its own name.
 *
 * @example
 * ```ts
 * const greeting = local("greeting", null);
 *
 * delegate("Compose_Greeting", {
 *   brief: "Pick the time-of-day branch and compose one short sentence.",
 *   model: "haiku",
 *   output: greeting,
 * }, () => {
 *   selector("Choose_Greeting", () => {
 *     action("Morning_Greeting", () => { ... });
 *     action("Afternoon_Greeting", () => { ... });
 *     action("Evening_Greeting", () => { ... });
 *   });
 * });
 * ```
 *
 * @param name - The scope's name. Becomes the wrapping sequence's name
 *   and prefixes the marker actions (`Spawn_<name>`,
 *   `Return_To_Parent_<name>`).
 * @param options - Author-supplied {@link DelegateOptions}.
 * @param body - Body callback. Register inner children with
 *   {@link sequence} / {@link selector} / {@link parallel} /
 *   {@link action} just as inside any other composite body.
 *
 * @returns The wrapping {@link CompositeNode}.
 */
export function delegate(
	name: string,
	options: DelegateOptions,
	body: () => void,
): CompositeNode {
	const token = deriveExitToken(name);
	return sequence(name, () => {
		action(`Spawn_${name}`, () => {
			instruct(spawnInstruct(name, token, options));
		});
		body();
		action(`Return_To_Parent_${name}`, () => {
			if (options.output) evaluate(`${options.output} is set`);
			instruct(returnInstruct(name, token));
		});
	});
}

// ─── build helper ────────────────────────────────────────────────────────

/**
 * Build the canonical TreeFile object from a DSL-authored root node and
 * the surrounding package metadata. Combines the module-level
 * {@link ambient} state with the root, threads in `name` / `version` /
 * `description` from package.json, and stamps the canonical `$schema`
 * URL.
 *
 * Intended for use in a tree package's `scripts/build.ts`.
 *
 * @param opts.pkg - Package metadata (`name`, `version`, optional `description`).
 * @param opts.tree - The root node produced by the DSL.
 */
export function buildTreeFile(opts: {
	pkg: { name: string; version: string; description?: string };
	tree: TreeNode;
}): {
	$schema: string;
	name: string;
	version: string;
	description?: string;
	state?: { local?: Record<string, unknown>; global?: Record<string, unknown> };
	tree: TreeNode;
} {
	const out: {
		$schema: string;
		name: string;
		version: string;
		description?: string;
		state?: {
			local?: Record<string, unknown>;
			global?: Record<string, unknown>;
		};
		tree: TreeNode;
	} = {
		$schema: "https://abtree.sh/schemas/tree.schema.json",
		name: opts.pkg.name,
		version: opts.pkg.version,
		tree: opts.tree,
	};
	if (opts.pkg.description) out.description = opts.pkg.description;
	const state: {
		local?: Record<string, unknown>;
		global?: Record<string, unknown>;
	} = {};
	if (Object.keys(ambient.local).length > 0) state.local = ambient.local;
	if (Object.keys(ambient.global).length > 0) state.global = ambient.global;
	if (Object.keys(state).length > 0) out.state = state;
	return out;
}
