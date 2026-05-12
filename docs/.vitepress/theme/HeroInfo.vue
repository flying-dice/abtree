<script setup lang="ts">
import { useData } from "vitepress";

// frontmatter is referenced from the template; biome's Vue SFC checker
// only sees the script block.
// biome-ignore lint/correctness/noUnusedVariables: used in template
const { frontmatter } = useData();
</script>

<template>
	<h1
		v-if="frontmatter.hero?.name || frontmatter.hero?.text"
		id="main-title"
		class="heading"
	>
		<span
			v-if="frontmatter.hero?.name"
			class="name clip"
			v-html="frontmatter.hero.name"
		/>
		<span
			v-if="frontmatter.hero?.text"
			class="text"
			v-html="frontmatter.hero.text"
		/>
	</h1>
	<p class="tagline">
    Treat agent instructions like the software they are. Clear steps, predictable behavior, real answers when something goes wrong.
  </p>
</template>

<style scoped>
/* VPHero's heading/name/text/tagline rules are scoped to that component,
 * so the slot content needs its own copy. Kept in sync with the upstream
 * VPHero.vue from vitepress 2.x for visual parity. */
.heading {
	display: flex;
	flex-direction: column;
	align-items: center;
}
@media (min-width: 960px) {
	.heading {
		align-items: flex-start;
	}
}
.name,
.text {
	width: fit-content;
	max-width: 392px;
	letter-spacing: -0.4px;
	line-height: 40px;
	font-size: 32px;
	font-weight: 700;
	white-space: pre-wrap;
}
.name {
	color: var(--vp-home-hero-name-color);
}
/* The hero text is injected via v-html, so its children skip Vue's
 * scoped-CSS data attribute. Use :deep() to reach them. The struck-out
 * "Hoping." steps back to a muted text colour; "Behaving." carries the
 * brand pink. */
.text :deep(s) {
	color: var(--vp-c-text-3);
	font-weight: 500;
	text-decoration-line: line-through;
	text-decoration-thickness: 0.06em;
}
.text :deep(.accent) {
	color: #ff79c6;
	-webkit-text-fill-color: #ff79c6;
}
.clip {
	background: var(--vp-home-hero-name-background);
	-webkit-background-clip: text;
	background-clip: text;
	-webkit-text-fill-color: var(--vp-home-hero-name-color);
}
@media (min-width: 640px) {
	.name,
	.text {
		max-width: 576px;
		line-height: 56px;
		font-size: 48px;
	}
}
@media (min-width: 960px) {
	.name,
	.text {
		line-height: 64px;
		font-size: 56px;
	}
}

.tagline {
	padding-top: 8px;
	max-width: 392px;
	margin-left: auto;
	margin-right: auto;
	line-height: 28px;
	font-size: 18px;
	font-weight: 500;
	text-align: center;
	color: var(--vp-c-text-2);
}
@media (min-width: 960px) {
	.tagline {
		margin-left: 0;
		margin-right: 0;
		text-align: left;
	}
}
@media (min-width: 640px) {
	.tagline {
		padding-top: 12px;
		max-width: 576px;
		line-height: 32px;
		font-size: 20px;
	}
}
@media (min-width: 960px) {
	.tagline {
		line-height: 36px;
		font-size: 24px;
	}
}

/* Each authoring format is highlighted in the brand pink, in the
 * tagline's regular weight so the three names read as a single list
 * rather than a heading-within-a-heading. */
.hero-word {
	color: #ff79c6;
	font-weight: 700;
}
</style>
