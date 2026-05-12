import {
	action,
	ambient,
	evaluate,
	global,
	instruct,
	local,
	parallel,
	selector,
	sequence,
} from "@abtree/dsl";

// Intent + baseline
const changeRequest = local("change_request", null);
const scopeConfirmed = local("scope_confirmed", null);
const baselineTestsPass = local("baseline_tests_pass", null);

// Parallel scoring outputs — one per metric.
const scoreDry = local("score_dry", null);
const scoreSrp = local("score_srp", null);
const scoreCoupling = local("score_coupling", null);
const scoreCohesion = local("score_cohesion", null);

// Pre-refactor synthesis
const baselineScores = local("baseline_scores", null);
const report = local("report", null);
const refactorQueue = local("refactor_queue", null);
const onlineReferences = local("online_references", null);

// Iteration state
const currentItem = local("current_item", null);
const currentScore = local("current_score", null);
const refactorPlan = local("refactor_plan", null);
const doneLog = local("done_log", [] as unknown[]);
const failedLog = local("failed_log", [] as unknown[]);
const stageHalt = local("stage_halt", false);

// Human gates
const triageApproved = local("triage_approved", null);

// Final scoring + verdict
const finalScores = local("final_scores", null);

const testCommand = global(
	"test_command",
	"the command that runs the project's full regression test suite (e.g. 'bun test', 'pnpm test')",
);
const metricThresholds = global("metric_thresholds", {
	dry: 0.7,
	srp: 0.7,
	coupling: 0.7,
	cohesion: 0.7,
});

export const tree = sequence("Improve_Codebase", () => {
	// 1. Explicit human intent — refuses to run without a stated scope.
	action("Check_Intent", () => {
		evaluate(`${changeRequest} is set`);
		instruct(`
			Read ${changeRequest}. State what "improve" means for this run —
			full repo, one module, one metric, etc. Surface the
			interpretation to the human and pause until they confirm by
			calling \`abtree local write <flow-id> scope_confirmed true\`.
			Submit \`running\` while waiting.
		`);
		evaluate(`${scopeConfirmed} is true`);
	});

	// 2. Pre-flight: the test suite must already be green.
	action("Verify_Baseline", () => {
		evaluate(`${testCommand} is set`);
		instruct(`
			Run ${testCommand} end-to-end on the unchanged codebase. If
			anything fails, abort the workflow with submit failure —
			improvement requires a green baseline. Otherwise set
			${baselineTestsPass} to true.
		`);
		evaluate(`${baselineTestsPass} is true`);
	});

	// 3. Score quality metrics — four independent passes, any order.
	parallel("Score_Quality_Metrics", () => {
		action("Score_DRY", () => {
			evaluate(`${scopeConfirmed} is true`);
			instruct(`
				Score the codebase on Don't-Repeat-Yourself. Identify
				duplicated logic, near-duplicate functions, parallel
				inheritance hierarchies, and repeated patterns that should
				be abstracted. Score in [0, 1] (1 = no duplication). Per
				finding: file, severity (low/med/high), risk of
				refactoring, cost/benefit (0..1, higher = cheap and
				impactful). Store at ${scoreDry}.
			`);
		});

		action("Score_SRP", () => {
			evaluate(`${scopeConfirmed} is true`);
			instruct(`
				Score the codebase on Single Responsibility Principle.
				Identify modules / classes / functions with more than one
				reason to change. Score in [0, 1] (1 = one responsibility
				per unit). Per finding: file, severity, risk, cost_benefit.
				Store at ${scoreSrp}.
			`);
		});

		action("Score_Coupling", () => {
			evaluate(`${scopeConfirmed} is true`);
			instruct(`
				Score the codebase on coupling. Identify excessive
				cross-module dependencies, circular imports, leaky
				abstractions. Score in [0, 1] (1 = clean boundaries). Per
				finding: file, severity, risk, cost_benefit. Store at
				${scoreCoupling}.
			`);
		});

		action("Score_Cohesion", () => {
			evaluate(`${scopeConfirmed} is true`);
			instruct(`
				Score the codebase on cohesion. Identify modules whose
				contents don't naturally belong together, utility classes
				that have grown into miscellany dumps. Score in [0, 1] (1 =
				strong cohesion). Per finding: file, severity, risk,
				cost_benefit. Store at ${scoreCohesion}.
			`);
		});
	});

	// 4. Snapshot the starting scores so the final verdict can show delta.
	action("Snapshot_Baseline", () => {
		evaluate(
			`${scoreDry} is set and ${scoreSrp} is set and ${scoreCoupling} is set and ${scoreCohesion} is set`,
		);
		instruct(`
			Capture only the score values into ${baselineScores} = { dry:
			<n>, srp: <n>, coupling: <n>, cohesion: <n> }. This frozen
			snapshot is the before-state used by Cycle_Verdict to show the
			codebase-level delta.
		`);
	});

	// 5. Synthesise the parallel results into a single working list.
	action("Compile_Report", () => {
		evaluate(`${baselineScores} is set`);
		instruct(`
			Synthesise ${scoreDry} / ${scoreSrp} / ${scoreCoupling} /
			${scoreCohesion} into one working list. Each candidate gets: {
			id, metric, threshold (from ${metricThresholds}), summary, file,
			risk, cost_benefit }. Store the report text at ${report} and the
			candidate list at ${refactorQueue}. The threshold field is the
			target the per-item Reassess_Metric will gate against.
		`);
	});

	// 6. Critique-and-harden pass.
	action("Critique_Findings", () => {
		evaluate(`${refactorQueue} is set`);
		instruct(`
			Act as a Senior Principal Engineer reviewing the proposed
			refactor list. For each item: - Is the metric actually wrong
			here, or is the score gaming an irrelevant heuristic? - Does
			fixing this move the needle, or is it cosmetic? - Will the
			change destabilise something downstream? Drop items that don't
			survive scrutiny. Tighten the rest's risk and cost_benefit
			estimates. Overwrite ${refactorQueue} with the hardened list.
		`);
	});

	// 7. One-shot online lookup.
	action("Lookup_Online", () => {
		evaluate(`${refactorQueue} is set`);
		instruct(`
			For each unique metric represented in ${refactorQueue}, look up
			canonical refactoring patterns and best-practice approaches in
			the project's language and framework. Aim for high-signal
			references agents can apply at refactor time, not exhaustive
			literature reviews. Store at ${onlineReferences} keyed by
			metric.
		`);
	});

	// 8. Triage.
	action("Triage_Refactor_Queue", () => {
		evaluate(`${refactorQueue} is set`);
		instruct(`
			Triage ${refactorQueue}. Drop items where cost_benefit < 0.3
			(not worth doing). Sort the rest by cost_benefit descending —
			high-impact, low-risk first. Surface the triaged list to the
			human for approval and overwrite ${refactorQueue} with the
			ordered, filtered version.
		`);
	});

	// 9. Explicit human-approval gate.
	action("Triage_Approval_Gate", () => {
		evaluate(`${refactorQueue} is set`);
		instruct(`
			Wait for the human to approve the triaged queue. They'll call
			\`abtree local write <flow-id> triage_approved true\` once
			they're ready. Submit \`running\` periodically while waiting. If
			they want changes to the triage, call submit failure so the
			bootstrap re-runs.
		`);
		evaluate(`${triageApproved} is true`);
	});

	// 10. Iterative refactor — one item per outer-loop pass.
	sequence("Iterative_Refactor", (n) => {
		n.retries = 50;

		// 10a. Fail fast if the agent has flagged a stage halt.
		action("Halt_Check", () => {
			evaluate(`${stageHalt} is not true`);
			instruct("Stage active — proceed.");
		});

		// 10b. Pick the next item.
		action("Pick_Next_Item", () => {
			evaluate(`${refactorQueue} is not empty`);
			instruct(`
				Pop the head of ${refactorQueue} and store the full item at
				${currentItem}. Reset ${currentScore} and ${refactorPlan} to
				null.
			`);
		});

		// 10c. Refactor + test + reassess. Per-item bounded retries.
		sequence("Refactor_Item", (r) => {
			r.retries = 2;

			selector("Pre_Refactor_Critique", () => {
				action("High_Risk_Critique", () => {
					evaluate(`${currentItem}.risk is "high"`);
					instruct(`
						High-risk item. Map blast radius before touching code: list
						affected files, downstream consumers, and tests that
						exercise the area. Identify the safest order of edits.
						Consult ${onlineReferences}[current_item.metric] for
						established patterns. Store a brief plan at
						${refactorPlan}.
					`);
				});
				action("Skip_Critique", () => {
					instruct(`
						Risk is low or medium — proceed directly to
						implementation. No blast-radius mapping needed.
					`);
				});
			});

			action("Implement_Refactor", () => {
				evaluate(`${currentItem} is set`);
				instruct(`
					Implement the refactor described by ${currentItem}. If
					${refactorPlan} is set, follow it. Consult
					${onlineReferences}[current_item.metric] for canonical
					patterns. Edit code, run any local sanity checks. If you
					cannot make progress on this item, set ${stageHalt} to true
					and submit failure to end the stage cleanly.
				`);
			});

			action("Regression_Test", () => {
				evaluate(
					`full regression test suite passes after the refactor (use ${testCommand})`,
				);
				instruct(`
					Run ${testCommand} end-to-end. Do NOT submit success unless
					every test passes. If you cannot get them green, set
					${stageHalt} to true and submit failure.
				`);
			});

			action("Reassess_Metric", () => {
				instruct(`
					Run a smaller, focused assessment scoped to
					${currentItem}.metric — re-score only that one metric, not
					the full suite. Store the new score at ${currentScore}.
				`);
				evaluate(
					`${currentScore} is set and ${currentScore} is greater than or equal to ${currentItem}.threshold`,
				);
			});
		});

		// 10d. Item passed all three steps within its retry budget.
		action("Record_Item_Done", () => {
			evaluate(`${currentItem} is set`);
			instruct(`
				Append ${currentItem} (with its final ${currentScore}) to
				${doneLog}. Clear ${currentItem}, ${currentScore}, and
				${refactorPlan}.
			`);
		});

		// 10e. Loop control.
		action("Continue_Or_Done", () => {
			evaluate(`${refactorQueue} is empty`);
		});
	});

	// 11. Final reassessment.
	action("Final_Reassessment", () => {
		evaluate(`${refactorQueue} is empty`);
		instruct(`
			Re-run the four metric scorers (DRY, SRP, coupling, cohesion)
			against the now-refactored codebase. Summary scores only — no
			per-finding detail required. Store at ${finalScores} = { dry:
			<n>, srp: <n>, coupling: <n>, cohesion: <n> }.
		`);
	});

	// 12. Verdict selector — pass / partial.
	selector("Cycle_Verdict", () => {
		action("Cycle_Passed", () => {
			evaluate(
				`every metric in ${finalScores} is at or above its ${metricThresholds} value`,
			);
			instruct(`
				Every metric cleared its threshold. Surface a final report to
				the human covering: ${baselineScores} vs ${finalScores}
				(delta per metric), ${doneLog} (what got fixed), ${failedLog}
				(anything that exhausted retries). The cycle is complete.
			`);
		});

		action("Cycle_Partial", () => {
			instruct(`
				Some metrics are still below threshold. Surface a report to
				the human covering: which metrics improved vs which didn't,
				${doneLog}, ${failedLog}, and a recommendation on whether to
				start another improvement cycle or escalate to a human-led
				architectural review.
			`);
		});
	});
});

export { ambient };
