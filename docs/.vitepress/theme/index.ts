// https://vitepress.dev/guide/custom-theme
import type { Theme } from "vitepress";
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { createMermaidRenderer } from "vitepress-mermaid-renderer";
import { h, nextTick, watch } from "vue";
import "./style.css";
import AbtreeContrast from "./AbtreeContrast.vue";
import AbtreeCta from "./AbtreeCta.vue";
import AbtreeDemo from "./AbtreeDemo.vue";
import AbtreeDsl from "./AbtreeDsl.vue";
import RegistryCards from "./RegistryCards.vue";
import TreeSvg from "./TreeSvg.vue";

export default {
	extends: DefaultTheme,
	enhanceApp({ app }: { app: import("vue").App }) {
		app.component("AbtreeDemo", AbtreeDemo);
		app.component("AbtreeContrast", AbtreeContrast);
		app.component("RegistryCards", RegistryCards);
		app.component("TreeSvg", TreeSvg);
		app.component("AbtreeDsl", AbtreeDsl);
		app.component("AbtreeCta", AbtreeCta);
	},
	Layout: () => {
		const { isDark } = useData();

		const initMermaid = () => {
			createMermaidRenderer({
				theme: isDark.value ? "dark" : "neutral",
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
