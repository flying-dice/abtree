// https://vitepress.dev/guide/custom-theme
import type { Theme } from "vitepress";
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { createMermaidRenderer } from "vitepress-mermaid-renderer";
import { h, nextTick, watch } from "vue";
import "./style.css";

export default {
	extends: DefaultTheme,
	Layout: () => {
		const { isDark } = useData();

		const initMermaid = () => {
			createMermaidRenderer({
				theme: isDark.value ? "dark" : "forest",
			});
		};

		nextTick(() => initMermaid());
		watch(
			() => isDark.value,
			() => initMermaid(),
		);

		return h(DefaultTheme.Layout);
	},
} satisfies Theme;
