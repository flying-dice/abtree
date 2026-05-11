import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { loadTree } from "abtree_runtime";

// TREE_SOURCES in src/paths.ts is computed at module import time from
// process.cwd(). These unit tests can't change cwd to redirect that, so they
// focus on the new path-based resolution. Slug-based lookup is covered by the
// spawn-based harness (tests/cases) which invokes the CLI from a fresh cwd.

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

function writeYaml(rel: string, contents: string): string {
	const abs = join(tmp, rel);
	mkdirSync(join(abs, ".."), { recursive: true });
	writeFileSync(abs, contents);
	return abs;
}

const TRIVIAL_TREE =
	"name: t\nversion: 1.0.0\ntree:\n  type: action\n  name: A\n  steps: [{ instruct: hi }]\n";

describe("loadTree — explicit path", () => {
	test("loads a tree from a relative TREE.yaml path", async () => {
		writeYaml("TREE.yaml", TRIVIAL_TREE);

		const loaded = await loadTree("./TREE.yaml");
		expect(loaded).not.toBeNull();
		expect(loaded?.yamlPath).toBe(join(tmp, "TREE.yaml"));
		expect(loaded?.parsed.root.type).toBe("action");
	});

	test("loads a tree from a directory path via package.json:main", async () => {
		writeYaml("my-tree/TREE.yaml", TRIVIAL_TREE);
		writeYaml(
			"my-tree/package.json",
			JSON.stringify({ name: "my-tree", main: "TREE.yaml" }),
		);

		const loaded = await loadTree("./my-tree");
		expect(loaded?.yamlPath).toBe(join(tmp, "my-tree", "TREE.yaml"));
	});

	test("loads a tree from an absolute YAML path", async () => {
		const abs = writeYaml("TREE.yaml", TRIVIAL_TREE);

		const loaded = await loadTree(abs);
		expect(loaded?.yamlPath).toBe(abs);
	});

	test("loads a vendored tree under node_modules/<pkg>/ via package.json:main", async () => {
		writeYaml("node_modules/bt-retry/TREE.yaml", TRIVIAL_TREE);
		writeYaml(
			"node_modules/bt-retry/package.json",
			JSON.stringify({ name: "bt-retry", main: "TREE.yaml" }),
		);

		const loaded = await loadTree("./node_modules/bt-retry");
		expect(loaded?.yamlPath).toBe(join(tmp, "node_modules/bt-retry/TREE.yaml"));
	});

	test("returns null when the path does not exist", async () => {
		expect(await loadTree("./nope.yaml")).toBeNull();
	});

	test("errors when a directory has neither package.json nor a YAML path", async () => {
		mkdirSync(join(tmp, "empty"), { recursive: true });
		await expect(loadTree("./empty")).rejects.toThrow(
			/no package.json found.*Add a package.json with a 'main' field/,
		);
	});
});

describe("loadTree — slug derivation for execution IDs", () => {
	test("uses package.json:name when present", async () => {
		writeYaml("my-tree/TREE.yaml", TRIVIAL_TREE);
		writeYaml(
			"my-tree/package.json",
			JSON.stringify({ name: "fancy-name", main: "TREE.yaml" }),
		);

		const loaded = await loadTree("./my-tree");
		expect(loaded?.slug).toBe("fancy-name");
	});

	test("collapses scoped package names into ID-safe slugs", async () => {
		writeYaml("@acme/bt-retry/TREE.yaml", TRIVIAL_TREE);
		writeYaml(
			"@acme/bt-retry/package.json",
			JSON.stringify({ name: "@acme/bt-retry", main: "TREE.yaml" }),
		);

		const loaded = await loadTree("./@acme/bt-retry");
		expect(loaded?.slug).toBe("acme-bt-retry");
	});

	test("falls back to the directory basename when the YAML is passed directly", async () => {
		// No package.json — the escape hatch is to pass the YAML path
		// directly. The slug then comes from the YAML's containing
		// directory.
		writeYaml("a-tree/TREE.yaml", TRIVIAL_TREE);

		const loaded = await loadTree("./a-tree/TREE.yaml");
		expect(loaded?.slug).toBe("a-tree");
	});

	test("falls back to the basename when package.json is malformed and YAML is passed directly", async () => {
		writeYaml("a-tree/TREE.yaml", TRIVIAL_TREE);
		writeYaml("a-tree/package.json", "{ not json");

		const loaded = await loadTree("./a-tree/TREE.yaml");
		expect(loaded?.slug).toBe("a-tree");
	});

	test("a root-level TREE.yaml uses the cwd basename as the slug", async () => {
		writeYaml("TREE.yaml", TRIVIAL_TREE);

		const loaded = await loadTree("./TREE.yaml");
		expect(loaded?.slug).toBe(basename(tmp).toLowerCase());
	});
});

describe("loadTree — JSON vs YAML entry files", () => {
	test("loads a tree from a .yaml entry", async () => {
		writeYaml("pkg/tree.yaml", TRIVIAL_TREE);
		writeYaml(
			"pkg/package.json",
			JSON.stringify({ name: "p", main: "tree.yaml" }),
		);

		const loaded = await loadTree("./pkg");
		expect(loaded?.parsed.root.type).toBe("action");
	});

	test("loads a tree from a .yml entry", async () => {
		writeYaml("pkg/tree.yml", TRIVIAL_TREE);
		writeYaml(
			"pkg/package.json",
			JSON.stringify({ name: "p", main: "tree.yml" }),
		);

		const loaded = await loadTree("./pkg");
		expect(loaded?.parsed.root.type).toBe("action");
	});

	test("loads a tree from a .json entry", async () => {
		// JSON is a strict subset of YAML, but the runtime should also accept
		// a .json-extensioned entry directly so DSL-built packages don't have
		// to re-serialise to YAML on the way out.
		const treeJson = JSON.stringify({
			name: "p",
			version: "1.0.0",
			tree: {
				type: "action",
				name: "A",
				steps: [{ instruct: "hi" }],
			},
		});
		writeYaml("pkg/main.json", treeJson);
		writeYaml(
			"pkg/package.json",
			JSON.stringify({ name: "p", main: "main.json" }),
		);

		const loaded = await loadTree("./pkg");
		expect(loaded?.parsed.root.type).toBe("action");
		if (loaded?.parsed.root.type === "action") {
			expect(loaded.parsed.root.name).toBe("A");
		}
	});
});

describe("loadTree — package.json:main is the entry point", () => {
	test("a directory with package.json:main loads the file it points at", async () => {
		writeYaml("pkg/lib/tree.yaml", TRIVIAL_TREE);
		writeYaml(
			"pkg/package.json",
			JSON.stringify({ name: "p", main: "lib/tree.yaml" }),
		);

		const loaded = await loadTree("./pkg");
		expect(loaded?.yamlPath).toBe(join(tmp, "pkg/lib/tree.yaml"));
	});

	test("a directory with package.json but no main field errors helpfully", async () => {
		writeYaml("pkg/TREE.yaml", TRIVIAL_TREE);
		writeYaml("pkg/package.json", JSON.stringify({ name: "p" }));

		await expect(loadTree("./pkg")).rejects.toThrow(
			/has no 'main' field.*Add a 'main' pointing to the tree YAML.*or pass the YAML path directly/,
		);
	});

	test("a directory without package.json errors helpfully", async () => {
		writeYaml("pkg/TREE.yaml", TRIVIAL_TREE);

		await expect(loadTree("./pkg")).rejects.toThrow(
			/no package.json found.*Add a package.json with a 'main' field.*or pass the YAML path directly/,
		);
	});

	test("the missing-main error escape hatch — pass the YAML path directly", async () => {
		writeYaml("pkg/TREE.yaml", TRIVIAL_TREE);
		writeYaml("pkg/package.json", JSON.stringify({ name: "p" }));

		const loaded = await loadTree("./pkg/TREE.yaml");
		expect(loaded?.yamlPath).toBe(join(tmp, "pkg/TREE.yaml"));
	});
});
