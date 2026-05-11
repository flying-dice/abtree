import { afterAll, beforeAll, expect, test } from "bun:test";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Run the CLI in an isolated temp dir so tests don't touch .abtree/ on disk.
function abtree(
	args: string[],
	cwd: string,
): { stdout: string; stderr: string; exitCode: number } {
	const result = Bun.spawnSync(
		["bun", resolve(import.meta.dir, "../index.ts"), ...args],
		{ cwd, stdout: "pipe", stderr: "pipe" },
	);
	return {
		stdout: new TextDecoder().decode(result.stdout).trim(),
		stderr: new TextDecoder().decode(result.stderr).trim(),
		exitCode: result.exitCode ?? 0,
	};
}

function json(raw: string): unknown {
	return JSON.parse(raw);
}

let tmp: string;

beforeAll(() => {
	tmp = mkdtempSync(join(tmpdir(), "abtree-test-"));
	mkdirSync(join(tmp, ".abtree", "trees", "hello-world"), { recursive: true });
	// Copy hello-world's built main.json + package.json so slug-based lookup
	// works. The runtime requires package.json:main to resolve a slug to a
	// tree file — there is no implicit TREE.yaml default.
	const pkgDir = resolve(import.meta.dir, "../../hello-world");
	for (const f of ["main.json", "package.json"]) {
		copyFileSync(
			resolve(pkgDir, f),
			join(tmp, ".abtree", "trees", "hello-world", f),
		);
	}
});

afterAll(() => {
	rmSync(tmp, { recursive: true, force: true });
});

test("hello-world execution: full execution reaches done", () => {
	// Create execution
	const createOut = abtree(
		["execution", "create", "hello-world", "integration test"],
		tmp,
	);
	expect(createOut.exitCode).toBe(0);
	const created = json(createOut.stdout) as { id: string };
	const id = created.id;
	expect(id).toMatch(/^integration-test__hello-world__\d+$/);

	function next() {
		const r = abtree(["next", id], tmp);
		expect(r.exitCode).toBe(0);
		return json(r.stdout) as Record<string, string>;
	}
	function evalStep(result: boolean) {
		const r = abtree(["eval", id, String(result)], tmp);
		expect(r.exitCode).toBe(0);
		return json(r.stdout);
	}
	function localWrite(path: string, value: string) {
		const r = abtree(["local", "write", id, path, value], tmp);
		expect(r.exitCode).toBe(0);
	}
	function submit(status: "success" | "failure") {
		const r = abtree(["submit", id, status], tmp);
		expect(r.exitCode).toBe(0);
		return json(r.stdout);
	}

	// Step 0: Acknowledge_Protocol (runtime-level gate, applies to every execution)
	let step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Acknowledge_Protocol");
	expect(step.instruction).toContain("Execution Protocol");
	submit("success");

	// Step 1: Determine_Time (instruct)
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Determine_Time");
	localWrite("time_of_day", "morning");
	submit("success");

	// Step 2: Choose_Greeting selector — Morning_Greeting evaluate (time_of_day is "morning" → true)
	step = next();
	expect(step.type).toBe("evaluate");
	expect(step.name).toBe("Morning_Greeting");
	expect(step.expression).toContain("morning");
	evalStep(true);

	// Step 3: Morning_Greeting instruct
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Morning_Greeting");
	localWrite("greeting", "Good morning, test-user!");
	submit("success");

	// Final: done
	const final = next();
	expect((final as { status: string }).status).toBe("done");
});

function createExecution(
	treeSlug: string,
	summary: string,
): {
	id: string;
	snapshot: string;
} {
	const created = json(
		abtree(["execution", "create", treeSlug, summary], tmp).stdout,
	) as { id: string };
	const got = json(abtree(["execution", "get", created.id], tmp).stdout) as {
		snapshot: string;
	};
	return { id: created.id, snapshot: got.snapshot };
}

test("snapshot store: two executions of the same tree share one snapshot file", () => {
	const a = createExecution("hello-world", "snap a");
	const b = createExecution("hello-world", "snap b");

	expect(a.snapshot).toMatch(/^[0-9a-f]{64}$/);
	expect(a.snapshot).toBe(b.snapshot);

	const snaps = readdirSync(join(tmp, ".abtree", "snapshots"));
	expect(snaps).toContain(`${a.snapshot}.json`);
	expect(snaps.filter((f) => f === `${a.snapshot}.json`)).toHaveLength(1);
});

test("snapshot store: a different tree produces a different etag", () => {
	const altDir = join(tmp, ".abtree", "trees", "snap-alt");
	const altPath = join(altDir, "TREE.yaml");
	mkdirSync(altDir, { recursive: true });
	writeFileSync(
		altPath,
		`name: snap-alt
version: 1.0.0
description: alternate tree for snapshot etag test
tree:
  type: action
  name: Solo_Action
  steps:
    - instruct: do nothing
`,
	);
	writeFileSync(
		join(altDir, "package.json"),
		JSON.stringify({ name: "snap-alt", main: "TREE.yaml" }),
	);
	try {
		const base = createExecution("hello-world", "etag base");
		const alt = createExecution("snap-alt", "etag alt");
		expect(alt.snapshot).toMatch(/^[0-9a-f]{64}$/);
		expect(alt.snapshot).not.toBe(base.snapshot);
		const snaps = readdirSync(join(tmp, ".abtree", "snapshots"));
		expect(snaps).toContain(`${alt.snapshot}.json`);
		expect(snaps).toContain(`${base.snapshot}.json`);
	} finally {
		rmSync(altDir, { recursive: true, force: true });
	}
});

test("validation: malformed tree YAML is rejected with a path-prefixed error", () => {
	const badDir = join(tmp, ".abtree", "trees", "bad");
	const badPath = join(badDir, "TREE.yaml");
	mkdirSync(badDir, { recursive: true });
	writeFileSync(
		badPath,
		`name: bad
version: 1.0.0
tree:
  type: action
  name: BadAction
  steps: []
`,
	);
	writeFileSync(
		join(badDir, "package.json"),
		JSON.stringify({ name: "bad", main: "TREE.yaml" }),
	);
	try {
		const r = abtree(["execution", "create", "bad", "should fail"], tmp);
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toContain("tree file failed validation");
		expect(r.stderr).toContain("tree.steps");
	} finally {
		rmSync(badDir, { recursive: true, force: true });
	}
});

test("snapshot store: deleting the snapshot file makes reads fail", () => {
	const created = createExecution("hello-world", "missing snap");

	// Clear the protocol gate first — it does not touch the snapshot, so we
	// must get past it before the missing-snapshot path can fail.
	abtree(["next", created.id], tmp);
	abtree(["submit", created.id, "success"], tmp);

	unlinkSync(join(tmp, ".abtree", "snapshots", `${created.snapshot}.json`));

	const r = abtree(["next", created.id], tmp);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain(`Missing snapshot: ${created.snapshot}`);
});

test("execution reset restores initial state", () => {
	// Create and immediately reset an execution
	const createOut = abtree(
		["execution", "create", "hello-world", "reset test"],
		tmp,
	);
	const { id } = json(createOut.stdout) as { id: string };

	// Ack the protocol gate so we can confirm reset clears it back to false.
	abtree(["next", id], tmp);
	abtree(["submit", id, "success"], tmp);

	// Write something
	abtree(["local", "write", id, "time_of_day", "evening"], tmp);

	// Reset
	const resetOut = abtree(["execution", "reset", id], tmp);
	expect(resetOut.exitCode).toBe(0);
	expect((json(resetOut.stdout) as { status: string }).status).toBe("reset");

	// First next after reset should re-prompt the protocol gate.
	const gate = json(abtree(["next", id], tmp).stdout) as Record<string, string>;
	expect(gate.type).toBe("instruct");
	expect(gate.name).toBe("Acknowledge_Protocol");
	abtree(["submit", id, "success"], tmp);

	// Then the tree resumes from Determine_Time.
	const step = abtree(["next", id], tmp);
	const parsed = json(step.stdout) as Record<string, string>;
	expect(parsed.type).toBe("instruct");
	expect(parsed.name).toBe("Determine_Time");
});

test("protocol gate: submit failure aborts the execution", () => {
	const { id } = json(
		abtree(["execution", "create", "hello-world", "gate fail"], tmp).stdout,
	) as { id: string };

	// Receive the protocol gate, then reject it.
	abtree(["next", id], tmp);
	const reject = json(abtree(["submit", id, "failure"], tmp).stdout) as {
		status: string;
	};
	expect(reject.status).toBe("protocol_rejected");

	// Subsequent next must NOT re-prompt the gate; the execution is failed.
	const after = json(abtree(["next", id], tmp).stdout) as {
		status: string;
		name?: string;
	};
	expect(after.name).toBeUndefined();
	expect(after.status === "failure" || after.status === "done").toBeTrue();
});

test("protocol gate: submit running re-emits the same instruct on next call", () => {
	const { id } = json(
		abtree(["execution", "create", "hello-world", "gate running"], tmp).stdout,
	) as { id: string };

	const first = json(abtree(["next", id], tmp).stdout) as { name: string };
	expect(first.name).toBe("Acknowledge_Protocol");

	const ack = json(abtree(["submit", id, "running"], tmp).stdout) as {
		status: string;
	};
	expect(ack.status).toBe("running");

	const second = json(abtree(["next", id], tmp).stdout) as { name: string };
	expect(second.name).toBe("Acknowledge_Protocol");
});

test("next on non-existent execution exits non-zero with not-found", () => {
	const r = abtree(["next", "nope__hello-world__999"], tmp);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain("not found");
});

test("eval on non-existent execution exits non-zero with not-found", () => {
	const r = abtree(["eval", "nope__hello-world__999", "true"], tmp);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain("not found");
});

test("submit on non-existent execution exits non-zero with not-found", () => {
	const r = abtree(["submit", "nope__hello-world__999", "success"], tmp);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain("not found");
});

test("execution create with unknown tree slug exits non-zero", () => {
	const r = abtree(["execution", "create", "no-such-tree", "x"], tmp);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain("not found");
});

test("eval while not in evaluating phase exits non-zero", () => {
	const { id } = json(
		abtree(["execution", "create", "hello-world", "eval phase"], tmp).stdout,
	) as { id: string };
	abtree(["next", id], tmp); // protocol gate, phase becomes "protocol"
	const r = abtree(["eval", id, "true"], tmp);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain("not in evaluating phase");
});

test("submit while not in performing phase exits non-zero", () => {
	const { id } = json(
		abtree(["execution", "create", "hello-world", "submit phase"], tmp).stdout,
	) as { id: string };
	// Clear the protocol gate so phase returns to idle.
	abtree(["next", id], tmp);
	abtree(["submit", id, "success"], tmp);
	// Idle phase, no instruct outstanding -> submit should refuse.
	const r = abtree(["submit", id, "success"], tmp);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain("not in performing phase");
});

test("local write falls back to literal string for non-JSON values", () => {
	const { id } = json(
		abtree(["execution", "create", "hello-world", "string fallback"], tmp)
			.stdout,
	) as { id: string };
	// Clear protocol gate so the write isn't blocked elsewhere.
	abtree(["next", id], tmp);
	abtree(["submit", id, "success"], tmp);

	const w = abtree(
		["local", "write", id, "note", "not-json-just-a-string"],
		tmp,
	);
	expect(w.exitCode).toBe(0);
	const r = json(abtree(["local", "read", id, "note"], tmp).stdout) as {
		path: string;
		value: unknown;
	};
	expect(r.value).toBe("not-json-just-a-string");
});

test("global read returns full scope and dot-pathed leaves", () => {
	const { id } = json(
		abtree(["execution", "create", "hello-world", "global read"], tmp).stdout,
	) as { id: string };

	// Whole-scope read returns the seeded $GLOBAL object.
	const full = json(abtree(["global", "read", id], tmp).stdout) as Record<
		string,
		unknown
	>;
	expect(typeof full).toBe("object");
	expect(Object.keys(full).length).toBeGreaterThan(0);

	// Dot-pathed read returns the leaf value, not the whole scope.
	const firstKey = Object.keys(full)[0] as string;
	const leaf = json(abtree(["global", "read", id, firstKey], tmp).stdout) as {
		path: string;
		value: unknown;
	};
	expect(leaf.path).toBe(firstKey);
	expect(leaf.value).toEqual(full[firstKey]);
});
