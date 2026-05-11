<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useData } from "vitepress";

const { frontmatter } = useData();

// The hero tagline cycles through the three supported authoring formats
// using the same delete-and-retype rhythm as the install demo below.
const words = ["YAML", "JSON", "TypeScript"];
const idx = ref(0);
const displayed = ref(words[0]);
type Phase = "typing" | "holding" | "deleting" | "empty";
const phase = ref<Phase>("holding");

let timer: ReturnType<typeof setTimeout> | null = null;

function tick() {
	const target = words[idx.value];
	switch (phase.value) {
		case "typing":
			if (displayed.value.length < target.length) {
				displayed.value = target.slice(0, displayed.value.length + 1);
				timer = setTimeout(tick, 75);
			} else {
				phase.value = "holding";
				timer = setTimeout(tick, 1800);
			}
			break;
		case "holding":
			phase.value = "deleting";
			timer = setTimeout(tick, 38);
			break;
		case "deleting":
			if (displayed.value.length > 0) {
				displayed.value = displayed.value.slice(0, -1);
				timer = setTimeout(tick, 38);
			} else {
				phase.value = "empty";
				timer = setTimeout(tick, 260);
			}
			break;
		case "empty":
			idx.value = (idx.value + 1) % words.length;
			phase.value = "typing";
			timer = setTimeout(tick, 75);
			break;
	}
}

onMounted(() => {
	tick();
});
onUnmounted(() => {
	if (timer) clearTimeout(timer);
});
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
		Define agent workflows as
		<span class="hero-word"
			><span class="word-text">{{ displayed }}</span
			><span class="word-caret" aria-hidden="true"
		/></span>
		<br />
		The runtime hands the agent one step at a time and persists the
		cursor — so workflows stay reproducible no matter how big they get.
	</p>
</template>

<style scoped>
/* VPHero's heading/name/text/tagline rules are scoped to that component,
 * so the slot content needs its own copy. Kept in sync with the upstream
 * VPHero.vue from vitepress 2.x for visual parity. */
.heading {
	display: flex;
	flex-direction: column;
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
	line-height: 28px;
	font-size: 18px;
	font-weight: 500;
	white-space: pre-wrap;
	color: var(--vp-c-text-2);
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

/* Cycling word + blinking caret. The `<br>` after the word means the rest
 * of the tagline always reflows on a new line below, so it doesn't shift
 * as the word grows from "YAML" (4 chars) to "TypeScript" (10 chars). */
.hero-word {
	display: inline-block;
	color: #ff79c6;
	font-weight: 700;
	white-space: pre;
}
.word-text {
	letter-spacing: -0.2px;
}
.word-caret {
	display: inline-block;
	width: 0.42em;
	height: 0.95em;
	margin-left: 2px;
	background: #ff79c6;
	vertical-align: -1px;
	animation: hero-caret-blink 1s steps(1) infinite;
	border-radius: 1px;
}
@keyframes hero-caret-blink {
	0%,
	50% {
		opacity: 1;
	}
	51%,
	100% {
		opacity: 0;
	}
}
</style>
