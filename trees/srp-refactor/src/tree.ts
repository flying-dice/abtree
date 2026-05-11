import {
	action,
	ambient,
	evaluate,
	instruct,
	local,
	sequence,
} from "@abtree/dsl";

// ─── current score (rewritten on every Score_SRP) ────────────────────────
const violations = local("violations", null);
const topViolation = local("top_violation", null);
const hasCriticalViolations = local("has_critical_violations", null);
const srpReport = local("srp_report", null);

// ─── initial-scan snapshot (set once by Snapshot_Initial_Score) ──────────
const initialViolations = local("initial_violations", null);
const initialTopViolation = local("initial_top_violation", null);
const initialHasCriticalViolations = local(
	"initial_has_critical_violations",
	null,
);
const initialSrpReport = local("initial_srp_report", null);

// ─── human + refactor + review state ─────────────────────────────────────
const chosenViolation = local("chosen_violation", null);
const refactorComplete = local("refactor_complete", null);
const refactorSummary = local("refactor_summary", null);
const reviewReport = local("review_report", null);

// ─── final artifact ──────────────────────────────────────────────────────
const changeReport = local("change_report", null);

// `Score_SRP` appears twice in the tree — once for the initial scan and
// once inside the refactor loop's rescore — so it lives in a helper that
// adds a fresh action node at each call site.
function scoreSrp(): void {
	action("Score_SRP", () => {
		instruct(`
			Score the codebase for Single Responsibility Principle violations.
			For every non-trivial module/file you assess, capture:
			  - path
			  - responsibilities mixed (list of distinct concerns the file owns)
			  - severity (low | medium | high | critical)
			  - one-line rationale (why those concerns shouldn't co-exist here)
			Save the list ranked most-critical-first to ${violations}.
		`);
		instruct(`
			From ${violations}, write the top-ranked entry to ${topViolation}.
			Set ${hasCriticalViolations} to true if any entry has severity
			"high" or "critical", else false.
		`);
		instruct(`
			Compose a markdown SRP report with these sections:

			  # SRP report — <YYYY-MM-DD HH:MM>

			  ## Summary
			  (one paragraph: count of critical/high, the top concern, and
			  whether the previously chosen violation — if ${chosenViolation}
			  is set — is now resolved)

			  ## Ranked violations
			  (table: Path | Mixed responsibilities | Severity | Rationale —
			  rendered from ${violations})

			  ## Top violation
			  (rendered from ${topViolation}, with quoted code snippets where
			  it clarifies the mix of concerns)

			Write the markdown to ./SRP_REPORT.md (overwriting any prior copy).
			Save the path to ${srpReport}.
		`);
		evaluate(
			`${srpReport} is set and ${violations} is set and ${hasCriticalViolations} is set`,
		);
	});
}

export const tree = sequence("Top", () => {
	// 1. Initial scoring — produces SRP_REPORT.md the human reads.
	scoreSrp();

	// 2. Snapshot the initial score so Change_Report can show before-vs-after.
	//    Must run before any Score_SRP re-runs in the loop overwrite state.
	action("Snapshot_Initial_Score", () => {
		evaluate(
			`${violations} is set and ${hasCriticalViolations} is set and ${srpReport} is set`,
		);
		instruct(`
			Capture the initial scoring state so the final Change_Report can
			show before-vs-after. Each loop iteration of Score_SRP overwrites
			${violations} / ${topViolation} / ${hasCriticalViolations} and the
			./SRP_REPORT.md file, so this snapshot is the only record of where
			the codebase started.

			Do all of the following:
			  - copy ${violations}               → ${initialViolations}
			  - copy ${topViolation}             → ${initialTopViolation}
			  - copy ${hasCriticalViolations}    → ${initialHasCriticalViolations}
			  - copy the file at ${srpReport} to ./SRP_REPORT_INITIAL.md
			    (overwriting any prior copy) and save the new path to
			    ${initialSrpReport}.
		`);
		evaluate(
			`${initialViolations} is set and ${initialHasCriticalViolations} is set and ${initialSrpReport} is set`,
		);
	});

	// 3. Human-in-the-loop: pick which violation to tackle.
	action("Await_Choice", () => {
		evaluate(`${srpReport} is set`);
		instruct(`
			Show the human the SRP report at ${srpReport} and ask which
			violation they want to tackle. The human picks by writing their
			answer to ${chosenViolation} via:

			  abtree local write <execution-id> chosen_violation "<file path or label>"

			While waiting, submit \`running\` to ack-and-pause without
			advancing the cursor. Do NOT submit success until
			${chosenViolation} is a non-empty string.
		`);
		evaluate(`${chosenViolation} is a non-empty string`);
	});

	// 4. Bounded refactor loop. retries: 3 → up to 4 passes total.
	//    The Verify_Resolved gate fails (triggering a retry) while
	//    critical violations remain, so [refactor → rescore] re-ticks
	//    from clean state until the codebase is clean or the cap hits.
	sequence("Refactor_Loop", (loop) => {
		loop.retries = 3;

		action("Refactor", () => {
			evaluate(`${chosenViolation} is a non-empty string`);
			instruct(`
				Refactor the codebase to resolve ${chosenViolation}. Split the
				mixed responsibilities into focused units, update callers, and
				preserve observable behaviour.

				If ${refactorSummary} is already set, this is a re-attempt —
				read the previous summary, identify what didn't fully land, and
				improve on it rather than starting over.

				When done, overwrite ${refactorSummary} with a short markdown
				summary of what moved where (bullet list of files/symbols
				changed, one line each). Set ${refactorComplete} to true.
			`);
			evaluate(
				`${refactorComplete} is true and ${refactorSummary} is a non-empty string`,
			);
		});

		scoreSrp();

		action("Verify_Resolved", () => {
			evaluate(`${hasCriticalViolations} is false`);
			instruct(`
				No critical SRP violations remain. Note this in the trace and
				proceed to final review.
			`);
		});
	});

	// 5. Multi-agent code review of the changes made above.
	action("Final_Code_Review", () => {
		evaluate(`${refactorSummary} is a non-empty string`);
		instruct(`
			Run the code-review procedure documented at
			\`fragments/code-review.md\`. Read that file and follow its
			numbered steps verbatim, scoping the review to the changes
			captured in ${refactorSummary} (the diff produced during this
			session).

			The procedure orchestrates haiku/sonnet/opus subagents in parallel
			and ends with a filtered, high-signal issue list. Capture that
			final list (issue description + reason) as ${reviewReport}. If the
			list is empty, write \`[]\` — an empty list is a valid result.
		`);
		evaluate(`${reviewReport} is set`);
	});

	// 6. Before-vs-after change report — last thing the human reads.
	action("Change_Report", () => {
		evaluate(
			`${initialViolations} is set and ${violations} is set and ${refactorSummary} is a non-empty string`,
		);
		instruct(`
			Compose a markdown change report comparing the initial SRP score
			to the post-refactor score. Required sections:

			  # SRP change report — <YYYY-MM-DD HH:MM>

			  ## Headline
			  - Critical violations: <count in initial_violations> → <count in violations>
			  - High violations:     <count in initial_violations> → <count in violations>
			  - Total violations:    <count in initial_violations> → <count in violations>
			  - Chosen target: ${chosenViolation}
			  - Resolved? yes if ${initialTopViolation} no longer appears in
			    ${violations} (compare by path), else no.

			  ## Refactor summary
			  ${refactorSummary} (verbatim, fenced as a code block)

			  ## Score before
			  Table: Path | Severity | Mixed responsibilities — rendered from
			  ${initialViolations}.

			  ## Score after
			  Table: Path | Severity | Mixed responsibilities — rendered from
			  ${violations}. If the list is empty, write "No remaining
			  violations."

			  ## Reports on disk
			  - Initial: ${initialSrpReport}
			  - Final:   ${srpReport}
			  - Review:  inline below

			  ## Final code review
			  ${reviewReport} (verbatim)

			Write the markdown to ./SRP_CHANGE_REPORT.md (overwriting any
			prior copy). Save the path to ${changeReport}.
		`);
		evaluate(`${changeReport} is set`);
	});
});

export { ambient };
