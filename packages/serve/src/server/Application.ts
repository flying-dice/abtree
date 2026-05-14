import { resolve } from "node:path";

export interface ApplicationProps {
	executionsPath: string;
}

/**
 * Composition root. Owns the resolved on-disk path the server reads
 * executions and snapshots from. The runtime's ExecutionStore /
 * TreeSnapshotStore consult process env at import time, so the
 * application bootstraps env before any runtime module is loaded.
 */
export class Application {
	public readonly executionsPath: string;
	public readonly snapshotsPath: string;

	constructor(props: ApplicationProps) {
		this.executionsPath = resolve(props.executionsPath);
		this.snapshotsPath = resolve(this.executionsPath, "..", "snapshots");
	}
}
