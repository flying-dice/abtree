import { type ExecutionSummary, useGetExecutions } from "@/client/api";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";

interface Props {
	selectedId: string | null;
	onSelect: (id: string) => void;
}

function statusIcon(status: string) {
	switch (status) {
		case "complete":
			return <CheckCircle2 className="size-3.5 text-emerald-500" />;
		case "failed":
			return <AlertCircle className="size-3.5 text-rose-500" />;
		case "running":
			return <Loader2 className="size-3.5 animate-spin text-amber-500" />;
		default:
			return <Clock className="size-3.5 text-muted-foreground" />;
	}
}

export function ExecutionsList({ selectedId, onSelect }: Props) {
	const { data, error, isLoading } = useGetExecutions({
		swr: { refreshInterval: 2000 },
	});

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading executions…
			</div>
		);
	}
	if (error) {
		return (
			<div className="p-4 text-sm text-rose-500">
				Failed to load executions.
			</div>
		);
	}
	const items = (data?.data ?? []) as ExecutionSummary[];
	if (items.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
				No executions found in this directory.
			</div>
		);
	}

	// Newest first for the inspector — runtime returns oldest-first.
	const sorted = [...items].sort((a, b) =>
		b.updatedAt.localeCompare(a.updatedAt),
	);

	return (
		<ul className="divide-y divide-border">
			{sorted.map((e) => (
				<li key={e.id}>
					<button
						type="button"
						onClick={() => onSelect(e.id)}
						className={cn(
							"flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-muted/60",
							selectedId === e.id && "bg-muted",
						)}
					>
						<div className="flex items-center gap-2">
							{statusIcon(e.status)}
							<span className="font-mono text-xs text-muted-foreground">
								{e.tree}
							</span>
						</div>
						<div className="line-clamp-2 text-sm font-medium">
							{e.summary || e.id}
						</div>
						<div className="flex items-center gap-3 text-xs text-muted-foreground">
							<span>{e.traceCount} steps</span>
							<span>·</span>
							<span>{new Date(e.updatedAt).toLocaleString()}</span>
						</div>
					</button>
				</li>
			))}
		</ul>
	);
}
