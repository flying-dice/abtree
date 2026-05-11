import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { findNodeModulesPkg, makeNodeModulesResolver } from "abtree_runtime";

let tmp: string;

beforeEach(() => {
	tmp = mkdtempSync(join(tmpdir(), "abtree-resolve-test-"));
});

afterEach(() => {
	rmSync(tmp, { recursive: true, force: true });
});

function writeFile(rel: string, contents: string): string {
	const abs = join(tmp, rel);
	mkdirSync(join(abs, ".."), { recursive: true });
	writeFileSync(abs, contents);
	return abs;
}

function stagePackage(relRoot: string, tree: string) {
	writeFile(`${relRoot}/TREE.yaml`, tree);
	writeFile(
		`${relRoot}/package.json`,
		JSON.stringify({ name: relRoot.split("/").pop(), main: "TREE.yaml" }),
	);
}

async function dereference(yamlPath: string) {
	return $RefParser.dereference(yamlPath, {
		resolve: { "node-modules": makeNodeModulesResolver(yamlPath) },
		dereference: { circular: "ignore" },
	});
}

describe("makeNodeModulesResolver", () => {
	test("inlines a top-level $ref from the consumer's node_modules", async () => {
		stagePackage(
			"node_modules/bt-retry",
			"name: bt-retry\nversion: 1.2.0\ntree: { type: action, name: A, steps: [{ instruct: hi }] }\n",
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry#/tree"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ name: string }> };
		};
		expect(raw.tree.children[0]?.name).toBe("A");
	});

	test("sub-path resolves the named file inside the package", async () => {
		writeFile(
			"node_modules/bt-retry/fragments/inner.yaml",
			"type: action\nname: Inner\nsteps: [{ instruct: x }]\n",
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry/fragments/inner.yaml"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ name: string }> };
		};
		expect(raw.tree.children[0]?.name).toBe("Inner");
	});

	test("scoped package resolves with the @scope/name form", async () => {
		stagePackage(
			"node_modules/@acme/bt-retry",
			"name: bt-retry\nversion: 1.2.0\ntree: { type: action, name: ScopedA, steps: [{ instruct: hi }] }\n",
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:@acme/bt-retry#/tree"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ name: string }> };
		};
		expect(raw.tree.children[0]?.name).toBe("ScopedA");
	});

	test("missing package surfaces the install hint", async () => {
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:missing#/tree"\n',
		);

		await expect(dereference(consumer)).rejects.toThrow(
			"module 'node-modules:missing' not found in node_modules/; run 'npm install' / 'pnpm install' / 'bun install'",
		);
	});

	test("present package whose main points at a missing file surfaces the resolved path", async () => {
		writeFile(
			"node_modules/bt-retry/package.json",
			JSON.stringify({ name: "bt-retry", main: "TREE.yaml" }),
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry#/tree"\n',
		);

		await expect(dereference(consumer)).rejects.toThrow(
			/module 'node-modules:bt-retry' resolved to '.*node_modules\/bt-retry\/TREE\.yaml' but the file does not exist/,
		);
	});

	test("package.json without a main field errors helpfully on a bare ref", async () => {
		writeFile(
			"node_modules/bt-retry/package.json",
			JSON.stringify({ name: "bt-retry" }),
		);
		writeFile("node_modules/bt-retry/TREE.yaml", "name: ignored");
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry#/tree"\n',
		);

		await expect(dereference(consumer)).rejects.toThrow(
			/has no 'main' field.*Add a 'main' pointing to the tree YAML.*or use a sub-path ref like 'node-modules:bt-retry\/<file>\.yaml'/,
		);
	});

	test("a sub-path ref bypasses main and loads the named file even without main", async () => {
		writeFile(
			"node_modules/bt-retry/package.json",
			JSON.stringify({ name: "bt-retry" }),
		);
		writeFile(
			"node_modules/bt-retry/fragments/inner.yaml",
			"type: action\nname: SubInner\nsteps: [{ instruct: x }]\n",
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry/fragments/inner.yaml"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ name: string }> };
		};
		expect(raw.tree.children[0]?.name).toBe("SubInner");
	});

	test("main pointing at a non-TREE.yaml entry is honoured", async () => {
		writeFile(
			"node_modules/bt-retry/package.json",
			JSON.stringify({ name: "bt-retry", main: "lib/tree.yaml" }),
		);
		writeFile(
			"node_modules/bt-retry/lib/tree.yaml",
			"name: bt-retry\nversion: 1.2.0\ntree: { type: action, name: MainEntry, steps: [{ instruct: hi }] }\n",
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry#/tree"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ name: string }> };
		};
		expect(raw.tree.children[0]?.name).toBe("MainEntry");
	});

	test("transitive in a nested node_modules resolves through that package's own deps", async () => {
		stagePackage(
			"node_modules/bt-retry/node_modules/other-dep",
			"name: other-dep\nversion: 1.0.0\ntree: { type: action, name: NestedOther, steps: [{ instruct: q }] }\n",
		);
		stagePackage(
			"node_modules/bt-retry",
			'name: bt-retry\nversion: 1.2.0\ntree:\n  type: sequence\n  name: BtRoot\n  children:\n    - $ref: "node-modules:other-dep#/tree"\n',
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry#/tree"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ children: Array<{ name: string }> }> };
		};
		expect(raw.tree.children[0]?.children[0]?.name).toBe("NestedOther");
	});

	test("transitive falls back to a hoisted dep when no nested copy exists", async () => {
		stagePackage(
			"node_modules/other-dep",
			"name: other-dep\nversion: 1.0.0\ntree: { type: action, name: HoistedOther, steps: [{ instruct: q }] }\n",
		);
		stagePackage(
			"node_modules/bt-retry",
			'name: bt-retry\nversion: 1.2.0\ntree:\n  type: sequence\n  name: BtRoot\n  children:\n    - $ref: "node-modules:other-dep#/tree"\n',
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry#/tree"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ children: Array<{ name: string }> }> };
		};
		expect(raw.tree.children[0]?.children[0]?.name).toBe("HoistedOther");
	});

	test("nested copy shadows hoisted copy when both exist (nearest wins)", async () => {
		stagePackage(
			"node_modules/other-dep",
			"name: other-dep\nversion: 1.0.0\ntree: { type: action, name: HoistedOther, steps: [{ instruct: q }] }\n",
		);
		stagePackage(
			"node_modules/bt-retry/node_modules/other-dep",
			"name: other-dep\nversion: 2.0.0\ntree: { type: action, name: NestedOther, steps: [{ instruct: q }] }\n",
		);
		stagePackage(
			"node_modules/bt-retry",
			'name: bt-retry\nversion: 1.2.0\ntree:\n  type: sequence\n  name: BtRoot\n  children:\n    - $ref: "node-modules:other-dep#/tree"\n',
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry#/tree"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ children: Array<{ name: string }> }> };
		};
		expect(raw.tree.children[0]?.children[0]?.name).toBe("NestedOther");
	});

	test("malformed ref fails with a useful message", async () => {
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			[
				"name: consumer",
				"version: 1.0.0",
				"tree:",
				"  type: sequence",
				"  name: S",
				"  children:",
				'    - $ref: "node-modules:-bad-name#/tree"',
				"",
			].join("\n"),
		);

		await expect(dereference(consumer)).rejects.toThrow(
			"package name '-bad-name' violates npm naming rules",
		);
	});

	test("resolves through a pnpm-style symlink in node_modules", async () => {
		// pnpm puts the real contents under .pnpm/<name>@<ver>/node_modules/<name>
		// and symlinks node_modules/<name> to that directory.
		writeFile(
			"node_modules/.pnpm/bt-retry@1.2.0/node_modules/bt-retry/TREE.yaml",
			"name: bt-retry\nversion: 1.2.0\ntree: { type: action, name: PnpmA, steps: [{ instruct: hi }] }\n",
		);
		writeFile(
			"node_modules/.pnpm/bt-retry@1.2.0/node_modules/bt-retry/package.json",
			JSON.stringify({ name: "bt-retry", main: "TREE.yaml" }),
		);
		mkdirSync(join(tmp, "node_modules"), { recursive: true });
		symlinkSync(
			join(tmp, "node_modules/.pnpm/bt-retry@1.2.0/node_modules/bt-retry"),
			join(tmp, "node_modules/bt-retry"),
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			'name: consumer\nversion: 1.0.0\ntree:\n  type: sequence\n  name: S\n  children:\n    - $ref: "node-modules:bt-retry#/tree"\n',
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ name: string }> };
		};
		expect(raw.tree.children[0]?.name).toBe("PnpmA");
	});

	test("does not intercept existing path-based $refs", async () => {
		writeFile(
			".abtree/trees/consumer/fragments/local.yaml",
			"type: action\nname: Local\nsteps: [{ instruct: x }]\n",
		);
		const consumer = writeFile(
			".abtree/trees/consumer/TREE.yaml",
			[
				"name: consumer",
				"version: 1.0.0",
				"tree:",
				"  type: sequence",
				"  name: S",
				"  children:",
				'    - $ref: "./fragments/local.yaml"',
				"",
			].join("\n"),
		);

		const raw = (await dereference(consumer)) as {
			tree: { children: Array<{ name: string }> };
		};
		expect(raw.tree.children[0]?.name).toBe("Local");
	});
});

describe("findNodeModulesPkg", () => {
	test("returns the nearest node_modules/<pkg>/ walking up", () => {
		mkdirSync(join(tmp, "a/b/c/node_modules/found"), { recursive: true });
		mkdirSync(join(tmp, "a/b/c/d"), { recursive: true });
		expect(findNodeModulesPkg(join(tmp, "a/b/c/d"), "found")).toBe(
			join(tmp, "a/b/c/node_modules/found"),
		);
	});

	test("prefers the nearest copy when multiple exist on the path", () => {
		mkdirSync(join(tmp, "a/node_modules/dep"), { recursive: true });
		mkdirSync(join(tmp, "a/b/node_modules/dep"), { recursive: true });
		mkdirSync(join(tmp, "a/b/c"), { recursive: true });
		expect(findNodeModulesPkg(join(tmp, "a/b/c"), "dep")).toBe(
			join(tmp, "a/b/node_modules/dep"),
		);
	});

	test("returns null when no node_modules/<pkg>/ exists on the path", () => {
		mkdirSync(join(tmp, "a/b"), { recursive: true });
		expect(findNodeModulesPkg(join(tmp, "a/b"), "missing")).toBeNull();
	});
});
