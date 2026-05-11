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

const plan = local("plan", null);
const complexityScore = local("complexity_score", null);
const architectReview = local("architect_review", null);
const cleanCodeGuide = global("clean_code_guide", "load clean-code.md");
const complexityThreshold = global("complexity_threshold", 0.75);

export const tree = sequence("Implementation_Workflow", () => {
	action("Score_Complexity", () => {
		evaluate(`${plan} is set`);
		instruct(`
			Read ${plan}. Assign a complexity score from 0.0 (trivial,
			single-file edit) to 1.0 (cross-cutting architectural change)
			and store it at ${complexityScore}.
		`);
	});

	selector("Architectural_Review", () => {
		action("Escalate_To_Opus", () => {
			evaluate(`${complexityScore} is greater than ${complexityThreshold}`);
			instruct(`
				Complexity is above ${complexityThreshold}. Delegate ${plan} to an
				opus-class architect agent for review. Capture its verdict and any
				required revisions, then store the consolidated feedback at
				${architectReview}.
			`);
		});
		action("Skip_Opus", () => {
			instruct(`
				Complexity is below the escalation threshold. Store "skipped" at
				${architectReview}.
			`);
		});
	});

	sequence("Apply_Plan", () => {
		action("Ensure_Plan_And_Review_Are_Set", () => {
			evaluate(`${plan} is set and ${architectReview} is set`);
		});
		action("Implement", (a) => {
			a.retries = 5;
			instruct(`
				Read ${cleanCodeGuide} and follow it while implementing ${plan},
				incorporating ${architectReview} where it is not "skipped". Apply
				the rules to every file you write, and treat the guide's "Done
				means" and "When to stop and ask" sections as part of this step's
				success criteria.
			`);
			evaluate(`
				Run the project tests and ensure all pass with sufficient coverage.
			`);
			evaluate(`Run the project linters and ensure all pass.`);
		});
	});
});

export { ambient };
