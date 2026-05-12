import type { Plugin } from "vite";
import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";

// Registry is rendered as a single searchable cards page driven by
// docs/registry.ts — no per-tree subpages, so no dynamic sidebar tree.
const REGISTRY_SIDEBAR = [{ text: "Discover trees", link: "/registry" }] as const;

function robotsTxt(siteUrl: string): Plugin {
	return {
		name: "abtree:robots-txt",
		apply: "build",
		generateBundle() {
			this.emitFile({
				type: "asset",
				fileName: "robots.txt",
				source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
			});
		},
	};
}

const SITE_URL = "https://abtree.sh";
const SITE_TITLE = "abtree";
const SITE_TAGLINE = "Behaviour Trees for AI Agents and Agentic Workflows";
const SITE_DESCRIPTION =
	"abtree is an open-source behaviour tree runtime for AI agents and autonomous agentic workflows. Define LLM agent behaviour as YAML, drive it from a CLI — deterministic execution, durable state, resumable runs. Framework-agnostic: works with Claude, ChatGPT, and any LLM.";
const OG_IMAGE = `${SITE_URL}/abtree-mark.svg`;

const KEYWORDS = [
	// Behaviour tree core
	"behaviour tree",
	"behavior tree",
	"behaviour trees",
	"behavior trees",
	"BT",
	"behaviour tree YAML",
	"declarative behaviour tree",
	// Agents
	"AI agents",
	"AI agent",
	"AI agent framework",
	"autonomous agents",
	"autonomous AI agents",
	"agentic",
	"agentic AI",
	"agentic workflow",
	"agentic workflows",
	"agentic systems",
	"agentic orchestration",
	"agent framework",
	"agent runtime",
	"agent orchestration",
	"agent orchestrator",
	"agent CLI",
	"agent state management",
	"agent infrastructure",
	"multi-agent",
	"multi-agent systems",
	// LLM
	"LLM agents",
	"LLM workflow",
	"LLM workflows",
	"LLM orchestration",
	"LLMops",
	// Properties
	"deterministic agents",
	"durable agents",
	"resumable agents",
	"reproducible AI workflows",
	"declarative workflows",
	"composable agents",
	"structured prompts",
	"prompt orchestration",
	// Categories
	"AI workflow",
	"AI orchestration",
	"AI automation",
	"AI pipelines",
	"AI dev tools",
	"AI engineering",
	// Models / platforms
	"Claude",
	"Claude Code",
	"ChatGPT",
	"GPT agents",
	"function calling",
	"tool use",
	// Format / CLI
	"YAML workflow",
	"YAML agents",
	"CLI for AI agents",
	// Product
	"abtree",
	"abtree CLI",
];

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: SITE_TITLE,
	titleTemplate: `:title | ${SITE_TITLE} — ${SITE_TAGLINE}`,
	description: SITE_DESCRIPTION,
	lang: "en-GB",
	cleanUrls: true,

	sitemap: {
		hostname: SITE_URL,
	},

	head: [
		["link", { rel: "icon", type: "image/svg+xml", href: "/abtree-mark.svg" }],
		["meta", { name: "theme-color", content: "#12121c" }],
		["meta", { name: "author", content: "Flying Dice" }],
		["meta", { name: "keywords", content: KEYWORDS.join(", ") }],

		// Open Graph
		["meta", { property: "og:type", content: "website" }],
		["meta", { property: "og:site_name", content: SITE_TITLE }],
		["meta", { property: "og:title", content: SITE_TITLE }],
		["meta", { property: "og:description", content: SITE_DESCRIPTION }],
		["meta", { property: "og:url", content: SITE_URL }],
		["meta", { property: "og:image", content: OG_IMAGE }],
		["meta", { property: "og:image:alt", content: "abtree mark" }],
		["meta", { property: "og:locale", content: "en_GB" }],

		// Twitter Card
		["meta", { name: "twitter:card", content: "summary_large_image" }],
		["meta", { name: "twitter:title", content: SITE_TITLE }],
		["meta", { name: "twitter:description", content: SITE_DESCRIPTION }],
		["meta", { name: "twitter:image", content: OG_IMAGE }],

		// JSON-LD: software application schema for the project itself
		[
			"script",
			{ type: "application/ld+json" },
			JSON.stringify({
				"@context": "https://schema.org",
				"@type": "SoftwareApplication",
				name: SITE_TITLE,
				alternateName: `${SITE_TITLE} — ${SITE_TAGLINE}`,
				description: SITE_DESCRIPTION,
				url: SITE_URL,
				applicationCategory: "DeveloperApplication",
				applicationSubCategory: "AI Agent Framework",
				operatingSystem: "macOS, Linux, Windows",
				license: "https://opensource.org/licenses/MIT",
				offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
				codeRepository: "https://github.com/flying-dice/abtree",
				keywords: KEYWORDS.join(", "),
				about: [
					{ "@type": "Thing", name: "AI agents" },
					{ "@type": "Thing", name: "Agentic workflows" },
					{ "@type": "Thing", name: "Behaviour trees" },
					{ "@type": "Thing", name: "Autonomous agents" },
					{ "@type": "Thing", name: "LLM orchestration" },
				],
			}),
		],

		// Fonts
		["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
		[
			"link",
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossorigin: "",
			},
		],
		[
			"link",
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
			},
		],
	],

	transformPageData(pageData) {
		const path = pageData.relativePath
			.replace(/index\.md$/, "")
			.replace(/\.md$/, "");
		const canonical = `${SITE_URL}/${path}`.replace(/\/$/, "/");
		const isHome = pageData.relativePath === "index.md";
		const pageTitle = pageData.frontmatter.title ?? pageData.title;
		const title = isHome
			? `${SITE_TITLE} — ${SITE_TAGLINE}`
			: pageTitle
				? `${pageTitle} | ${SITE_TITLE} — ${SITE_TAGLINE}`
				: `${SITE_TITLE} — ${SITE_TAGLINE}`;
		const description = pageData.frontmatter.description ?? SITE_DESCRIPTION;

		pageData.frontmatter.head ??= [];
		pageData.frontmatter.head.push(
			["link", { rel: "canonical", href: canonical }],
			["meta", { property: "og:url", content: canonical }],
			["meta", { property: "og:title", content: title }],
			["meta", { property: "og:description", content: description }],
			["meta", { name: "twitter:title", content: title }],
			["meta", { name: "twitter:description", content: description }],
		);
	},

	vite: {
		plugins: [llmstxt(), robotsTxt(SITE_URL)],
	},

	themeConfig: {
		logo: {
			light: "/abtree-mark.svg",
			dark: "/abtree-mark.svg",
			alt: "abtree",
		},
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Get started", link: "/getting-started" },
			{ text: "Concepts", link: "/concepts/" },
			{ text: "Guide", link: "/guide/writing-trees" },
			{ text: "Agents", link: "/agents/execute" },
			{ text: "Discover trees", link: "/registry" },
			{
				text: "LLMs",
				items: [
					{ text: "llms.txt", link: "/llms.txt", target: "_blank" },
					{ text: "llms-full.txt", link: "/llms-full.txt", target: "_blank" },
				],
			},
		],

		sidebar: [
			{
				text: "Introduction",
				items: [
					{ text: "Motivation", link: "/motivation" },
					{ text: "Get started", link: "/getting-started" },
				],
			},
			{
				text: "Core concepts",
				items: [
					{ text: "Why behaviour trees?", link: "/concepts/" },
					{ text: "State", link: "/concepts/state" },
					{
						text: "Branches and actions",
						link: "/concepts/branches-and-actions",
					},
				],
			},
			{
				text: "Guide",
				items: [
					{ text: "Using a tree", link: "/guide/using-trees" },
					{ text: "Writing trees", link: "/guide/writing-trees" },
					{ text: "Fragments", link: "/guide/fragments" },
					{ text: "Design a new tree", link: "/guide/design-process" },
					{ text: "Idioms", link: "/guide/idioms" },
					{ text: "Anti-patterns", link: "/guide/anti-patterns" },
					{ text: "Testing trees", link: "/guide/testing" },
					{
						text: "Inspecting executions",
						link: "/guide/inspecting-executions",
					},
					{ text: "Publishing a tree", link: "/guide/publishing-a-tree" },
					{ text: "CLI reference", link: "/guide/cli" },
				],
			},
			{
				text: "Agents",
				items: [
					{ text: "Execution protocol", link: "/agents/execute" },
					{ text: "Authoring trees", link: "/agents/author" },
					{ text: "JSON Schema", link: "/agents/schema" },
				],
			},
			{
				text: "Discover trees",
				items: [...REGISTRY_SIDEBAR],
			},
		],

		socialLinks: [
			{ icon: "github", link: "https://github.com/flying-dice/abtree" },
		],

		footer: {
			message: "MIT licensed",
			copyright: "Built by Flying Dice",
		},

		search: {
			provider: "local",
		},
	},
});
