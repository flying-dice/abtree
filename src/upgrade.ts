import {
	accessSync,
	chmodSync,
	constants,
	realpathSync,
	renameSync,
	unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { VERSION } from "./version.ts";

export type Platform = {
	os: string;
	arch: string;
	asset: string;
	binName: string;
};

export function detectTarget(): Platform {
	const rawOs = process.platform;
	const rawArch = process.arch;

	let os: string;
	if (rawOs === "linux") os = "linux";
	else if (rawOs === "darwin") os = "darwin";
	else if (rawOs === "win32") os = "windows";
	else throw new Error(`Unsupported OS: ${rawOs}`);

	let arch: string;
	if (rawArch === "x64") arch = "x64";
	else if (rawArch === "arm64") arch = "arm64";
	else throw new Error(`Unsupported architecture: ${rawArch}`);

	if (os === "windows" && arch === "arm64") {
		throw new Error(`Unsupported architecture: ${rawArch}`);
	}

	const binName = os === "windows" ? "abtree.exe" : "abtree";
	const asset =
		os === "windows" ? `abtree-windows-x64.exe` : `abtree-${os}-${arch}`;

	return { os, arch, asset, binName };
}

export async function fetchLatestTag(
	fetchFn: typeof fetch = globalThis.fetch,
): Promise<string> {
	const res = await fetchFn(
		"https://api.github.com/repos/flying-dice/abtree/releases/latest",
		{
			headers: {
				"User-Agent": `abtree/${VERSION}`,
				Accept: "application/vnd.github+json",
			},
		},
	);
	if (!res.ok) {
		throw new Error(`GitHub API returned ${res.status}`);
	}
	const data = (await res.json()) as { tag_name: string };
	return data.tag_name;
}

export function compareVersions(a: string, b: string): -1 | 0 | 1 {
	const parse = (v: string): number[] => {
		const s = v.startsWith("v") ? v.slice(1) : v;
		const parts = s.split(".").map(Number);
		if (parts.length !== 3 || parts.some(Number.isNaN)) {
			throw new Error(`Cannot parse version: ${v}`);
		}
		return parts;
	};
	const pa = parse(a);
	const pb = parse(b);
	for (let i = 0; i < 3; i++) {
		if (pa[i] < pb[i]) return -1;
		if (pa[i] > pb[i]) return 1;
	}
	return 0;
}

export function assetUrl(tag: string | "latest", asset: string): string {
	if (tag === "latest") {
		return `https://github.com/flying-dice/abtree/releases/latest/download/${asset}`;
	}
	return `https://github.com/flying-dice/abtree/releases/download/${tag}/${asset}`;
}

export async function downloadAsset(
	url: string,
	destPath: string,
	fetchFn: typeof fetch = globalThis.fetch,
): Promise<void> {
	let res: Response;
	try {
		res = await fetchFn(url, { redirect: "follow" });
	} catch (err) {
		throw new Error(`Network error fetching ${url}: ${err}`);
	}
	if (!res.ok) {
		throw new Error(`Asset download failed: HTTP ${res.status} for ${url}`);
	}
	const contentLength = res.headers.get("content-length");
	if (contentLength !== null) {
		const len = Number(contentLength);
		if (!Number.isNaN(len) && len < 1024) {
			throw new Error(
				`Asset too small (${len} bytes via Content-Length) — likely a CDN error page`,
			);
		}
	}
	const buf = await res.arrayBuffer();
	if (buf.byteLength < 1024) {
		throw new Error(
			`Asset too small (${buf.byteLength} bytes) — likely a CDN error page`,
		);
	}
	await Bun.write(destPath, buf);
}

export function installBinary(tmpPath: string, finalPath: string): void {
	if (process.platform === "win32") {
		const oldPath = `${finalPath}.old`;
		renameSync(finalPath, oldPath);
		renameSync(tmpPath, finalPath);
		try {
			unlinkSync(oldPath);
		} catch {
			// file in use — leave it; next invocation cleans it up
		}
	} else {
		chmodSync(tmpPath, 0o755);
		renameSync(tmpPath, finalPath);
	}
}

export function realpathExec(): string {
	return realpathSync(process.execPath);
}

export function tmpPath(installDir: string): string {
	return join(installDir, `abtree.${process.pid}.tmp`);
}

export function isWritable(dir: string): boolean {
	try {
		accessSync(dir, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}
