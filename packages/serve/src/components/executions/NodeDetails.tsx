import { useGetExecutionTree, type TreeNodeData } from "@/client/api";
import { cn } from "@/lib/utils";
import {
	Box,
	GitBranch,
	GitFork,
	GitMerge,
	Link2,
	Repeat,
	Sparkles,
	Terminal,
	X,
} from "lucide-react";

interface Props {
	executionId: string;
	selectedPath: string | null;
	onClear: () => void;
}

const KIND_META: Record<
	TreeNodeData["kind"],
	{ label: string; accent: string; icon: typeof Box }
> = {
	action: { label: "ACTION", accent: "text-cyan-500", icon: Box },
	sequence: { label: "SEQUENCE", accent: "text-emerald-500", icon: GitMerge },
	selector: { label: "SELECTOR", accent: "text-purple-500", icon: GitFork },
	parallel: { label: "PARALLEL", accent: "text-amber-500", icon: GitBranch },
	ref: { label: "REFERENCE", accent: "text-pink-500", icon: Link2 },
};

export function NodeDetails({ executionId, selectedPath, onClear }: Props) {
	const { data } = useGetExecutionTree(executionId, {
		swr: { refreshInterval: 0 },
	});
	if (selectedPath === null || !data?.data) return null;

	const node = data.data.nodes.find((n) => n.path === selectedPath);
	if (!node) return null;

	const meta = KIND_META[node.kind];
	const Icon = meta.icon;

	return (
		<div className="space-y-3 border-b bg-background/60 p-4">
			<div className="flex items-start gap-2">
				<Icon className={cn("mt-0.5 size-4 shrink-0", meta.accent)} />
				<div className="min-w-0 flex-1">
					<div
						className={cn(
							"font-mono text-[10px] uppercase tracking-wider",
							meta.accent,
						)}
					>
						{meta.label}
						<span className="ml-2 text-muted-foreground">
							path {selectedPath || "root"}
						</span>
					</div>
					<div className="truncate font-semibold">
						{node.kind === "ref" ? `→ ${node.ref}` : node.name}
					</div>
				</div>
				<button
					type="button"
					onClick={onClear}
					className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label="Clear selection"
				>
					<X className="size-4" />
				</button>
			</div>

			{node.retries !== undefined && node.retries > 0 && (
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Repeat className="size-3" />
					retries: <span className="font-mono text-foreground">{node.retries}</span>
				</div>
			)}

			{node.status && (
				<div className="flex items-center gap-1.5 text-xs">
					<span className="text-muted-foreground">runtime status:</span>
					<span
						className={cn(
							"rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
							node.status === "success" &&
								"bg-emerald-500/15 text-emerald-500",
							node.status === "failure" && "bg-rose-500/15 text-rose-500",
							node.status === "running" &&
								"bg-amber-500/15 text-amber-500",
						)}
					>
						{node.status}
					</span>
				</div>
			)}

			{node.steps && node.steps.length > 0 && (
				<ol className="space-y-2">
					{node.steps.map((step, i) => {
						const isEval = step.kind === "evaluate";
						const StepIcon = isEval ? Sparkles : Terminal;
						return (
							<li
								key={`${selectedPath}-${i}`}
								className="rounded-md border bg-card p-3"
							>
								<div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
									<StepIcon
										className={cn(
											"size-3",
											isEval ? "text-purple-500" : "text-cyan-500",
										)}
									/>
									<span className={isEval ? "text-purple-500" : "text-cyan-500"}>
										step {i + 1} · {step.kind}
									</span>
								</div>
								<p
									className={cn(
										"whitespace-pre-wrap text-xs leading-relaxed",
										isEval && "font-mono",
									)}
								>
									{step.text}
								</p>
							</li>
						);
					})}
				</ol>
			)}

			{node.kind !== "action" && node.kind !== "ref" && (
				<div className="text-xs text-muted-foreground">
					Composite node — see the children below for the actual work.
				</div>
			)}
		</div>
	);
}
