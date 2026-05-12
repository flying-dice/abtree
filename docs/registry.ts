// Public registry of abtree behaviour-tree packages.
//
// Every published tree in the abtree monorepo gets a card here; the docs
// site renders them as searchable cards at /registry, and clicking a card
// opens the link.
//
// To add a tree: create a new package under `trees/<slug>/` (DSL or YAML),
// add a `description` to its `package.json`, then append an entry below.
// Keep descriptions to one or two sentences so the cards stay scannable.

export interface RegistryEntry {
	name: string;
	description: string;
	link: string;
}

const MONOREPO = "https://github.com/flying-dice/abtree/tree/main/trees";

export const registry: RegistryEntry[] = [
	{
		name: "@abtree/hello-world",
		description:
			"Greet a user based on time of day. A small example tree that demonstrates the sequence, selector, and action primitives.",
		link: `${MONOREPO}/hello-world`,
	},
	{
		name: "@abtree/implement",
		description:
			"Implement an approved plan with complexity-gated architectural review, following the clean-code rules in `clean-code.md`.",
		link: `${MONOREPO}/implement`,
	},
	{
		name: "@abtree/improve-codebase",
		description:
			"Continuous code-improvement cycle. Scores quality metrics in parallel, hardens findings via a senior-principal critique, triages with a human gate, then iterates through each refactor with bounded retries until the queue is drained.",
		link: `${MONOREPO}/improve-codebase`,
	},
	{
		name: "@abtree/improve-tree",
		description:
			"Score the effectiveness of a tree using evidence from one of its sessions, find improvements in parallel, draft a plan in `plans/`, then commit and push.",
		link: `${MONOREPO}/improve-tree`,
	},
	{
		name: "@abtree/refine-plan",
		description:
			"Refine a change request into an approved plan: analyse intent, draft to a per-execution draft file, critique it in place, promote to `plans/`, then take it through codeowner approval (either in-session or via an assigned MR).",
		link: `${MONOREPO}/refine-plan`,
	},
	{
		name: "@abtree/srp-refactor",
		description:
			"Score a codebase for Single Responsibility violations, pause for the human to pick one to tackle, refactor it in a bounded loop (re-scoring after every pass), run a multi-agent code review, and finish with a before-vs-after change report.",
		link: `${MONOREPO}/srp-refactor`,
	},
	{
		name: "@abtree/technical-writer",
		description:
			"Take a documentation goal, ground it in the repo's styleguide, find or build a home in the docs tree, write to it, and gate-check structure / flow / atomicity. Up to three write/review passes before surfacing failure to the human.",
		link: `${MONOREPO}/technical-writer`,
	},
	{
		name: "@abtree/test-tree",
		description:
			"Run a BDD test spec against a target tree. Captures the mermaid trace, compares the run's final $LOCAL against the spec's `then` assertions, and writes a markdown report next to the spec.",
		link: `${MONOREPO}/test-tree`,
	},
];
