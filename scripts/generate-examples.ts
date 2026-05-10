#!/usr/bin/env bun
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { renderTreeMermaid } from "../src/mermaid.ts";
import { loadTree } from "../src/tree.ts";

const ROOT = resolve(import.meta.dir, "..");
const TREES_DIR = join(ROOT, ".abtree", "trees");
const EXAMPLES_DIR = join(ROOT, "docs", "examples");
const EXAMPLES_INDEX = join(ROOT, "docs", "examples.md");
const GITHUB_RAW = "https://raw.githubusercontent.com/flying-dice/abtree/main";

interface TreeMeta {
	slug: string;
	name: string;
	version: string;
	description: string;
	raw: string;
	mermaid: string;
}

async function loadTrees(): Promise<TreeMeta[]> {
	if (!existsSync(TREES_DIR)) return [];
	const slugs = readdirSync(TREES_DIR)
		.filter((entry) => existsSync(join(TREES_DIR, entry, "TREE.yaml")))
		.sort();

	const out: TreeMeta[] = [];
	for (const slug of slugs) {
		const yamlPath = join(TREES_DIR, slug, "TREE.yaml");
		const raw = readFileSync(yamlPath, "utf-8");
		const parsed = Bun.YAML.parse(raw) as {
			name: string;
			version: string;
			description: string;
		};
		const tree = await loadTree(slug);
		const name = parsed.name ?? slug;
		const mermaid = tree
			? renderTreeMermaid(tree.root, { title: name })
			: "";
		out.push({
			slug,
			name,
			version: parsed.version ?? "1.0.0",
			description: parsed.description ?? "",
			raw,
			mermaid,
		});
	}
	return out;
}

function installSnippet(slug: string): string {
	return `mkdir -p .abtree/trees/${slug} \\
  && curl -fsSL ${GITHUB_RAW}/.abtree/trees/${slug}/TREE.yaml \\
         -o .abtree/trees/${slug}/TREE.yaml`;
}

function runSnippet(slug: string): string {
	return `claude "Using abtree CLI. Execute the '${slug}' workflow"`;
}

function yamlString(s: string): string {
	return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function titleCase(s: string): string {
	return s
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function renderExamplePage(tree: TreeMeta): string {
	return `---
title: ${titleCase(tree.name)}
description: ${yamlString(tree.description.replace(/\n/g, " "))}
---

# ${titleCase(tree.name)}

${tree.description}

**Version:** ${tree.version}

**Files**

- \`${tree.slug}/TREE.yaml\` — main

**Install**

\`\`\`sh
${installSnippet(tree.slug)}
\`\`\`

**Run with Claude**

\`\`\`sh
${runSnippet(tree.slug)}
\`\`\`

---

## Diagram

\`\`\`mermaid
${tree.mermaid.trimEnd()}
\`\`\`

## Tree definition

\`\`\`yaml
${tree.raw.trimEnd()}
\`\`\`
`;
}

function renderIndexPage(trees: TreeMeta[]): string {
	const rows = trees
		.map(
			(t) =>
				`| [${titleCase(t.name)}](/examples/${t.slug}) | ${t.description.replace(/\n/g, " ")} |`,
		)
		.join("\n");

	const sections = trees
		.map((t) => {
			return `## [${titleCase(t.name)}](/examples/${t.slug})

${t.description}

**Install**

\`\`\`sh
${installSnippet(t.slug)}
\`\`\`

**Run with Claude**

\`\`\`sh
${runSnippet(t.slug)}
\`\`\`

---
`;
		})
		.join("\n");

	return `---
description: Ready-to-use abtree behaviour trees, installable in one command.
---

# Examples registry

Ready-to-use behaviour trees. Each entry includes the YAML source, a one-liner to copy it into your local \`.abtree/trees/<slug>/\`, and a Claude handover command that briefs Claude to drive the execution.

Trees live in \`.abtree/trees/<slug>/TREE.yaml\`. Every install command is idempotent — safe to re-run. Existing files are overwritten with the latest version from \`main\`.

| Tree | Description |
|------|-------------|
${rows}

---

${sections}
## Submitting your own

Trees are just YAML — see [Writing trees](/guide/writing-trees) for the format. Open a PR against [\`flying-dice/abtree\`](https://github.com/flying-dice/abtree) adding your tree to \`.abtree/trees/<slug>/TREE.yaml\` and an entry on this page, and it'll ship in the next release.
`;
}

async function main() {
	const trees = await loadTrees();
	console.log(`Generating example pages for ${trees.length} trees…`);

	mkdirSync(EXAMPLES_DIR, { recursive: true });

	for (const tree of trees) {
		const dest = join(EXAMPLES_DIR, `${tree.slug}.md`);
		writeFileSync(dest, renderExamplePage(tree));
		console.log(`  ✓ docs/examples/${tree.slug}.md`);
	}

	writeFileSync(EXAMPLES_INDEX, renderIndexPage(trees));
	console.log("  ✓ docs/examples.md");

	console.log("Done.");
}

await main();
