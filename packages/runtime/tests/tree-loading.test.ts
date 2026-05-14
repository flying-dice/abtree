import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTree } from "@abtree/runtime";

let tmp: string;
let originalCwd: string;

beforeEach(() => {
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "abtree-tree-loading-")));
	originalCwd = process.cwd();
	process.chdir(tmp);
});

afterEach(() => {
	process.chdir(originalCwd);
	rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, contents: string): string {
	const abs = join(tmp, rel);
	mkdirSync(join(abs, ".."), { recursive: true });
	writeFileSync(abs, contents);
	return abs;
}

const TRIVIAL_YAML =
	"name: trivial\nversion: 1.0.0\ntree:\n  type: action\n  name: A\n  steps: [{ instruct: hi }]\n";

const TRIVIAL_JSON = JSON.stringify({
	name: "trivial",
	version: "1.0.0",
	tree: { type: "action", name: "A", steps: [{ instruct: "hi" }] },
});

describe("loadTree — accepted shapes", () => {
	test("loads a relative .json path", async () => {
		write("tree.json", TRIVIAL_JSON);
		const loaded = await loadTree("./tree.json");
		expect(loaded?.yamlPath).toBe(join(tmp, "tree.json"));
		expect(loaded?.parsed.root.type).toBe("action");
	});

	test("loads a relative .yaml path", async () => {
		write("tree.yaml", TRIVIAL_YAML);
		const loaded = await loadTree("./tree.yaml");
		expect(loaded?.yamlPath).toBe(join(tmp, "tree.yaml"));
	});

	test("loads a relative .yml path", async () => {
		write("tree.yml", TRIVIAL_YAML);
		const loaded = await loadTree("./tree.yml");
		expect(loaded?.yamlPath).toBe(join(tmp, "tree.yml"));
	});

	test("loads an absolute path", async () => {
		const abs = write("tree.json", TRIVIAL_JSON);
		const loaded = await loadTree(abs);
		expect(loaded?.yamlPath).toBe(abs);
	});

	test("dereferences a relative $ref", async () => {
		write(
			"fragment.json",
			JSON.stringify({
				type: "action",
				name: "Inner",
				steps: [{ instruct: "hi" }],
			}),
		);
		write(
			"main.json",
			JSON.stringify({
				name: "with-ref",
				version: "1.0.0",
				tree: {
					type: "sequence",
					name: "Outer",
					children: [{ $ref: "./fragment.json" }],
				},
			}),
		);
		const loaded = await loadTree("./main.json");
		expect(loaded?.parsed.root.type).toBe("sequence");
		if (loaded?.parsed.root.type === "sequence") {
			const child = loaded.parsed.root.children[0];
			expect(child?.type).toBe("action");
		}
	});
});

describe("loadTree — non-matches return null", () => {
	test("returns null for a path that does not exist", async () => {
		expect(await loadTree("./nope.json")).toBeNull();
	});

	test("returns null for a directory", async () => {
		mkdirSync(join(tmp, "a-dir"), { recursive: true });
		expect(await loadTree("./a-dir")).toBeNull();
	});

	test("returns null for an unrecognised extension", async () => {
		write("notes.txt", "name: x\n");
		expect(await loadTree("./notes.txt")).toBeNull();
	});

	test("returns null for a bare slug (no path semantics)", async () => {
		write("tree.json", TRIVIAL_JSON);
		expect(await loadTree("trivial")).toBeNull();
	});
});

describe("loadTree — slug from tree file's name", () => {
	test("collapses a scoped name into an ID-safe slug", async () => {
		write(
			"tree.json",
			JSON.stringify({
				name: "@acme/bt-retry",
				version: "1.0.0",
				tree: { type: "action", name: "A", steps: [{ instruct: "hi" }] },
			}),
		);
		const loaded = await loadTree("./tree.json");
		expect(loaded?.slug).toBe("acme-bt-retry");
	});

	test("passes through an already-clean unscoped name", async () => {
		write(
			"tree.json",
			JSON.stringify({
				name: "bt-retry",
				version: "1.0.0",
				tree: { type: "action", name: "A", steps: [{ instruct: "hi" }] },
			}),
		);
		const loaded = await loadTree("./tree.json");
		expect(loaded?.slug).toBe("bt-retry");
	});
});
