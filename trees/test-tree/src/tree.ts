import {
	action,
	ambient,
	evaluate,
	instruct,
	local,
	sequence,
} from "@abtree/dsl";

// Module-scope state: tree-wide containers the runner fills in as it drives
// the target execution. Caller seeds `test_path`; everything else is
// produced by the steps below.
const testPath = local("test_path", null);
const testSpec = local("test_spec", null);
const targetExecutionId = local("target_execution_id", null);
const finalLocal = local("final_local", null);
const finalStatus = local("final_status", null);
const assertions = local("assertions", null);
const overallResult = local("overall_result", null);
const reportPath = local("report_path", null);

export const tree = sequence("Test_Runner", () => {
	action("Load_Spec", () => {
		evaluate(`${testPath} is set`);
		instruct(`
			Read the YAML file at ${testPath}. Parse it and store the parsed
			object at ${testSpec}. The parsed object MUST contain at minimum:
			\`tree\` (slug of the tree under test), \`scenario.name\`,
			\`scenario.given\`, \`scenario.when\`, \`scenario.then\`. If any of
			those are missing or unreadable, submit failure — a malformed spec
			is not a test the runner can drive.
		`);
	});

	action("Drive_Workflow", () => {
		evaluate(`${testSpec} is set`);
		instruct(`
			Create a fresh execution of the tree named in ${testSpec}.tree with
			a summary derived from the scenario name. Store the new execution
			id at ${targetExecutionId}.

			Seed the target execution's $LOCAL from
			${testSpec}.background.initial.local (if present) via
			\`abtree local write <target> <path> <json-value>\` for each entry.

			Acknowledge the protocol gate on the target execution (first
			\`abtree next\` returns Acknowledge_Protocol — submit success).

			Drive the target execution to completion by walking each \`when\`
			step in scenario order. For evaluate steps the agent MUST read
			every $LOCAL/$GLOBAL path the expression references via
			\`abtree local/global read <target>\` before calling
			\`abtree eval <target> true|false\`. For instruct steps the agent
			MUST perform the work named (file I/O, shell, sub-agent — whatever
			the instruction directs) and write any produced values to $LOCAL
			via \`abtree local write <target> …\` before calling
			\`abtree submit <target> success|failure|running\`.

			FIXTURE-DRIVEN SIDE EFFECTS (VCR semantics). The runner does NOT
			invent values for side effects. Instead, the TEST spec cements the
			simulated outcomes in a \`fixtures\` block:

			  fixtures:
			    side_effects:
			      <key>:               # e.g. mr_open, git_push, http_post
			        <field>: <value>   # e.g. url, branch, commit_sha

			When an instruction in the target tree directs a side effect whose
			execution would normally require external authorisation (real git
			push, real MR/PR open, network calls, destructive shared-state
			ops), the runner:

			  1. Looks up the matching key under ${testSpec}.fixtures.side_effects.
			  2. If a fixture exists, writes its prescribed fields to the
			     target's $LOCAL exactly as the instruction directs (e.g.
			     \`mr_open.url\` → \`$LOCAL.mr_url\`), then submits success.
			  3. If NO fixture exists for that side effect, the runner must
			     either (a) perform the side effect for real (only when the
			     operator has explicitly authorised it), or (b) submit failure
			     on that instruct. The runner never fabricates a stand-in.

			This authority extends only to *external* side effects. Values
			that come from a real local tool/read named in the instruction
			($LOCAL/$GLOBAL reads, file frontmatter scans, etc.) must still
			come from the actual source, never from a fixture.

			The driver loop terminates when \`abtree next <target>\` returns
			\`{status: done}\` or \`{status: failure}\`. If the runner hits an
			instruct that has no fixture and the runner is not authorised to
			perform it live, submit failure on the *target* execution and
			continue — the comparison step will then record the failure mode
			against the spec's expected status.
		`);
	});

	action("Capture_Final_State", () => {
		evaluate(`${targetExecutionId} is set`);
		instruct(`
			Read the target execution's full $LOCAL via
			\`abtree local read <${targetExecutionId}>\` and store the returned
			object at ${finalLocal}.

			Read the target execution's terminal status. Call
			\`abtree next <${targetExecutionId}>\` one more time — the runtime
			returns \`{status: done}\` or \`{status: failure}\` on a completed
			execution — and store that status string at ${finalStatus}.
		`);
	});

	action("Compare_Assertions", () => {
		evaluate(`${finalLocal} is set and ${finalStatus} is set`);
		instruct(`
			For each assertion in ${testSpec}.scenario.then, compute a record
			{ name, expected, actual, pass }:

			  - then.status → name "status", expected = scenario.then.status,
			    actual = ${finalStatus}, pass = expected == actual.

			  - then.local.<key> → name "local.<key>", expected = the spec
			    value (treat literal scalars as equality, treat strings
			    starting with "matches " / "starts with " / "non-empty" as
			    their corresponding predicates), actual = ${finalLocal}[key],
			    pass = predicate(actual).

			  - then.files.<key> → name "files.<key>", expected = the spec
			    value, actual = the on-disk reality (file existence,
			    frontmatter scan), pass = predicate(actual). If a
			    files-assertion needs information the runner did not capture,
			    record pass=false with actual="not captured" — do not invent.

			  - then.git.* / then.mr.* / other external-side-effect assertions
			    → if Drive_Workflow served the side effect from a
			    \`fixtures.side_effects\` entry in the spec, record the
			    fixture value as \`actual\` (prefixed "(fixture) ") and set
			    pass=true provided the fixture satisfies the spec's pattern.
			    If the side effect was performed live and observed, record
			    the observed value (prefixed "(live) ") and pass=true/false
			    per the predicate. If the side effect was neither
			    fixture-served nor live-observed, record pass=false with
			    actual="not captured".

			Store the array at ${assertions}. Do not skip assertions — an
			unverifiable, un-fixture-served assertion is a failed assertion,
			not an absent one.
		`);
		instruct(`
			Compute ${overallResult}: "pass" if every record in ${assertions}
			has pass=true, else "fail".
		`);
	});

	action("Write_Report", () => {
		evaluate(`${assertions} is set and ${overallResult} is set`);
		instruct(`
			Compose a markdown test report with exactly these sections:

			  # Test report — <scenario.name>

			  **Tree:** <${testSpec}.tree>
			  **Spec:** <${testPath}>
			  **Target execution:** <${targetExecutionId}>
			  **Overall:** <${overallResult}> (uppercased: PASS / FAIL)

			  ## Final $LOCAL
			  (table: key | value — rendered from ${finalLocal})

			  ## Assertions
			  (table: Name | Expected | Actual | Pass — rendered from ${assertions})

			Write it next to the spec, in the same directory as ${testPath}.
			The filename is \`<scenario-stem>__<YYYYMMDDTHHMMSSZ>.md\`, where
			\`<scenario-stem>\` is the basename of ${testPath} with the
			\`.yaml\` extension stripped (so
			\`trees/hello-world/tests/morning.yaml\` produces
			\`trees/hello-world/tests/morning__<ts>.md\`). Store the
			resulting path at ${reportPath}.
		`);
		evaluate(`${reportPath} is set`);
	});
});

export { ambient };
