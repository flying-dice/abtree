// https://vitepress.dev/guide/custom-theme
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import "./style.css";
import AbtreeContrast from "./AbtreeContrast.vue";
import AbtreeCta from "./AbtreeCta.vue";
import AbtreeDemo from "./AbtreeDemo.vue";
import AbtreeDsl from "./AbtreeDsl.vue";
import HeroInfo from "./HeroInfo.vue";
import InstallDemo from "./InstallDemo.vue";
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
		app.component("InstallDemo", InstallDemo);
	},
	Layout: () =>
		h(DefaultTheme.Layout, null, {
			"home-hero-info": () => h(HeroInfo),
		}),
} satisfies Theme;
