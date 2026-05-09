import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "abtree",
	description:
		"Behaviour trees for AI agents. Define workflows in YAML, drive them with a CLI, get deterministic execution and durable state.",

	themeConfig: {
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Get started", link: "/getting-started" },
			{ text: "Concepts", link: "/concepts/" },
			{ text: "Guide", link: "/guide/writing-trees" },
		],

		sidebar: {
			"/getting-started": [
				{
					text: "Introduction",
					items: [
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
						{ text: "Writing trees", link: "/guide/writing-trees" },
						{ text: "CLI reference", link: "/guide/cli" },
					],
				},
			],

			"/concepts/": [
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
						{ text: "Writing trees", link: "/guide/writing-trees" },
						{ text: "CLI reference", link: "/guide/cli" },
					],
				},
			],

			"/guide/": [
				{
					text: "Guide",
					items: [
						{ text: "Writing trees", link: "/guide/writing-trees" },
						{ text: "CLI reference", link: "/guide/cli" },
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
			],
		},

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
