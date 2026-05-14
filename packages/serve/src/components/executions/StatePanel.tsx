import type { Execution } from "@/client/api";

interface Props {
	execution: Execution;
}

function StateBlock({
	title,
	data,
}: {
	title: string;
	data: Record<string, unknown>;
}) {
	const entries = Object.entries(data);
	return (
		<div className="rounded-md border bg-card">
			<div className="border-b px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
				{title}
			</div>
			{entries.length === 0 ? (
				<div className="px-3 py-2 text-xs text-muted-foreground">empty</div>
			) : (
				<dl className="divide-y divide-border text-xs">
					{entries.map(([k, v]) => (
						<div key={k} className="flex gap-3 px-3 py-1.5">
							<dt className="min-w-0 shrink-0 font-mono text-muted-foreground">
								{k}
							</dt>
							<dd className="min-w-0 flex-1 truncate font-mono text-foreground/90">
								{v === null
									? "null"
									: typeof v === "string"
										? v
										: JSON.stringify(v)}
							</dd>
						</div>
					))}
				</dl>
			)}
		</div>
	);
}

export function StatePanel({ execution }: Props) {
	return (
		<div className="space-y-3 p-4">
			<StateBlock title="$LOCAL" data={execution.local} />
			<StateBlock title="$GLOBAL" data={execution.global} />
		</div>
	);
}
