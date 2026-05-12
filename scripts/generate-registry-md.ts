#!/usr/bin/env bun
/**
 * Generate the per-tree docs pages and the static catalogue inside
 * docs/registry.md from docs/registry.ts.
 *
 * For each entry in registry.ts:
 *   - Copy `trees/<slug>/README.md` → `docs/trees/<slug>.md` with a
 *     vitepress frontmatter block (title, description) prepended and
 *     `./tree.svg` references rewritten to `/trees/<slug>.svg`.
 *   - Copy `trees/<slug>/tree.svg` → `docs/public/trees/<slug>.svg` so
 *     the rewritten image path resolves at runtime.
 *
 * The catalogue block in docs/registry.md is rewritten between the
 * `catalogue:start` / `catalogue:end` HTML comments; each entry links
 * to the new internal page rather than the GitHub source.
 *
 * Run as part of `docs:build`. Idempotent.
 */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { registry } from "../docs/registry.ts";

const ROOT = resolve(import.meta.dir, "..");
const DOCS_TREES = resolve(ROOT, "docs/trees");
const PUBLIC_TREES = resolve(ROOT, "docs/public/trees");

mkdirSync(DOCS_TREES, { recursive: true });
mkdirSync(PUBLIC_TREES, { recursive: true });

/** Derive the tree slug from a registry entry's GitHub link. */
function slugFor(link: string): string {
	const parts = link.split("/").filter(Boolean);
	return parts[parts.length - 1] ?? "";
}

/** Single-line escape for YAML frontmatter string values. */
function yamlString(s: string): string {
	return s.replace(/"/g, '\\"');
}

let pagesWritten = 0;
let svgsCopied = 0;

for (const entry of registry) {
	const slug = slugFor(entry.link);
	if (!slug) continue;

	const treeDir = resolve(ROOT, `trees/${slug}`);
	const readmePath = resolve(treeDir, "README.md");
	const svgSrc = resolve(treeDir, "tree.svg");

	if (!existsSync(readmePath)) {
		console.warn(`skip ${slug}: no README.md at ${readmePath}`);
		continue;
	}

	const readme = readFileSync(readmePath, "utf8");

	// Replace `![alt](./tree.svg)` with the interactive <TreeSvg>
	// component. The source README keeps a portable markdown image
	// (renders on GitHub and inside the npm tarball); the docs page
	// upgrades to a pannable, zoomable, fullscreen-capable widget.
	let body = readme.replace(
		/!\[[^\]]*\]\(\.\/tree\.svg\)/g,
		`<TreeSvg src="/trees/${slug}.svg" :height="520" />`,
	);

	// Drop a leading `# <name>` line if present — vitepress renders the
	// frontmatter title; a second h1 in the body would be a double-headed
	// page.
	body = body.replace(/^#\s+[^\n]+\n+/, "");

	const frontmatter = [
		"---",
		// Quote both values — entry.name starts with @ (a YAML reserved
		// indicator) and descriptions can contain colons.
		`title: ${JSON.stringify(yamlString(entry.name))}`,
		`description: ${JSON.stringify(yamlString(entry.description))}`,
		"---",
		"",
		`# ${entry.name}`,
		"",
		entry.description,
		"",
		`[View on GitHub →](${entry.link})`,
		"",
		"---",
		"",
	].join("\n");

	const outPath = resolve(DOCS_TREES, `${slug}.md`);
	writeFileSync(outPath, frontmatter + body);
	pagesWritten++;

	if (existsSync(svgSrc)) {
		copyFileSync(svgSrc, resolve(PUBLIC_TREES, `${slug}.svg`));
		svgsCopied++;
	}
}

// Rewrite the static catalogue block in docs/registry.md.
const START =
	"<!-- catalogue:start — generated from docs/registry.ts by scripts/generate-registry-md.ts -->";
const END = "<!-- catalogue:end -->";

const lines = registry.map((entry) => {
	const slug = slugFor(entry.link);
	return `- [\`${entry.name}\`](/trees/${slug}) — ${entry.description}`;
});
const block = `${START}\n\n${lines.join("\n")}\n\n${END}`;

const registryMd = resolve(ROOT, "docs/registry.md");
const src = readFileSync(registryMd, "utf8");

const startIdx = src.indexOf(START);
const endIdx = src.indexOf(END);
if (startIdx < 0 || endIdx < 0) {
	throw new Error(
		`Catalogue markers not found in ${registryMd}. Ensure both ${START} and ${END} are present.`,
	);
}

const next = src.slice(0, startIdx) + block + src.slice(endIdx + END.length);
writeFileSync(registryMd, next);

console.log(
	`wrote ${pagesWritten} tree pages, ${svgsCopied} svgs, ${registry.length} catalogue entries`,
);
