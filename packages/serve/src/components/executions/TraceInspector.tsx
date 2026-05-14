import type { TraceEntry } from "@/client/api";
import { cn } from "@/lib/utils";
import { ArrowRight, Brain, CircleCheck, CircleX, Sparkles } from "lucide-react";

interface Props {
	entries: TraceEntry[];
	selectedPath: string | null;
	onSelectPath: (path: string | null) => void;
}

function parseCursor(cursor: string): { path: number[]; step: number } | null {
	if (!cursor || cursor === "null") return null;
	try {
		const parsed = JSON.parse(cursor) as { path: number[]; step: number };
		return parsed;
	} catch {
		return null;
	}
}

function cursorPath(cursor: string): string {
	const c = parseCursor(cursor);
	if (!c) return "root";
	return c.path.length ? c.path.join(".") : "";
}

function kindMeta(kind: TraceEntry["kind"], submitted: string) {
	if (kind === "evaluate") {
		const ok = submitted === "true";
		return {
			label: "EVALUATE",
			icon: ok ? CircleCheck : CircleX,
			accent: ok ? "text-emerald-500" : "text-rose-500",
			bg: ok ? "bg-emerald-500/10" : "bg-rose-500/10",
		};
	}
	if (kind === "protocol") {
		return {
			label: "PROTOCOL",
			icon: Sparkles,
			accent: "text-purple-500",
			bg: "bg-purple-500/10",
		};
	}
	const ok = submitted === "success";
	return {
		label: "INSTRUCT",
		icon: Brain,
		accent: ok ? "text-cyan-500" : "text-amber-500",
		bg: ok ? "bg-cyan-500/10" : "bg-amber-500/10",
	};
}

export function TraceInspector({ entries, selectedPath, onSelectPath }: Props) {
	const filtered =
		selectedPath === null
			? entries
			: entries.filter((e) => cursorPath(e.cursor) === selectedPath);

	if (entries.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
				No agent activity yet for this execution.
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{selectedPath !== null && (
				<div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-xs">
					<span className="text-muted-foreground">
						Filtering on node{" "}
						<span className="font-mono text-foreground">
							{selectedPath || "root"}
						</span>{" "}
						· {filtered.length} of {entries.length}
					</span>
					<button
						type="button"
						onClick={() => onSelectPath(null)}
						className="text-primary hover:underline"
					>
						clear
					</button>
				</div>
			)}
			<ol className="flex-1 space-y-3 overflow-auto p-4">
				{filtered.map((e, idx) => {
					const meta = kindMeta(e.kind, e.submitted);
					const Icon = meta.icon;
					const path = cursorPath(e.cursor);
					return (
						<li key={`${e.ts}-${idx}`}>
							<button
								type="button"
								onClick={() => onSelectPath(path === selectedPath ? null : path)}
								className={cn(
									"w-full rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary/40",
									path === selectedPath && "border-primary/60 ring-1 ring-primary/30",
								)}
							>
								<div className="flex items-center gap-2 text-xs">
									<span
										className={cn(
											"flex size-6 items-center justify-center rounded-full",
											meta.bg,
										)}
									>
										<Icon className={cn("size-3.5", meta.accent)} />
									</span>
									<span className={cn("font-semibold", meta.accent)}>
										{meta.label}
									</span>
									<span className="font-mono text-muted-foreground">
										{e.name}
									</span>
									<span className="ml-auto text-muted-foreground">
										{new Date(e.ts).toLocaleTimeString()}
									</span>
								</div>
								<div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
									<span className="font-mono">
										{e.submitted}
									</span>
									<ArrowRight className="size-3" />
									<span className="font-mono">{e.outcome}</span>
									<span className="ml-auto font-mono">
										{path || "root"}
									</span>
								</div>
								{e.note && (
									<p className="mt-2 whitespace-pre-wrap text-sm leading-snug text-foreground/90">
										{e.note}
									</p>
								)}
							</button>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
