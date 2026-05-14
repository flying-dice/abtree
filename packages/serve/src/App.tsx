import { useState } from "react";
import { ExecutionsList } from "./components/executions/ExecutionsList";
import { ExecutionView } from "./components/executions/ExecutionView";
import "./index.css";

export function App() {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	return (
		<div className="grid h-screen w-screen grid-cols-[320px_1fr] overflow-hidden bg-background text-foreground">
			<aside className="flex min-h-0 flex-col border-r bg-background/60">
				<header className="border-b px-4 py-3">
					<div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
						abtree
					</div>
					<h2 className="text-base font-semibold">Executions</h2>
				</header>
				<div className="min-h-0 flex-1 overflow-auto">
					<ExecutionsList
						selectedId={selectedId}
						onSelect={setSelectedId}
					/>
				</div>
			</aside>
			<main className="min-h-0">
				{selectedId ? (
					<ExecutionView executionId={selectedId} />
				) : (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						Select an execution to inspect its tree, state, and LLM activity.
					</div>
				)}
			</main>
		</div>
	);
}

export default App;
