import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, SNAPSHOTS_DIR } from "./paths.ts";
import type { ParsedTree } from "./types.ts";

export function computeEtag(parsed: ParsedTree): string {
	return createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
}

function snapshotPath(etag: string): string {
	return join(SNAPSHOTS_DIR, `${etag}.json`);
}

export const TreeSnapshotStore = {
	put(parsed: ParsedTree): string {
		const etag = computeEtag(parsed);
		const path = snapshotPath(etag);
		if (existsSync(path)) return etag;
		ensureDir(SNAPSHOTS_DIR);
		const tmp = `${path}.tmp`;
		writeFileSync(tmp, JSON.stringify(parsed, null, 2));
		renameSync(tmp, path);
		return etag;
	},

	get(etag: string): ParsedTree {
		const path = snapshotPath(etag);
		if (!existsSync(path)) throw new Error(`Missing snapshot: ${etag}`);
		return JSON.parse(readFileSync(path, "utf-8")) as ParsedTree;
	},
};
