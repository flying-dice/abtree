import {
	action,
	ambient,
	evaluate,
	global,
	instruct,
	local,
	parallel,
	sequence,
} from "abtree_dsl";

const sessionRef = local("session_ref", null);
const treeSlug = local("tree_slug", null);
const sessionEvidence = local("session_evidence", null);
const effectivenessScore = local("effectiveness_score", null);
const improvements = local("improvements", null);
const planPath = local("plan_path", null);
const commitSha = local("commit_sha", null);
const authoringGuide = global(
	"authoring_guide",
	"run `abtree docs author` for the YAML authoring guide and the rules a tree should satisfy",
);

export const tree = sequence("Improve_Tree_Workflow", () => {
	action("Identify_Target", () => {
		instruct(`
			If ${sessionRef} is set, use it. Otherwise pick the most recent
			non-current execution from \`abtree execution list\` and write its id to
			${sessionRef}. Read \`.abtree/executions/<id>.json\` to derive the tree
			slug — store at ${treeSlug}. Extract evidence from the execution: how
			far it got, which nodes failed, retry counts, $LOCAL keys that ended
			up null vs populated, any stage_halt or failure statuses. Also read
			the tree YAML at \`.abtree/trees/<tree_slug>/TREE.yaml\`. Store the
			evidence (a structured object summarising the run) at
			${sessionEvidence}.
		`);
		evaluate(`${treeSlug} is set and ${sessionEvidence} is set`);
	});

	parallel("Score_And_Find", () => {
		action("Score_Effectiveness", () => {
			evaluate(`${sessionEvidence} is set`);
			instruct(`
				Score how effectively the tree drove the session. Consider: did the
				tree reach \`done\`, were any retries exhausted, were instructions
				clear enough that the agent never had to ad-lib, did evaluate gates
				fire on the values they should, were any $LOCAL keys
				set-but-unused or used-but-unset, did parallel composites order
				their children sensibly. Score in [0, 1] (1 = the tree drove the
				session cleanly with no friction). Per observation include:
				node_path, severity (low/med/high), evidence (one line pointing at
				what in ${sessionEvidence} justifies it). Store at
				${effectivenessScore} = { score, observations }.
			`);
		});

		action("Find_Improvements", () => {
			evaluate(`${sessionEvidence} is set`);
			instruct(`
				Read ${authoringGuide} for the tree authoring conventions. Propose
				concrete improvements to the tree at
				\`.abtree/trees/${treeSlug}/TREE.yaml\`. Each improvement is an
				object: { kind: rename|reword|split|merge|add-evaluate|add-retries|other,
				target: node_name or yaml path, change: short description of the
				edit, rationale: what ${sessionEvidence} motivates it }. Don't
				propose work the codebase already does well. Store the list at
				${improvements}.
			`);
		});
	});

	action("Draft_Plan", () => {
		evaluate(`${effectivenessScore} is set and ${improvements} is set`);
		instruct(`
			Write a draft plan to plans/<YYYY-MM-DD>-improve-${treeSlug}.md.
			Frontmatter: id, title, status: draft, author (from git config
			user.name), created (today), reviewed_by (empty). Body sections:
			## Summary — one paragraph naming the tree, the session id, and the
			headline score. ## Effectiveness score — the score and the
			observations (each with node_path, severity, evidence).
			## Improvements — the proposal list with kind/target/change/rationale.
			## Open questions — anything that needs codeowner input before the
			changes are applied. Store the relative path at ${planPath}.
		`);
		evaluate(`${planPath} is set`);
	});

	action("Commit_And_Push", () => {
		evaluate(`${planPath} is set`);
		instruct(`
			Stage ${planPath}, create a single commit with message
			"docs(plans): improve-tree review of ${treeSlug} (session ${sessionRef})",
			then push to the current branch's upstream. Capture the new HEAD SHA
			into ${commitSha}. If the working tree had unrelated modifications,
			stage only ${planPath} — do not bundle them. If push fails (no
			upstream, network, etc.), submit failure with the error message
			rather than retrying.
		`);
	});
});

export { ambient };
