// Public registry of abtree behaviour-tree packages.
//
// Each entry points at an external source repository. The docs site renders
// these as searchable cards at /registry; clicking a card opens the link.
//
// To add a tree to the registry: publish it as a node-installable package
// (TREE.yaml + package.json + git tag), then append an entry below. Keep
// descriptions to one or two sentences so the cards stay scannable.

export interface RegistryEntry {
	name: string;
	description: string;
	link: string;
}

export const registry: RegistryEntry[] = [
	{
		name: "abtree_test-tree",
		description:
			"Run a BDD test spec against a target tree. Captures the mermaid trace, compares the run's final $LOCAL against the spec's `then` assertions, and writes a markdown report next to the spec.",
		link: "https://github.com/flying-dice/abtree_test-tree",
	},
	{
		name: "abtree_srp-refactor",
		description:
			"Refactor a behaviour tree by splitting composites or actions with overloaded responsibilities into focused, single-responsibility units.",
		link: "https://github.com/flying-dice/abtree_srp-refactor",
	},
];
