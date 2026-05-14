// Deterministic test harness for abtree behaviour-tree executions.
//
// Drives the abtree CLI with a recorded sequence of expected steps
// rather than a live LLM, so the BT primitives (sequence, selector,
// parallel, retries, $ref) can be tested against fixed expectations.
//
// Usage:
//   const result = await runCase(specPath);
//   // assertions inside runCase throw; the bun:test wrapper catches them.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CLI = resolve(REPO_ROOT, "packages/cli/index.ts");

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
	// Fixture directory name. Resolves to either an inline-staged file
	// (`spec.files["<tree>/TREE.yaml"]`) or `tests/trees/<tree>/TREE.yaml`.
	tree: string;
	// Inline files keyed by path relative to the workspace root. Use
	// "<tree>/TREE.yaml" for the main file and "<tree>/fragments/x.yaml"
	// for $ref fragments.
	files?: Record<string, string>;
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

	const tmp = mkdtempSync(join(tmpdir(), "abtree-harness-"));
	try {
		// Inline files: write each at <tmp>/<rel>.
		for (const [rel, contents] of Object.entries(spec.files ?? {})) {
			const dst = join(tmp, rel);
			mkdirSync(dirname(dst), { recursive: true });
			await Bun.write(dst, contents);
		}

		// Resolve the primary tree file. Prefer an inline-staged TREE.yaml
		// under <tmp>/<spec.tree>/TREE.yaml; otherwise copy from the
		// fixture dir at tests/trees/<spec.tree>/.
		const treeName = spec.tree;
		const stagedTreePath = join(tmp, treeName, "TREE.yaml");
		if (!existsSync(stagedTreePath)) {
			const fixtureSrc = join(import.meta.dir, "trees", treeName);
			if (!existsSync(join(fixtureSrc, "TREE.yaml"))) {
				throw new Error(
					`tree '${treeName}' not found in spec.files or tests/trees/`,
				);
			}
			cpSync(fixtureSrc, join(tmp, treeName), { recursive: true });
		}

		// 1. Create execution by absolute path to the tree file.
		const create = abt(tmp, ["execution", "create", stagedTreePath, "harness"]);
		if (create.exit !== 0) {
			throw new Error(
				`execution create failed (exit ${create.exit}): ${create.stderr || fmt(create.stdout)}`,
			);
		}
		const created = create.stdout as { id: string };
		const execution = created.id;

		// 1b. Auto-acknowledge the runtime protocol gate. This is a runtime-level
		// concern, not part of any test fixture — every execution starts with it.
		const ackNext = abt(tmp, ["next", execution]);
		const ackOut = ackNext.stdout as { name?: string };
		if (ackOut?.name !== "Acknowledge_Protocol") {
			throw new Error(`expected Acknowledge_Protocol gate, got ${fmt(ackOut)}`);
		}
		const ackSubmit = abt(tmp, ["submit", execution, "success"]);
		if (ackSubmit.exit !== 0)
			throw new Error(`protocol ack submit failed: ${ackSubmit.stderr}`);

		// 2. Apply initial state.
		for (const [k, v] of Object.entries(spec.initial?.local ?? {})) {
			const w = abt(tmp, ["local", "write", execution, k, JSON.stringify(v)]);
			if (w.exit !== 0)
				throw new Error(`initial local write ${k} failed: ${w.stderr}`);
		}

		// 3. Walk the steps.
		for (let i = 0; i < spec.steps.length; i++) {
			const step = spec.steps[i] as TestStep;
			const next = abt(tmp, ["next", execution]);
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
					const w = abt(tmp, [
						"local",
						"write",
						execution,
						k,
						JSON.stringify(v),
					]);
					if (w.exit !== 0)
						throw new Error(`step ${i}: local write ${k} failed: ${w.stderr}`);
				}
				const r = abt(tmp, ["submit", execution, step.submit ?? "success"]);
				if (r.exit !== 0)
					throw new Error(`step ${i}: submit failed: ${r.stderr}`);
			} else {
				const r = abt(tmp, ["eval", execution, String(step.result)]);
				if (r.exit !== 0)
					throw new Error(`step ${i}: eval failed: ${r.stderr}`);
			}
		}

		// 4. Final next: should match expected terminal status.
		const final = abt(tmp, ["next", execution]);
		const finalOut = final.stdout as { status?: string };
		if (finalOut?.status !== spec.final.status) {
			throw new Error(
				`final: expected status=${spec.final.status}, got ${fmt(finalOut)}`,
			);
		}

		// 5. Assert final $LOCAL state if specified.
		if (spec.final.local) {
			const localOut = abt(tmp, ["local", "read", execution]);
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
			const get = abt(tmp, ["execution", "get", execution]);
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
