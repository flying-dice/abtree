import { afterAll, beforeAll, expect, test } from "bun:test";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const HELLO_WORLD_SLUG = "abtree-hello-world";

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
let treePath: string;

beforeAll(() => {
	tmp = mkdtempSync(join(tmpdir(), "abtree-test-"));
	const src = resolve(import.meta.dir, "../../../trees/hello-world/main.json");
	treePath = join(tmp, "main.json");
	copyFileSync(src, treePath);
});

afterAll(() => {
	rmSync(tmp, { recursive: true, force: true });
});

test("hello-world execution: full execution reaches done", () => {
	// Create execution
	const createOut = abtree(
		["execution", "create", treePath, "integration test"],
		tmp,
	);
	expect(createOut.exitCode).toBe(0);
	const created = json(createOut.stdout) as { id: string };
	const id = created.id;
	expect(id).toMatch(
		new RegExp(`^integration-test__${HELLO_WORLD_SLUG}__\\d+$`),
	);

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
	expect(step.instruction).toContain("Execution protocol");
	submit("success");

	// Step 1: Determine_Time (instruct)
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Determine_Time");
	localWrite("time_of_day", "morning");
	submit("success");

	// Step 2: Spawn_Compose_Greeting — delegate-scope dispatch. The
	// parent submits success here BEFORE actually spawning so the cursor
	// advances and the (would-be) subagent's first `next` returns the
	// first inner action. In this test we simulate that flow by driving
	// the inner actions ourselves.
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Spawn_Compose_Greeting");
	expect(step.instruction).toContain("DLG__Compose_Greeting__");
	submit("success");

	// Step 3: Choose_Greeting selector — Morning_Greeting evaluate
	step = next();
	expect(step.type).toBe("evaluate");
	expect(step.name).toBe("Morning_Greeting");
	expect(step.expression).toContain("morning");
	evalStep(true);

	// Step 4: Morning_Greeting instruct
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Morning_Greeting");
	localWrite("greeting", "Good morning, test-user!");
	submit("success");

	// Step 5: Return_To_Parent_Compose_Greeting — output gate on greeting
	step = next();
	expect(step.type).toBe("evaluate");
	expect(step.name).toBe("Return_To_Parent_Compose_Greeting");
	expect(step.expression).toContain("greeting is set");
	evalStep(true);

	// Step 6: Return_To_Parent_Compose_Greeting — subagent exit instruct
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Return_To_Parent_Compose_Greeting");
	expect(step.instruction).toContain("DLG__Compose_Greeting__");
	submit("success");

	// Step 7: Announce_Greeting — post-scope parent action
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Announce_Greeting");
	submit("success");

	// Final: done
	const final = next();
	expect((final as { status: string }).status).toBe("done");
});

function createExecution(
	treeArg: string,
	summary: string,
): {
	id: string;
	snapshot: string;
} {
	const created = json(
		abtree(["execution", "create", treeArg, summary], tmp).stdout,
	) as { id: string };
	const got = json(abtree(["execution", "get", created.id], tmp).stdout) as {
		snapshot: string;
	};
	return { id: created.id, snapshot: got.snapshot };
}

test("snapshot store: two executions of the same tree share one snapshot file", () => {
	const a = createExecution(treePath, "snap a");
	const b = createExecution(treePath, "snap b");

	expect(a.snapshot).toMatch(/^[0-9a-f]{64}$/);
	expect(a.snapshot).toBe(b.snapshot);

	const snaps = readdirSync(join(tmp, ".abtree", "snapshots"));
	expect(snaps).toContain(`${a.snapshot}.json`);
	expect(snaps.filter((f) => f === `${a.snapshot}.json`)).toHaveLength(1);
});

test("snapshot store: a different tree produces a different etag", () => {
	const altPath = join(tmp, "snap-alt.yaml");
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
	try {
		const base = createExecution(treePath, "etag base");
		const alt = createExecution(altPath, "etag alt");
		expect(alt.snapshot).toMatch(/^[0-9a-f]{64}$/);
		expect(alt.snapshot).not.toBe(base.snapshot);
		const snaps = readdirSync(join(tmp, ".abtree", "snapshots"));
		expect(snaps).toContain(`${alt.snapshot}.json`);
		expect(snaps).toContain(`${base.snapshot}.json`);
	} finally {
		unlinkSync(altPath);
	}
});

test("validation: malformed tree YAML is rejected with a path-prefixed error", () => {
	const badPath = join(tmp, "bad.yaml");
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
	try {
		const r = abtree(["execution", "create", badPath, "should fail"], tmp);
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toContain("tree file failed validation");
		expect(r.stderr).toContain("tree.steps");
	} finally {
		unlinkSync(badPath);
	}
});

test("snapshot store: deleting the snapshot file makes reads fail", () => {
	const created = createExecution(treePath, "missing snap");

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
		["execution", "create", treePath, "reset test"],
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
		abtree(["execution", "create", treePath, "gate fail"], tmp).stdout,
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
		abtree(["execution", "create", treePath, "gate running"], tmp).stdout,
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
		abtree(["execution", "create", treePath, "eval phase"], tmp).stdout,
	) as { id: string };
	abtree(["next", id], tmp); // protocol gate, phase becomes "protocol"
	const r = abtree(["eval", id, "true"], tmp);
	expect(r.exitCode).not.toBe(0);
	expect(r.stderr).toContain("not in evaluating phase");
});

test("submit while not in performing phase exits non-zero", () => {
	const { id } = json(
		abtree(["execution", "create", treePath, "submit phase"], tmp).stdout,
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
		abtree(["execution", "create", treePath, "string fallback"], tmp).stdout,
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
		abtree(["execution", "create", treePath, "global read"], tmp).stdout,
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

// ── trace / --note ────────────────────────────────────────────────────────

type TraceEntry = {
	ts: string;
	kind: "evaluate" | "instruct" | "protocol";
	cursor: string;
	name: string;
	submitted: string;
	outcome: string;
	note?: string;
};

function getTrace(id: string): TraceEntry[] {
	const doc = json(abtree(["execution", "get", id], tmp).stdout) as {
		trace: TraceEntry[];
	};
	return doc.trace;
}

test("fresh execution carries an empty trace", () => {
	const { id } = json(
		abtree(["execution", "create", treePath, "trace empty"], tmp).stdout,
	) as { id: string };
	expect(getTrace(id)).toEqual([]);
});

test("trace records protocol accept + eval + submit with notes, omits note when absent", () => {
	const { id } = json(
		abtree(["execution", "create", treePath, "trace happy"], tmp).stdout,
	) as { id: string };

	// Drive: protocol gate (with note) → Determine_Time instruct (with note)
	// → Spawn_Compose_Greeting instruct (no note) → Morning_Greeting evaluate (with note).
	const gate = json(abtree(["next", id], tmp).stdout) as { name: string };
	expect(gate.name).toBe("Acknowledge_Protocol");
	abtree(["submit", id, "success", "--note", "protocol read in full"], tmp);

	const determine = json(abtree(["next", id], tmp).stdout) as { name: string };
	expect(determine.name).toBe("Determine_Time");
	const determineCursor = (
		json(abtree(["execution", "get", id], tmp).stdout) as { cursor: string }
	).cursor;
	abtree(["local", "write", id, "time_of_day", "morning"], tmp);
	abtree(["submit", id, "success", "-n", "set time_of_day=morning"], tmp);

	const spawn = json(abtree(["next", id], tmp).stdout) as { name: string };
	expect(spawn.name).toBe("Spawn_Compose_Greeting");
	abtree(["submit", id, "success"], tmp); // intentionally noteless

	const evalStep = json(abtree(["next", id], tmp).stdout) as { name: string };
	expect(evalStep.name).toBe("Morning_Greeting");
	const evalCursor = (
		json(abtree(["execution", "get", id], tmp).stdout) as { cursor: string }
	).cursor;
	abtree(["eval", id, "true", "--note", "time_of_day=morning matches"], tmp);

	const trace = getTrace(id);
	expect(trace).toHaveLength(4);

	expect(trace[0]).toMatchObject({
		kind: "protocol",
		name: "Acknowledge_Protocol",
		submitted: "accept",
		outcome: "protocol_accepted",
		note: "protocol read in full",
	});

	// Determine_Time has a single instruct step → action_complete on submit.
	expect(trace[1]).toMatchObject({
		kind: "instruct",
		name: "Determine_Time",
		submitted: "success",
		outcome: "action_complete",
		note: "set time_of_day=morning",
		cursor: determineCursor,
	});

	expect(trace[2]).toMatchObject({
		kind: "instruct",
		name: "Spawn_Compose_Greeting",
		submitted: "success",
		outcome: "action_complete",
	});
	expect(trace[2]?.note).toBeUndefined();

	expect(trace[3]).toMatchObject({
		kind: "evaluate",
		name: "Morning_Greeting",
		submitted: "true",
		outcome: "evaluation_passed",
		note: "time_of_day=morning matches",
		cursor: evalCursor,
	});

	for (const entry of trace) {
		expect(typeof entry.ts).toBe("string");
		expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 prefix
	}
});

test("trace records protocol-rejected entry on submit failure", () => {
	const { id } = json(
		abtree(["execution", "create", treePath, "trace reject"], tmp).stdout,
	) as { id: string };
	abtree(["next", id], tmp);
	abtree(["submit", id, "failure", "-n", "ack doc looked off"], tmp);

	const trace = getTrace(id);
	expect(trace).toHaveLength(1);
	expect(trace[0]).toMatchObject({
		kind: "protocol",
		submitted: "reject",
		outcome: "protocol_rejected",
		note: "ack doc looked off",
	});
});

test("trace records running entries on protocol and performing phases", () => {
	const { id } = json(
		abtree(["execution", "create", treePath, "trace running"], tmp).stdout,
	) as { id: string };
	// Protocol phase running.
	abtree(["next", id], tmp);
	abtree(["submit", id, "running", "-n", "still reading"], tmp);
	// Then accept and reach an instruct.
	abtree(["next", id], tmp);
	abtree(["submit", id, "success"], tmp);
	abtree(["next", id], tmp); // Determine_Time instruct
	abtree(["submit", id, "running", "-n", "waiting on clock"], tmp);

	const trace = getTrace(id);
	const runners = trace.filter((e) => e.outcome === "running");
	expect(runners).toHaveLength(2);
	expect(runners[0]).toMatchObject({
		kind: "protocol",
		submitted: "running",
		note: "still reading",
	});
	expect(runners[1]).toMatchObject({
		kind: "instruct",
		submitted: "running",
		note: "waiting on clock",
	});
});

test("execution reset clears the trace", () => {
	const { id } = json(
		abtree(["execution", "create", treePath, "trace reset"], tmp).stdout,
	) as { id: string };
	abtree(["next", id], tmp);
	abtree(["submit", id, "success", "-n", "ack"], tmp);
	expect(getTrace(id)).toHaveLength(1);

	abtree(["execution", "reset", id], tmp);
	expect(getTrace(id)).toEqual([]);
});

test("whitespace-only --note is dropped, not stored as empty string", () => {
	const { id } = json(
		abtree(["execution", "create", treePath, "trace whitespace"], tmp).stdout,
	) as { id: string };
	abtree(["next", id], tmp);
	abtree(["submit", id, "success", "-n", "   "], tmp);

	const trace = getTrace(id);
	expect(trace).toHaveLength(1);
	expect(trace[0]?.note).toBeUndefined();
});

test("legacy execution doc without trace field loads with trace: []", () => {
	// Hand-write an execution JSON in the pre-trace shape and confirm the
	// runtime back-fills `trace: []` on read.
	const id = "legacy__abtree-hello-world__1";
	const execDir = join(tmp, ".abtree", "executions");
	mkdirSync(execDir, { recursive: true });
	const snapshot = "0".repeat(64);
	writeFileSync(
		join(execDir, `${id}.json`),
		JSON.stringify(
			{
				id,
				tree: "abtree-hello-world",
				summary: "legacy",
				status: "complete",
				snapshot,
				cursor: "null",
				phase: "idle",
				protocol_accepted: true,
				created_at: "2026-01-01T00:00:00.000Z",
				updated_at: "2026-01-01T00:00:00.000Z",
				local: {},
				global: {},
				runtime: { node_status: {}, step_index: {}, retry_count: {} },
			},
			null,
			2,
		),
	);

	const got = json(abtree(["execution", "get", id], tmp).stdout) as {
		id: string;
		trace: unknown;
	};
	expect(got.id).toBe(id);
	expect(got.trace).toEqual([]);
});

test("trace persists to disk in append order", () => {
	const { id } = json(
		abtree(["execution", "create", treePath, "trace disk"], tmp).stdout,
	) as { id: string };
	abtree(["next", id], tmp);
	abtree(["submit", id, "success", "-n", "first"], tmp);
	abtree(["next", id], tmp);
	abtree(["submit", id, "success", "-n", "second"], tmp);

	const raw = readFileSync(
		join(tmp, ".abtree", "executions", `${id}.json`),
		"utf-8",
	);
	const doc = JSON.parse(raw) as { trace: TraceEntry[] };
	expect(doc.trace).toHaveLength(2);
	expect(doc.trace[0]?.note).toBe("first");
	expect(doc.trace[1]?.note).toBe("second");
});
