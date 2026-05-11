#!/usr/bin/env bun
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
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

interface ScenarioReport {
	path: string;
	raw: string;
	timestamp: string;
	verdict: string | null;
}

interface ScenarioInfo {
	scenario: string;
	specPath: string;
	specRaw: string;
	scenarioName: string | null;
	latestReport: ScenarioReport | null;
}

interface TreeMeta {
	slug: string;
	name: string;
	version: string;
	description: string;
	raw: string;
	mermaid: string;
	scenarios: ScenarioInfo[];
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
		const mermaid = tree ? renderTreeMermaid(tree.root, { title: name }) : "";
		out.push({
			slug,
			name,
			version: parsed.version ?? "1.0.0",
			description: parsed.description ?? "",
			raw,
			mermaid,
			scenarios: loadScenarios(slug),
		});
	}
	return out;
}

function loadScenarios(slug: string): ScenarioInfo[] {
	const treeDir = join(TREES_DIR, slug);
	if (!existsSync(treeDir)) return [];
	const files = readdirSync(treeDir);

	const tests = files
		.filter((f) => /^TEST__.+\.yaml$/.test(f))
		.map((f) => ({
			scenario: f.replace(/^TEST__/, "").replace(/\.yaml$/, ""),
			file: f,
		}));

	const reportRegex = /^REPORT__(.+)__(\d{8}T\d{6}Z)\.md$/;
	const latestByScenario = new Map<
		string,
		{ file: string; timestamp: string }
	>();
	for (const f of files) {
		const m = f.match(reportRegex);
		if (!m) continue;
		const [, scenario, timestamp] = m;
		const existing = latestByScenario.get(scenario);
		if (!existing || timestamp > existing.timestamp) {
			latestByScenario.set(scenario, { file: f, timestamp });
		}
	}

	return tests
		.sort((a, b) => a.scenario.localeCompare(b.scenario))
		.map((t) => {
			const specPath = join(treeDir, t.file);
			const specRaw = readFileSync(specPath, "utf-8");
			let scenarioName: string | null = null;
			try {
				const data = Bun.YAML.parse(specRaw) as {
					scenario?: { name?: string };
				};
				scenarioName = data?.scenario?.name ?? null;
			} catch {
				scenarioName = null;
			}
			const reportInfo = latestByScenario.get(t.scenario);
			let latestReport: ScenarioReport | null = null;
			if (reportInfo) {
				const raw = readFileSync(join(treeDir, reportInfo.file), "utf-8");
				latestReport = {
					path: `.abtree/trees/${slug}/${reportInfo.file}`,
					raw,
					timestamp: reportInfo.timestamp,
					verdict: extractVerdict(raw),
				};
			}
			return {
				scenario: t.scenario,
				specPath: `.abtree/trees/${slug}/${t.file}`,
				specRaw,
				scenarioName,
				latestReport,
			};
		});
}

function extractVerdict(raw: string): string | null {
	const m = raw.match(/^\*\*Overall:\*\*\s*(\S+)/m);
	return m ? m[1] : null;
}

function formatTimestamp(ts: string): string {
	const m = ts.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
	if (!m) return ts;
	return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}Z`;
}

function demoteHeadings(md: string, levels: number): string {
	return md
		.split("\n")
		.map((line) => {
			const m = line.match(/^(#{1,6})(\s.*)$/);
			if (!m) return line;
			const newLevel = Math.min(6, m[1].length + levels);
			return "#".repeat(newLevel) + m[2];
		})
		.join("\n");
}

function stripFirstH1(md: string): string {
	return md.replace(/^#\s[^\n]*\n+/, "");
}

function verdictBadge(verdict: string | null): string {
	return verdict ?? "—";
}

function renderScenariosIndex(tree: TreeMeta): string {
	if (tree.scenarios.length === 0) return "";

	const reportCount = tree.scenarios.filter((s) => s.latestReport).length;
	const intro = `This tree has ${tree.scenarios.length} test scenario${
		tree.scenarios.length === 1 ? "" : "s"
	}${reportCount > 0 ? ` (${reportCount} with a recorded run)` : ""}. Each scenario has its own page with the BDD spec and the latest report (mermaid trace + assertions).`;

	const rows = tree.scenarios
		.map((s) => {
			const name = s.scenarioName ?? s.scenario;
			const verdict = s.latestReport
				? verdictBadge(s.latestReport.verdict)
				: "—";
			const when = s.latestReport
				? formatTimestamp(s.latestReport.timestamp)
				: "_no run yet_";
			return `| [\`${s.scenario}\`](/examples/${tree.slug}/${s.scenario}) | ${escapeAngleTokens(name)} | ${verdict} | ${when} |`;
		})
		.join("\n");

	return `## Tests & reports

${intro}

| Scenario | Description | Latest verdict | When |
|---|---|---|---|
${rows}`;
}

function renderScenarioPage(tree: TreeMeta, s: ScenarioInfo): string {
	const title = s.scenarioName ?? s.scenario;
	const lines: string[] = [];
	lines.push("---");
	lines.push(`title: ${titleCase(tree.name)} — ${s.scenario}`);
	lines.push(
		`description: ${yamlString(escapeAngleTokens(title).replace(/\n/g, " "))}`,
	);
	lines.push("---");
	lines.push("");
	lines.push(`# ${s.scenario}`);
	lines.push("");
	lines.push(
		`Scenario for [${titleCase(tree.name)}](/examples/${tree.slug}/).`,
	);
	lines.push("");
	if (s.scenarioName) {
		lines.push(`_${escapeAngleTokens(s.scenarioName)}_`);
		lines.push("");
	}
	if (s.latestReport) {
		lines.push(
			`**Latest run:** ${verdictBadge(s.latestReport.verdict)} — ${formatTimestamp(s.latestReport.timestamp)}`,
		);
		lines.push("");
	} else {
		lines.push("_No recorded run yet._");
		lines.push("");
	}
	lines.push(`**Spec:** \`${s.specPath}\``);
	lines.push("");
	if (s.latestReport) {
		lines.push(`**Report:** \`${s.latestReport.path}\``);
		lines.push("");
	}
	lines.push("---");
	lines.push("");
	lines.push("## Test spec");
	lines.push("");
	lines.push("```yaml");
	lines.push(s.specRaw.trimEnd());
	lines.push("```");
	lines.push("");
	if (s.latestReport) {
		lines.push("## Latest report");
		lines.push("");
		// Strip the H1 (it's the page-level title we already render) and
		// demote remaining headings by 1 so the report's H2s become H3s under
		// the page's "## Latest report" heading.
		lines.push(demoteHeadings(stripFirstH1(s.latestReport.raw), 1).trimEnd());
		lines.push("");
	}
	return lines.join("\n");
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

// VitePress runs markdown through Vue's template compiler, which treats
// `<word>` as an HTML element and errors if it's not closed. Escape bare
// angle-bracket tokens in free-text descriptions before they hit markdown
// paragraphs or table cells.
function escapeAngleTokens(s: string): string {
	return s.replace(/<([A-Za-z][\w.-]*)>/g, "&lt;$1&gt;");
}

function titleCase(s: string): string {
	return s
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function renderExamplePage(tree: TreeMeta): string {
	const scenariosSection = renderScenariosIndex(tree);
	const files: string[] = [`- \`${tree.slug}/TREE.yaml\` — main`];
	if (tree.scenarios.length > 0) {
		const reportCount = tree.scenarios.filter((s) => s.latestReport).length;
		files.push(
			`- \`${tree.slug}/TEST__*.yaml\` — ${tree.scenarios.length} test scenario${
				tree.scenarios.length === 1 ? "" : "s"
			}${reportCount > 0 ? ` (${reportCount} with a recorded run)` : ""}`,
		);
	}

	return `---
title: ${titleCase(tree.name)}
description: ${yamlString(tree.description.replace(/\n/g, " "))}
---

# ${titleCase(tree.name)}

${escapeAngleTokens(tree.description)}

**Version:** ${tree.version}

**Files**

${files.join("\n")}

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

See the full YAML on the [Definition](/examples/${tree.slug}/definition) page.
${scenariosSection ? `\n${scenariosSection}` : ""}`;
}

function renderDefinitionPage(tree: TreeMeta): string {
	return `---
title: ${titleCase(tree.name)} — Definition
description: ${yamlString(`Full TREE.yaml source for ${titleCase(tree.name)}.`)}
---

# Definition

Full YAML source for [${titleCase(tree.name)}](/examples/${tree.slug}/).

**Source:** \`.abtree/trees/${tree.slug}/TREE.yaml\`

\`\`\`yaml
${tree.raw.trimEnd()}
\`\`\`
`;
}

function renderIndexPage(trees: TreeMeta[]): string {
	const rows = trees
		.map(
			(t) =>
				`| [${titleCase(t.name)}](/examples/${t.slug}/) | ${escapeAngleTokens(t.description.replace(/\n/g, " "))} |`,
		)
		.join("\n");

	const sections = trees
		.map((t) => {
			return `## [${titleCase(t.name)}](/examples/${t.slug}/)

${escapeAngleTokens(t.description)}

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
		const slugDir = join(EXAMPLES_DIR, tree.slug);
		mkdirSync(slugDir, { recursive: true });

		// Remove legacy flat `<slug>.md` (pre-subpages layout) so VitePress
		// doesn't see two routes for /examples/<slug>.
		const legacyFlat = join(EXAMPLES_DIR, `${tree.slug}.md`);
		if (existsSync(legacyFlat)) {
			rmSync(legacyFlat);
		}

		writeFileSync(join(slugDir, "index.md"), renderExamplePage(tree));
		console.log(`  ✓ docs/examples/${tree.slug}/index.md`);

		writeFileSync(join(slugDir, "definition.md"), renderDefinitionPage(tree));
		console.log(`  ✓ docs/examples/${tree.slug}/definition.md`);

		const wantedFiles = new Set<string>(["index.md", "definition.md"]);
		for (const scenario of tree.scenarios) {
			const fname = `${scenario.scenario}.md`;
			wantedFiles.add(fname);
			writeFileSync(join(slugDir, fname), renderScenarioPage(tree, scenario));
			console.log(`  ✓ docs/examples/${tree.slug}/${scenario.scenario}.md`);
		}

		// Clean up orphaned scenario pages (TEST file was renamed/removed).
		for (const f of readdirSync(slugDir)) {
			if (!f.endsWith(".md")) continue;
			if (!wantedFiles.has(f)) {
				rmSync(join(slugDir, f));
				console.log(`  ✗ removed orphan docs/examples/${tree.slug}/${f}`);
			}
		}
	}

	writeFileSync(EXAMPLES_INDEX, renderIndexPage(trees));
	console.log("  ✓ docs/examples.md");

	console.log("Done.");
}

await main();
