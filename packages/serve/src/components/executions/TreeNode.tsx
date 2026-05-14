import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
	Box,
	Compass,
	GitBranch,
	GitFork,
	GitMerge,
	Link2,
} from "lucide-react";

export type NodeKind =
	| "action"
	| "sequence"
	| "selector"
	| "parallel"
	| "ref";

export type NodeStatus = "success" | "failure" | "running" | null;

export interface TreeNodeProps {
	data: {
		name: string;
		kind: NodeKind;
		status: NodeStatus;
		traceCount: number;
		ref: string | null;
		selected?: boolean;
	};
	selected?: boolean;
}

const KIND_META: Record<
	NodeKind,
	{ label: string; accent: string; icon: typeof Box }
> = {
	action: { label: "ACTION", accent: "border-l-cyan-400", icon: Box },
	sequence: { label: "SEQUENCE", accent: "border-l-emerald-400", icon: GitMerge },
	selector: { label: "SELECTOR", accent: "border-l-purple-400", icon: GitFork },
	parallel: { label: "PARALLEL", accent: "border-l-amber-400", icon: GitBranch },
	ref: { label: "REFERENCE", accent: "border-l-pink-400", icon: Link2 },
};

const STATUS_RING: Record<Exclude<NodeStatus, null>, string> = {
	success: "ring-emerald-400/70",
	failure: "ring-rose-400/70",
	running: "ring-amber-400/70 animate-pulse",
};

export function TreeNode({ data, selected }: TreeNodeProps) {
	const meta = KIND_META[data.kind];
	const Icon = meta.icon;
	return (
		<div
			className={cn(
				"group flex h-[92px] w-[180px] flex-col justify-between rounded-lg border bg-card text-card-foreground shadow-sm transition",
				"border-l-4",
				meta.accent,
				selected && "ring-2 ring-primary",
				data.status && STATUS_RING[data.status],
				data.status && "ring-2",
			)}
		>
			<Handle type="target" position={Position.Top} className="!bg-muted-foreground/40 !border-none" />
			<div className="flex items-center gap-1.5 px-3 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
				<Icon className="size-3" />
				{meta.label}
			</div>
			<div className="line-clamp-2 px-3 text-sm font-medium leading-tight">
				{data.kind === "ref" ? `→ ${data.ref}` : data.name}
			</div>
			<div className="flex items-center justify-between px-3 pb-2 text-[10px] text-muted-foreground">
				{data.traceCount > 0 ? (
					<span className="inline-flex items-center gap-1">
						<Compass className="size-3" />
						{data.traceCount}
					</span>
				) : (
					<span />
				)}
				{data.status && (
					<span
						className={cn(
							"rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
							data.status === "success" &&
								"bg-emerald-500/15 text-emerald-500",
							data.status === "failure" &&
								"bg-rose-500/15 text-rose-500",
							data.status === "running" &&
								"bg-amber-500/15 text-amber-500",
						)}
					>
						{data.status}
					</span>
				)}
			</div>
			<Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40 !border-none" />
		</div>
	);
}
