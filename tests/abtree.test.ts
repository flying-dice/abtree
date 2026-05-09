// One bun:test per YAML case file in tests/cases/. Each case is a
// recorded, deterministic walk through a flow — no LLM in the loop.
import { test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { runCase } from "./harness.ts";

const casesDir = join(import.meta.dir, "cases");

for (const file of readdirSync(casesDir).sort()) {
	if (!file.endsWith(".yaml")) continue;
	test(file.replace(".yaml", ""), async () => {
		await runCase(join(casesDir, file));
	});
}
