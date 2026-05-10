import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assetUrl,
	compareVersions,
	detectTarget,
	downloadAsset,
	fetchLatestTag,
	installBinary,
} from "../src/upgrade.ts";
import { VERSION } from "../src/version.ts";

// ── detectTarget ─────────────────────────────────────────────────────────────

describe("detectTarget", () => {
	const orig = {
		platform: process.platform,
		arch: process.arch,
	};

	afterEach(() => {
		Object.defineProperty(process, "platform", { value: orig.platform });
		Object.defineProperty(process, "arch", { value: orig.arch });
	});

	const cases: Array<[string, string, string]> = [
		["linux", "x64", "abtree-linux-x64"],
		["linux", "arm64", "abtree-linux-arm64"],
		["darwin", "x64", "abtree-darwin-x64"],
		["darwin", "arm64", "abtree-darwin-arm64"],
		["win32", "x64", "abtree-windows-x64.exe"],
	];

	for (const [platform, arch, expectedAsset] of cases) {
		test(`${platform}/${arch} → ${expectedAsset}`, () => {
			Object.defineProperty(process, "platform", { value: platform });
			Object.defineProperty(process, "arch", { value: arch });
			const result = detectTarget();
			expect(result.asset).toBe(expectedAsset);
		});
	}

	test("unsupported OS throws with OS name", () => {
		Object.defineProperty(process, "platform", { value: "freebsd" });
		Object.defineProperty(process, "arch", { value: "x64" });
		expect(() => detectTarget()).toThrow("Unsupported OS: freebsd");
	});

	test("unsupported arch throws with arch name", () => {
		Object.defineProperty(process, "platform", { value: "linux" });
		Object.defineProperty(process, "arch", { value: "ia32" });
		expect(() => detectTarget()).toThrow("Unsupported architecture: ia32");
	});

	test("OS is checked before arch", () => {
		Object.defineProperty(process, "platform", { value: "freebsd" });
		Object.defineProperty(process, "arch", { value: "ia32" });
		expect(() => detectTarget()).toThrow("Unsupported OS: freebsd");
	});
});

// ── compareVersions ───────────────────────────────────────────────────────────

describe("compareVersions", () => {
	test("returns -1 when a < b", () => {
		expect(compareVersions("v1.0.0", "v2.0.0")).toBe(-1);
		expect(compareVersions("v1.2.3", "v1.2.4")).toBe(-1);
		expect(compareVersions("v0.0.0", "v0.0.1")).toBe(-1);
	});

	test("returns 0 when a === b", () => {
		expect(compareVersions("v1.2.3", "v1.2.3")).toBe(0);
		expect(compareVersions("v0.0.0", "v0.0.0")).toBe(0);
	});

	test("returns 1 when a > b", () => {
		expect(compareVersions("v2.0.0", "v1.0.0")).toBe(1);
		expect(compareVersions("v1.2.4", "v1.2.3")).toBe(1);
	});

	test("tolerates leading v", () => {
		expect(compareVersions("1.0.0", "v1.0.0")).toBe(0);
		expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
	});

	test("throws on malformed tag", () => {
		expect(() => compareVersions("not-a-version", "v1.0.0")).toThrow();
	});
});

// ── assetUrl ──────────────────────────────────────────────────────────────────

describe("assetUrl", () => {
	test("latest form", () => {
		expect(assetUrl("latest", "abtree-linux-x64")).toBe(
			"https://github.com/flying-dice/abtree/releases/latest/download/abtree-linux-x64",
		);
	});

	test("explicit tag form", () => {
		expect(assetUrl("v1.2.3", "abtree-linux-x64")).toBe(
			"https://github.com/flying-dice/abtree/releases/download/v1.2.3/abtree-linux-x64",
		);
	});
});

// ── fetchLatestTag ────────────────────────────────────────────────────────────

describe("fetchLatestTag", () => {
	test("returns tag_name from API response", async () => {
		const stubFetch = mock(async (url: string, opts: RequestInit) => {
			expect(opts.headers).toBeDefined();
			const headers = opts.headers as Record<string, string>;
			expect(headers["User-Agent"]).toBe(`abtree/${VERSION}`);
			expect(headers["Accept"]).toBe("application/vnd.github+json");
			return new Response(JSON.stringify({ tag_name: "v1.2.3" }), {
				status: 200,
			});
		});
		const tag = await fetchLatestTag(stubFetch as unknown as typeof fetch);
		expect(tag).toBe("v1.2.3");
	});

	test("throws on non-200 status", async () => {
		const stubFetch = mock(async () => new Response("", { status: 404 }));
		await expect(
			fetchLatestTag(stubFetch as unknown as typeof fetch),
		).rejects.toThrow("404");
	});
});

// ── downloadAsset ─────────────────────────────────────────────────────────────

describe("downloadAsset", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "abtree-test-"));
	});

	const FAKE_URL = "https://example.com/abtree-linux-x64";

	test("writes file when response is large enough", async () => {
		const body = new Uint8Array(1500).fill(0x42);
		const stubFetch = mock(async () => new Response(body, { status: 200 }));
		const dest = join(tmpDir, "abtree-test");
		await downloadAsset(FAKE_URL, dest, stubFetch as unknown as typeof fetch);
		const written = readFileSync(dest);
		expect(written.length).toBe(1500);
	});

	test("throws and leaves no file when body is too small", async () => {
		const body = new Uint8Array(200).fill(0x00);
		const stubFetch = mock(async () => new Response(body, { status: 200 }));
		const dest = join(tmpDir, "abtree-small");
		await expect(
			downloadAsset(FAKE_URL, dest, stubFetch as unknown as typeof fetch),
		).rejects.toThrow("too small");
	});

	test("throws on 404 status", async () => {
		const stubFetch = mock(async () => new Response("Not Found", { status: 404 }));
		const dest = join(tmpDir, "abtree-404");
		await expect(
			downloadAsset(FAKE_URL, dest, stubFetch as unknown as typeof fetch),
		).rejects.toThrow("404");
	});
});

// ── installBinary (POSIX only) ────────────────────────────────────────────────

if (process.platform !== "win32") {
	describe("installBinary (POSIX)", () => {
		test("renames tmp to final with mode 0o755", () => {
			const dir = mkdtempSync(join(tmpdir(), "abtree-install-"));
			const tmpFile = join(dir, "abtree.tmp");
			const finalFile = join(dir, "abtree");
			writeFileSync(tmpFile, "new-binary-content");
			writeFileSync(finalFile, "old-binary-content");
			installBinary(tmpFile, finalFile);
			const content = readFileSync(finalFile, "utf8");
			expect(content).toBe("new-binary-content");
			const { mode } = statSync(finalFile);
			expect(mode & 0o777).toBe(0o755);
		});
	});
}
