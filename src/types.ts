export type Step = { evaluate: string } | { instruct: string };

export type NormalizedStep =
	| { kind: "evaluate"; expression: string }
	| { kind: "instruct"; instruction: string };

export type ActionNode = {
	type: "action";
	name: string;
	steps: Step[];
	retries?: number;
};

export type CompositeNode = {
	type: "sequence" | "selector" | "parallel";
	name: string;
	children: AbtNode[];
	retries?: number;
};

// A reference node — preserved literally in the snapshot when it's part of
// a cycle the ref-parser declined to expand. Cannot be ticked; surfacing it
// at runtime is a hard failure with a clear message.
export type RefNode = {
	$ref: string;
};

export type AbtNode = ActionNode | CompositeNode | RefNode;

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

export type TreeFile = {
	name: string;
	version: string;
	description?: string;
	state?: {
		local?: Record<string, unknown>;
		global?: Record<string, unknown>;
	};
	tree: AbtNode;
};

export type ParsedTree = {
	local: Record<string, unknown>;
	global: Record<string, unknown>;
	root: NormalizedNode;
};

export interface ExecutionRow {
	id: string;
	tree: string;
	summary: string;
	status: string;
	snapshot: string;
	cursor: string;
	phase: string;
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
