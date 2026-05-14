import { useGetExecution } from "@/client/api";
import { useMemo, useState } from "react";
import { NodeDetails } from "./NodeDetails";
import { StatePanel } from "./StatePanel";
import { TraceInspector } from "./TraceInspector";
import { TreeGraph } from "./TreeGraph";

interface Props {
	executionId: string;
}

function parseCursorPath(cursor: string): string {
	if (!cursor || cursor === "null") return "";
	try {
		const c = JSON.parse(cursor) as { path: number[] };
		return c.path?.join(".") ?? "";
	} catch {
		return "";
	}
}

export function ExecutionView({ executionId }: Props) {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const { data, error, isLoading } = useGetExecution(executionId, {
		swr: { refreshInterval: 2000 },
	});

	const execution = data?.data;

	const tracePathCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		if (!execution) return counts;
		for (const entry of execution.trace) {
			const p = parseCursorPath(entry.cursor);
			counts[p] = (counts[p] ?? 0) + 1;
		}
		return counts;
	}, [execution]);

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading execution…
			</div>
		);
	}
	if (error || !execution) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-sm text-rose-500">
				Failed to load execution.
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<header className="flex flex-col gap-1 border-b bg-background/50 px-6 py-4">
				<div className="flex items-center gap-3 text-xs">
					<span className="font-mono text-muted-foreground">
						{execution.tree}
					</span>
					<span
						className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
						style={{
							background:
								execution.status === "complete"
									? "rgb(16 185 129 / 0.15)"
									: execution.status === "failed"
										? "rgb(244 63 94 / 0.15)"
										: "rgb(245 158 11 / 0.15)",
							color:
								execution.status === "complete"
									? "rgb(16 185 129)"
									: execution.status === "failed"
										? "rgb(244 63 94)"
										: "rgb(245 158 11)",
						}}
					>
						{execution.status}
					</span>
					<span className="text-muted-foreground">phase: {execution.phase}</span>
				</div>
				<h1 className="text-lg font-semibold">
					{execution.summary || execution.id}
				</h1>
			</header>

			<div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]">
				<div className="flex min-h-0 flex-col">
					<div className="min-h-0 flex-1">
						<TreeGraph
							executionId={execution.id}
							selectedPath={selectedPath}
							tracePathCounts={tracePathCounts}
							onSelectPath={setSelectedPath}
						/>
					</div>
					<div className="border-t bg-muted/20">
						<StatePanel execution={execution} />
					</div>
				</div>
				<aside className="flex min-h-0 flex-col overflow-auto border-l bg-background/40">
					<NodeDetails
						executionId={execution.id}
						selectedPath={selectedPath}
						onClear={() => setSelectedPath(null)}
					/>
					<div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
						LLM activity ({execution.trace.length})
					</div>
					<div className="min-h-0 flex-1">
						<TraceInspector
							entries={execution.trace}
							selectedPath={selectedPath}
							onSelectPath={setSelectedPath}
						/>
					</div>
				</aside>
			</div>
		</div>
	);
}
