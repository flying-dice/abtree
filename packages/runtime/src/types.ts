// Input types (Step, ActionNode, CompositeNode, RefNode, AbtNode, TreeFile) live in
// ./schemas.ts where they are derived from the zod schemas — single source of truth.

export type {
	AbtNode,
	ActionNode,
	CompositeNode,
	RefNode,
	Step,
	TreeFile,
} from "./schemas.ts";

export type NormalizedStep =
	| { kind: "evaluate"; expression: string }
	| { kind: "instruct"; instruction: string };

export type NormalizedActionNode = {
	type: "action";
	name: string;
	steps: NormalizedStep[];
	retries?: number;
};

export type NormalizedCompositeNode = {
	type: "sequence" | "selector" | "parallel";
	name: string;
	children: NormalizedNode[];
	retries?: number;
};

export type NormalizedRefNode = {
	type: "ref";
	ref: string;
};

export type NormalizedNode =
	| NormalizedActionNode
	| NormalizedCompositeNode
	| NormalizedRefNode;

export type ParsedTree = {
	local: Record<string, unknown>;
	global: Record<string, unknown>;
	root: NormalizedNode;
};

export type TraceKind = "evaluate" | "instruct" | "protocol";

// One entry of the execution audit log. Append-only; written by coreEval /
// coreSubmit after each decision. The engine ignores `note` — it exists for
// post-hoc inspection of how the agent reasoned through the tree.
export interface TraceEntry {
	ts: string;
	kind: TraceKind;
	// Cursor as the agent acted on it (captured before any engine mutation).
	cursor: string;
	name: string;
	// Raw submission from the agent: "true" | "false" for eval; "success" |
	// "failure" | "running" for performing-phase submit; "accept" | "reject" |
	// "running" for protocol acknowledgement.
	submitted: string;
	// Engine-side status string returned to the agent (e.g. "evaluation_passed").
	outcome: string;
	note?: string;
}

export interface ExecutionRow {
	id: string;
	tree: string;
	summary: string;
	status: string;
	// Etag (lowercase hex SHA-256) of the ParsedTree, addressing a file in SNAPSHOTS_DIR.
	snapshot: string;
	cursor: string;
	phase: string;
	// Whether the agent has acknowledged the runtime protocol for this execution.
	// Until true, `abtree next` returns a synthetic instruct demanding the agent
	// read `abtree docs execute` and submit success to accept.
	protocol_accepted: boolean;
	// Append-only audit log of agent decisions. Empty at create; cleared on reset.
	trace: TraceEntry[];
	created_at: string;
	updated_at: string;
}

export interface RuntimeState {
	node_status: Record<string, NodeStatus>;
	step_index: Record<string, number>;
	retry_count: Record<string, number>;
}

export interface ExecutionDoc extends ExecutionRow {
	local: Record<string, unknown>;
	global: Record<string, unknown>;
	runtime: RuntimeState;
}

export type NodeStatus = "success" | "failure" | "running";

export type TickResult =
	| {
			type: "evaluate";
			name: string;
			expression: string;
			path: number[];
			step: number;
	  }
	| {
			type: "instruct";
			name: string;
			instruction: string;
			path: number[];
			step: number;
	  }
	| { type: "done" }
	| { type: "failure" };
