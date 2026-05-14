import {
	action,
	ambient,
	evaluate,
	instruct,
	local,
	selector,
	sequence,
} from "@abtree/dsl";

const changeRequest = local("change_request", null);
const intentAnalysis = local("intent_analysis", null);
const draftPath = local("draft_path", null);
const planPath = local("plan_path", null);
const codeownerApproved = local("codeowner_approved", null);
const mrUrl = local("mr_url", null);

export const tree = sequence("Refine_Plan_Workflow", () => {
	action("Understand_Intent", () => {
		evaluate(`${changeRequest} is set`);
		instruct(`
			Analyze ${changeRequest}. Determine: - What is being asked for?
			(feature, fix, refactor, migration, etc.) - What systems/files are
			likely affected? - What are the constraints and requirements? - Who
			are the likely codeowners? (check CODEOWNERS file if present) - What
			acceptance criteria would prove this is done? Keep this analysis
			terse — a few bullets per question, not prose. Store it at
			${intentAnalysis}.
		`);
	});

	action("Write_Draft", () => {
		evaluate(`${intentAnalysis} is set`);
		instruct(`
			Write the draft plan to a per-execution draft file at
			\`plans/drafts/<execution-id>.md\`, where <execution-id> is the id of
			the execution you are driving. Create the plans/drafts/ directory
			if it does not exist. Store the resulting path at ${draftPath}. Do
			NOT return the draft contents in state — only the path. The whole
			point of this step is to keep the document on disk. The file must
			use this structure: --- id: [generate using format:
			{timestamp}-{adjective}-{noun}-{verb}] title: [concise title]
			status: draft author: [from git config user.name] created: [today's
			date] reviewed_by: --- ## Summary [1-3 sentences on what this
			change does and why] ## Requirements [Bulleted list of functional
			requirements] ## Technical Approach [How this will be implemented —
			files, patterns, dependencies] ## Affected Systems [List of
			systems/modules/services touched] ## Acceptance Criteria [Testable
			conditions that prove the change is complete] ## Risks &
			Considerations [Edge cases, backwards compatibility, performance,
			security] ## Open Questions [Anything unresolved that needs
			codeowner input] Leave the reviewed_by field empty during
			drafting — it gets populated in the final Codeowner_Approval stage
			(either by the in-session codeowner, or by the agent when assigning
			the MR).
		`);
	});

	action("Critique_Draft", () => {
		evaluate(`${draftPath} is set`);
		instruct(`
			Read the file at ${draftPath}. Act as a Staff Engineer reviewing
			the plan: - Is the scope clearly bounded? (no creep, no ambiguity)
			- Are requirements specific enough to implement without guessing?
			- Does the technical approach account for existing patterns in the
			codebase? - Are acceptance criteria testable and complete? - Are
			risks realistic (not hypothetical paranoia)? - Are open questions
			genuine blockers or just hedging? Tighten, clarify, and remove
			anything vague. Edit the file at ${draftPath} in place — do not
			create a new file, do not return the contents to state, do not
			introduce a new state key. The same path stays valid for the next
			step.
		`);
	});

	action("Save_Plan", () => {
		evaluate(`${draftPath} is set`);
		instruct(`
			Read the title from the frontmatter of the file at ${draftPath}.
			Move (not copy) the file to plans/[kebab-case-title].md. Store the
			new path at ${planPath}, then write null to ${draftPath} (the draft
			was promoted, not duplicated, so the stale path must not be carried
			forward).
		`);
		instruct(`
			The file at ${planPath} is now the final plan. Update the status to
			"refined" in the frontmatter.
		`);
		evaluate(`${planPath} is set and the plan status is "refined".`);
	});

	selector("Codeowner_Approval", () => {
		action("Approve_In_Session", () => {
			evaluate(`${planPath} is set`);
			evaluate(
				`the agent is able to ask the user a question in this session (interactive human-in-the-loop, not a headless / unattended run)`,
			);
			instruct(`
				Ask the user directly: "Do you approve the plan at ${planPath}?"
				Show them the path so they can read it. You drive the CLI on
				their behalf — do not ask them to run \`abtree\` commands. If
				they approve, set \`reviewed_by\` in the frontmatter of
				${planPath} to their git identity (matching the identifier used
				in CODEOWNERS) and write ${codeownerApproved} = true. Submit
				\`running\` while waiting for their answer. If they reject or
				want changes first, submit failure so the selector falls through
				to the MR path.
			`);
			evaluate(`${codeownerApproved} is true`);
		});

		action("Open_MR_For_Codeowner", () => {
			evaluate(`${planPath} is set`);
			instruct(`
				No codeowner is approving in-session. Identify the appropriate
				codeowner from the CODEOWNERS file based on the systems listed
				in the plan at ${planPath}. Set \`reviewed_by\` in the plan's
				frontmatter to that codeowner's identifier — this records the
				assigned reviewer; the MR merge itself is the authoritative
				approval. Commit ${planPath} on a new branch named
				\`plan/<plan-id>\` (derive plan-id from the frontmatter \`id\`
				field), push, and open an MR/PR using the plan's body as the
				description. Assign the codeowner as the reviewer on the MR.
				Store the MR URL at ${mrUrl}.
			`);
			evaluate(`${mrUrl} is set`);
		});
	});
});

export { ambient };
