import { afterAll, beforeAll, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Run the CLI in an isolated temp dir so tests don't touch .abt/ on disk.
function abt(
	args: string[],
	cwd: string,
): { stdout: string; stderr: string; exitCode: number } {
	const result = Bun.spawnSync(
		["bun", resolve(import.meta.dir, "index.ts"), ...args],
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
	tmp = mkdtempSync(join(tmpdir(), "abt-test-"));
	mkdirSync(join(tmp, ".abt", "trees"), { recursive: true });
	// Copy only hello-world so the tree list is deterministic.
	copyFileSync(
		resolve(import.meta.dir, ".abt", "trees", "hello-world.yaml"),
		join(tmp, ".abt", "trees", "hello-world.yaml"),
	);
});

afterAll(() => {
	rmSync(tmp, { recursive: true, force: true });
});

test("tree list returns hello-world", () => {
	const { stdout, exitCode } = abt(["tree", "list"], tmp);
	expect(exitCode).toBe(0);
	const trees = json(stdout) as string[];
	expect(trees).toContain("hello-world");
});

test("hello-world flow: full execution reaches done", () => {
	// Create flow
	const createOut = abt(
		["flow", "create", "hello-world", "integration test"],
		tmp,
	);
	expect(createOut.exitCode).toBe(0);
	const created = json(createOut.stdout) as { id: string };
	const id = created.id;
	expect(id).toMatch(/^integration-test__hello-world__\d+$/);

	function next() {
		const r = abt(["next", id], tmp);
		expect(r.exitCode).toBe(0);
		return json(r.stdout) as Record<string, string>;
	}
	function evalStep(result: boolean) {
		const r = abt(["eval", id, String(result)], tmp);
		expect(r.exitCode).toBe(0);
		return json(r.stdout);
	}
	function localWrite(path: string, value: string) {
		const r = abt(["local", "write", id, path, value], tmp);
		expect(r.exitCode).toBe(0);
	}
	function submit(status: "success" | "failure") {
		const r = abt(["submit", id, status], tmp);
		expect(r.exitCode).toBe(0);
		return json(r.stdout);
	}

	// Step 1: Determine_Time (instruct)
	let step = next();
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

	// Step 4: Gather_Context parallel — Check_Weather evaluate
	step = next();
	expect(step.type).toBe("evaluate");
	expect(step.name).toBe("Check_Weather");
	evalStep(true);

	// Step 5: Check_Weather instruct
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Check_Weather");
	localWrite("weather", "weather unavailable");
	submit("success");

	// Step 6: Check_News evaluate
	step = next();
	expect(step.type).toBe("evaluate");
	expect(step.name).toBe("Check_News");
	evalStep(true);

	// Step 7: Check_News instruct
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Check_News");
	localWrite("news", "news unavailable");
	submit("success");

	// Step 8: Compose_Response evaluate
	step = next();
	expect(step.type).toBe("evaluate");
	expect(step.name).toBe("Compose_Response");
	evalStep(true);

	// Step 9: Compose_Response instruct
	step = next();
	expect(step.type).toBe("instruct");
	expect(step.name).toBe("Compose_Response");
	localWrite(
		"response",
		"Good morning, test-user! Weather unavailable. No news today.",
	);
	submit("success");

	// Final: done
	const final = next();
	expect((final as { status: string }).status).toBe("done");
});

test("flow reset restores initial state", () => {
	// Create and immediately reset a flow
	const createOut = abt(["flow", "create", "hello-world", "reset test"], tmp);
	const { id } = json(createOut.stdout) as { id: string };

	// Write something
	abt(["local", "write", id, "time_of_day", "evening"], tmp);

	// Reset
	const resetOut = abt(["flow", "reset", id], tmp);
	expect(resetOut.exitCode).toBe(0);
	expect((json(resetOut.stdout) as { status: string }).status).toBe("reset");

	// First next should be Determine_Time again
	const step = abt(["next", id], tmp);
	const parsed = json(step.stdout) as Record<string, string>;
	expect(parsed.type).toBe("instruct");
	expect(parsed.name).toBe("Determine_Time");
});
