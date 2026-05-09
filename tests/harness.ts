// Deterministic test harness for abtree behaviour-tree flows.
//
// Drives the abtree CLI with a recorded sequence of expected steps
// rather than a live LLM, so the BT primitives (sequence, selector,
// parallel, retries, $ref) can be tested against fixed expectations.
//
// Usage:
//   const result = await runCase(specPath);
//   // assertions inside runCase throw; the bun:test wrapper catches them.

import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const CLI = resolve(REPO_ROOT, "index.ts");

export type TestStep =
	| {
			type: "instruct";
			name: string;
			write?: Record<string, unknown>;
			submit?: "success" | "failure" | "running";
			expectError?: string;
	  }
	| {
			type: "evaluate";
			name: string;
			result: boolean;
			expectError?: string;
	  };

export type TestCase = {
	name?: string;
	description?: string;
	tree: string; // top-level tree YAML, relative to .abtree/trees/ in the test workspace
	files?: Record<string, string>; // additional inline files (path → contents)
	bundled?: string[]; // copy these files from the repo's .abtree/trees/ into the workspace
	initial?: {
		local?: Record<string, unknown>;
		global?: Record<string, unknown>;
	};
	steps: TestStep[];
	final: {
		status: "done" | "failure";
		local?: Record<string, unknown>;
		runtime?: { retry_count?: Record<string, number> };
	};
};

type Result = { stdout: unknown; stderr: string; exit: number };

function abt(cwd: string, args: string[]): Result {
	const r = spawnSync("bun", [CLI, ...args], {
		cwd,
		stdio: ["ignore", "pipe", "pipe"],
		encoding: "utf-8",
	});
	const stdout = (r.stdout ?? "").trim();
	let parsed: unknown = null;
	if (stdout) {
		try {
			parsed = JSON.parse(stdout);
		} catch {
			parsed = stdout;
		}
	}
	return { stdout: parsed, stderr: r.stderr ?? "", exit: r.status ?? 0 };
}

function eq(actual: unknown, expected: unknown): boolean {
	return JSON.stringify(actual) === JSON.stringify(expected);
}

function fmt(v: unknown): string {
	return typeof v === "string" ? v : JSON.stringify(v);
}

export async function runCase(specPath: string): Promise<void> {
	const raw = await Bun.file(specPath).text();
	const spec = Bun.YAML.parse(raw) as TestCase;

	// Workspace
	const tmp = mkdtempSync(join(tmpdir(), "abtree-harness-"));
	try {
		const treesDir = join(tmp, ".abtree", "trees");
		mkdirSync(treesDir, { recursive: true });

		// Copy bundled trees from the repo (e.g. ["hello-world.yaml", "fragments/pass.yaml"]).
		for (const rel of spec.bundled ?? []) {
			const src = join(REPO_ROOT, ".abtree", "trees", rel);
			const dst = join(treesDir, rel);
			mkdirSync(dirname(dst), { recursive: true });
			if (!existsSync(src)) {
				throw new Error(`bundled tree not found in repo: ${rel}`);
			}
			copyFileSync(src, dst);
		}

		// Inline files override / supplement bundled ones.
		for (const [rel, contents] of Object.entries(spec.files ?? {})) {
			const dst = join(treesDir, rel);
			mkdirSync(dirname(dst), { recursive: true });
			await Bun.write(dst, contents);
		}

		// Tests dir co-located trees (under tests/trees/) — convenient for
		// fixtures specific to one test case. spec.tree may either name a
		// .yaml file already in the workspace or include its contents inline.
		const treeName = spec.tree;
		const treePath = join(treesDir, `${treeName}.yaml`);
		if (!existsSync(treePath)) {
			// fall back to tests/trees/
			const fixtureSrc = join(import.meta.dir, "trees", `${treeName}.yaml`);
			if (existsSync(fixtureSrc)) {
				cpSync(join(import.meta.dir, "trees"), treesDir, { recursive: true });
			} else {
				throw new Error(
					`tree '${treeName}' not found in workspace or tests/trees/`,
				);
			}
		}

		// 1. Create flow.
		const create = abt(tmp, ["flow", "create", treeName, "harness"]);
		if (create.exit !== 0) {
			throw new Error(
				`flow create failed (exit ${create.exit}): ${create.stderr || fmt(create.stdout)}`,
			);
		}
		const created = create.stdout as { id: string };
		const flow = created.id;

		// 2. Apply initial state.
		for (const [k, v] of Object.entries(spec.initial?.local ?? {})) {
			const w = abt(tmp, ["local", "write", flow, k, JSON.stringify(v)]);
			if (w.exit !== 0)
				throw new Error(`initial local write ${k} failed: ${w.stderr}`);
		}

		// 3. Walk the steps.
		for (let i = 0; i < spec.steps.length; i++) {
			const step = spec.steps[i] as TestStep;
			const next = abt(tmp, ["next", flow]);
			const got = next.stdout as Record<string, string>;

			if (got?.type !== step.type) {
				throw new Error(
					`step ${i}: expected type=${step.type}, got ${fmt(got)}`,
				);
			}
			if (got.name !== step.name) {
				throw new Error(
					`step ${i}: expected name=${step.name}, got name=${got.name}`,
				);
			}

			if (step.type === "instruct") {
				for (const [k, v] of Object.entries(step.write ?? {})) {
					const w = abt(tmp, ["local", "write", flow, k, JSON.stringify(v)]);
					if (w.exit !== 0)
						throw new Error(`step ${i}: local write ${k} failed: ${w.stderr}`);
				}
				const r = abt(tmp, ["submit", flow, step.submit ?? "success"]);
				if (r.exit !== 0)
					throw new Error(`step ${i}: submit failed: ${r.stderr}`);
			} else {
				const r = abt(tmp, ["eval", flow, String(step.result)]);
				if (r.exit !== 0)
					throw new Error(`step ${i}: eval failed: ${r.stderr}`);
			}
		}

		// 4. Final next: should match expected terminal status.
		const final = abt(tmp, ["next", flow]);
		const finalOut = final.stdout as { status?: string };
		if (finalOut?.status !== spec.final.status) {
			throw new Error(
				`final: expected status=${spec.final.status}, got ${fmt(finalOut)}`,
			);
		}

		// 5. Assert final $LOCAL state if specified.
		if (spec.final.local) {
			const localOut = abt(tmp, ["local", "read", flow]);
			const local = localOut.stdout as Record<string, unknown>;
			for (const [k, expected] of Object.entries(spec.final.local)) {
				if (!eq(local[k], expected)) {
					throw new Error(
						`final local.${k}: expected ${fmt(expected)}, got ${fmt(local[k])}`,
					);
				}
			}
		}

		// 6. Assert runtime retry counts if specified.
		if (spec.final.runtime?.retry_count) {
			const get = abt(tmp, ["flow", "get", flow]);
			const doc = get.stdout as {
				runtime: { retry_count: Record<string, number> };
			};
			for (const [path, expected] of Object.entries(
				spec.final.runtime.retry_count,
			)) {
				const actual = doc.runtime.retry_count[path] ?? 0;
				if (actual !== expected) {
					throw new Error(
						`runtime.retry_count[${path}]: expected ${expected}, got ${actual}`,
					);
				}
			}
		}
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}
