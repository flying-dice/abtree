export type Step = { evaluate: string } | { instruct: string };

export type NormalizedStep =
	| { kind: "evaluate"; expression: string }
	| { kind: "instruct"; instruction: string };

export type ActionNode = {
	type: "action";
	name: string;
	steps: Step[];
};

export type CompositeNode = {
	type: "sequence" | "selector" | "parallel";
	name: string;
	children: AbtNode[];
};

export type AbtNode = ActionNode | CompositeNode;

export type NormalizedActionNode = {
	type: "action";
	name: string;
	steps: NormalizedStep[];
};

export type NormalizedCompositeNode = {
	type: "sequence" | "selector" | "parallel";
	name: string;
	children: NormalizedNode[];
};

export type NormalizedNode = NormalizedActionNode | NormalizedCompositeNode;

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

export interface FlowRow {
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

export interface FlowDoc extends FlowRow {
	local: Record<string, unknown>;
	global: Record<string, unknown>;
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
