import {
	action,
	ambient,
	evaluate,
	global,
	instruct,
	local,
	selector,
	sequence,
} from "abtree_dsl";

const goal = local("goal", null);
const styleguide = local("styleguide", null);
const styleguideApproved = local("styleguide_approved", null);
const intent = local("intent", null);
const docsSurvey = local("docs_survey", null);
const placement = local("placement", null);
const draft = local("draft", null);
const reviewNotes = local("review_notes", null);
const finalPath = local("final_path", null);
const repoRoot = global("repo_root", "the cwd of the project being documented");

export const tree = sequence("Technical_Writer_Workflow", () => {
	// 1. Styleguide must exist before writing. If it doesn't, draft one and
	//    gate on human approval before continuing.
	selector("Resolve_Styleguide", () => {
		action("Load_Styleguide", () => {
			evaluate(`${goal} is set and STYLEGUIDE.md exists at ${repoRoot}`);
			instruct(`
				Read STYLEGUIDE.md from ${repoRoot} and store its contents at
				${styleguide}.
			`);
		});

		sequence("Bootstrap_Styleguide", () => {
			action("Draft_Styleguide", () => {
				evaluate(`${goal} is set`);
				instruct(`
					No STYLEGUIDE.md exists at ${repoRoot}. Draft a minimal one
					covering: voice (first vs second person), tone, sentence case,
					code-fence conventions, link style, file and heading naming, and
					any project-specific rules you can infer from existing docs.
					Store the draft at ${styleguide}. Do NOT write to disk yet.
				`);
			});

			action("Human_Approval_Gate", () => {
				evaluate(`${styleguide} is set`);
				instruct(`
					Present the draft styleguide at ${styleguide} to the human.
					Wait for them to confirm by calling
					\`abtree local write <flow-id> styleguide_approved true\`. While
					waiting, you may submit \`running\`. Do NOT submit success until
					they confirm. If they reject, submit failure. The workflow will
					terminate — the human will then author STYLEGUIDE.md themselves
					and re-run; the next run takes the Load_Styleguide branch and
					skips the bootstrap entirely.
				`);
				evaluate(`${styleguideApproved} is true`);
				instruct(`Write ${styleguide} to STYLEGUIDE.md at ${repoRoot}.`);
			});
		});
	});

	// 2. Decide what we're actually writing.
	action("Assess_Intent", () => {
		evaluate(`${styleguide} is set`);
		instruct(`
			Analyse ${goal}. Determine: - Type: tutorial, reference, conceptual
			explainer, how-to. - Scope: one section, one page, multiple pages.
			- Audience: new user, integrator, contributor, internal. Store the
			analysis at ${intent}.
		`);
	});

	// 3. Find or build the home for this content.
	selector("Survey_Existing_Docs", () => {
		action("Map_Placement", () => {
			evaluate(
				`${intent} is set and a home for this content already exists in the docs tree`,
			);
			instruct(`
				Walk the docs tree. Find the right path or parent section for
				${intent}. List the adjacent pages and identify where in the
				sidebar / nav this should slot. Store the placement plan at
				${docsSurvey} and the chosen target file path at ${placement}.
			`);
		});

		action("Resolve_Structure", () => {
			evaluate(`${intent} is set`);
			instruct(`
				No home exists for ${intent}. Decide on a structural change — a
				new section, a new page, a new sidebar entry, or a refactor of
				an existing section. Implement the structural change first
				(create the directory, update the sidebar config, etc.) and
				only then proceed. Store the placement plan at ${docsSurvey}
				and the chosen target file path at ${placement}.
			`);
		});
	});

	// 4. Write/review with bounded retries. The Write_And_Review sequence
	//    runs once normally, and the runtime retries the whole subtree up to
	//    twice (3 attempts total) when the review gate fails. Between
	//    attempts, ${reviewNotes} carries the failure context to the next
	//    attempt's writer.
	sequence("Write_And_Review", (n) => {
		n.retries = 2;
		action("Write_Documentation", () => {
			evaluate(
				`${intent} is set and ${docsSurvey} is set and ${placement} is set`,
			);
			instruct(`
				Write or revise the documentation at ${placement}. If
				${reviewNotes} is set and not "approved", treat it as the prior
				reviewer's specific feedback and address every point. Otherwise
				this is a fresh write. Adhere to ${styleguide}. Match the voice
				and structure described in ${docsSurvey}. Address ${intent}
				precisely — type, scope, audience. Save the file. Store the
				written text at ${draft}.
			`);
		});

		action("Review_Gate", () => {
			evaluate(`${draft} is set`);
			instruct(`
				Run three checks against ${draft}: (1) Structure — does it fit
				the placement and adjacency described in ${docsSurvey}? (2)
				Flow — does the narrative read end-to-end without gaps or
				duplication? (3) Atomicity — does it address ONE concept, not
				multiple bundled together? If all three pass, set ${reviewNotes}
				to "approved". If any fails, write specific notes to
				${reviewNotes} naming the failed check and the concrete issue.
			`);
			evaluate(`${reviewNotes} is "approved"`);
			instruct(`
				All three checks passed. Confirm the file at ${placement} and
				store its path at ${finalPath}.
			`);
		});
	});
});

export { ambient };
