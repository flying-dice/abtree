// Barrel: the public surface of the abtree runtime engine.
//
// Internal modules import each other via relative paths (`./paths.ts`,
// `./deps/resolve.ts`, etc.); external consumers (the CLI, tests) reach in
// through this file.

export * from "./cursor.ts";
export { parseNodeModulesRef } from "./deps/parse.ts";
export {
	type EntryResolution,
	findNodeModulesPkg,
	makeNodeModulesResolver,
	resolveEntryYaml,
} from "./deps/resolve.ts";
export type { NodeModulesRef } from "./deps/types.ts";
export { rebuildMermaid } from "./mermaid.ts";
export {
	ABTREE_DIR,
	EXECUTIONS_DIR,
	ensureDir,
	HOME_ABTREE_DIR,
	HOME_TREES_DIR,
	SNAPSHOTS_DIR,
	TREE_SOURCES,
	TREES_DIR,
} from "./paths.ts";
export { ExecutionStore, setMutationListener } from "./repos.ts";
export { RuntimeStore } from "./runtime-store.ts";
export { buildJsonSchema, TreeFileSchema } from "./schemas.ts";
export { TreeSnapshotStore } from "./snapshots.ts";
export {
	generateExecutionId,
	getNodeAtPath,
	getNodeResult,
	getPathForNode,
	type LoadedTree,
	loadTree,
	setNodeResult,
	setStepIndex,
	tickNode,
	tickRoot,
} from "./tree.ts";
export type {
	AbtNode,
	ActionNode,
	CompositeNode,
	ExecutionDoc,
	ExecutionRow,
	NodeStatus,
	NormalizedActionNode,
	NormalizedCompositeNode,
	NormalizedNode,
	NormalizedRefNode,
	NormalizedStep,
	ParsedTree,
	RefNode,
	RuntimeState,
	Step,
	TickResult,
	TreeFile,
} from "./types.ts";
export { die, out } from "./utils.ts";
export {
	normalizeNode,
	normalizeStep,
	parseEvalResult,
	parseExecutionId,
	parseScopePath,
	parseSubmitStatus,
	parseSummary,
	parseTreeSlug,
	validateTreeFile,
} from "./validate.ts";
