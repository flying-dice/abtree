#!/usr/bin/env bun
/**
 * Regenerate docs/public/example.svg with a focused refactor-loop demo —
 * a Refactor_Loop sequence with three actions (Refactor, Score_SRP,
 * Verify_Resolved), walked through two passes so the retry behaviour is
 * visible. Nothing else.
 *
 * Run with `bun scripts/generate-example-svg.ts`.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderTreeSvg } from "@abtree/runtime";
import type {
	NormalizedCompositeNode,
	WalkthroughScript,
} from "@abtree/runtime";

const tree: NormalizedCompositeNode = {
	type: "sequence",
	name: "Refactor_Loop",
	retries: 3,
	children: [
		{
			type: "action",
			name: "Refactor",
			steps: [
				{ instruct: "Refactor the codebase to resolve the chosen violation." },
			],
		},
		{
			type: "action",
			name: "Score_SRP",
			steps: [
				{ instruct: "Re-score the codebase for SRP violations." },
			],
		},
		{
			type: "action",
			name: "Verify_Resolved",
			steps: [
				{ evaluate: "$LOCAL.has_critical_violations is false" },
			],
		},
	],
};

// Two passes — first one fails at Verify_Resolved (the chosen violation
// is not yet clean), the sequence retries from clean state, second pass
// goes green end-to-end.
const walkthrough: WalkthroughScript = {
	cycleSec: 12,
	events: [
		// Pass 1
		{ path: [], atSec: 0.0, status: "pending" },
		{ path: [0], atSec: 0.6, status: "success" },
		{ path: [1], atSec: 1.8, status: "success" },
		{ path: [2], atSec: 3.0, status: "failure" },

		// Retry — clear the subtree, then re-tick from the top.
		{ path: [], atSec: 4.2, status: "reset" },
		{ path: [], atSec: 4.6, status: "pending" },

		// Pass 2 — clean.
		{ path: [0], atSec: 5.2, status: "success" },
		{ path: [1], atSec: 6.4, status: "success" },
		{ path: [2], atSec: 7.6, status: "success" },

		// Sequence resolves.
		{ path: [], atSec: 8.4, status: "success" },
	],
};

const svg = renderTreeSvg(tree, {
	title: "Refactor loop",
	walkthroughScript: walkthrough,
});

const outPath = resolve(import.meta.dir, "..", "docs/public/example.svg");
writeFileSync(outPath, svg);
console.log(`wrote ${outPath}`);
