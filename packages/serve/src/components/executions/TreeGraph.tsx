import { useGetExecutionTree, type TreeNodeData } from "@/client/api";
import {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	type Node,
	type NodeMouseHandler,
	type NodeTypes,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { TreeNode } from "./TreeNode";

interface Props {
	executionId: string;
	selectedPath: string | null;
	tracePathCounts: Record<string, number>;
	onSelectPath: (path: string | null) => void;
}

const nodeTypes: NodeTypes = { abtree: TreeNode };

export function TreeGraph({
	executionId,
	selectedPath,
	tracePathCounts,
	onSelectPath,
}: Props) {
	const { data, error, isLoading } = useGetExecutionTree(executionId, {
		swr: { refreshInterval: 2000 },
	});

	const { nodes, edges } = useMemo(() => {
		const graph = data?.data;
		if (!graph) return { nodes: [] as Node[], edges: [] as Edge[] };
		const nodes: Node[] = graph.nodes.map((n: TreeNodeData) => ({
			id: n.id,
			type: "abtree",
			position: { x: n.x, y: n.y },
			data: {
				name: n.name,
				kind: n.kind,
				status: n.status,
				ref: n.ref,
				traceCount: tracePathCounts[n.path] ?? 0,
			},
			selected: selectedPath === n.path,
			draggable: false,
		}));
		const edges: Edge[] = graph.edges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			type: "smoothstep",
			animated: false,
			style: { stroke: "rgb(98 114 164 / 0.5)", strokeWidth: 1.5 },
		}));
		return { nodes, edges };
	}, [data, selectedPath, tracePathCounts]);

	const onNodeClick: NodeMouseHandler = (_evt, node) => {
		const path = node.id === "root" ? "" : node.id;
		onSelectPath(selectedPath === path ? null : path);
	};

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading tree…
			</div>
		);
	}
	if (error) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-sm text-rose-500">
				Failed to load tree.
			</div>
		);
	}

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			onNodeClick={onNodeClick}
			onPaneClick={() => onSelectPath(null)}
			fitView
			fitViewOptions={{ padding: 0.2 }}
			minZoom={0.2}
			maxZoom={1.5}
			proOptions={{ hideAttribution: true }}
			nodesDraggable={false}
			nodesConnectable={false}
			elementsSelectable
		>
			<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
			<Controls showInteractive={false} />
		</ReactFlow>
	);
}
