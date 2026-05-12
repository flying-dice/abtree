<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

interface PM {
	name: string;
	cmd: string;
}

const pms: PM[] = [
	{ name: "npm", cmd: "npm i" },
	{ name: "pnpm", cmd: "pnpm add" },
	{ name: "bun", cmd: "bun add" },
	{ name: "yarn", cmd: "yarn add" },
];

// Cycled through to make the point that every transport works — a registry
// scope, a GitHub ref, a git+ssh URL to a private host, a raw tarball URL on
// a company-internal CDN.
const sources: string[] = [
	"@acme/implement-feature",
	"github:acme/implement-feature",
	"git+ssh://git@gitlab.com/acme/implement-feature.git",
	"https://acme.corp/implement-feature/1.3.1.tgz",
];

const sourceLabels: string[] = [
	"published to the public npm registry",
	"straight from a GitHub repo",
	"self-hosted git over SSH",
	"from an HTTPS tarball bundle",
];

const selectedPm = ref(0);
const sourceIdx = ref(0);
const displayed = ref("");

type Phase = "typing" | "holding" | "deleting" | "empty";
const phase = ref<Phase>("typing");

let installTimer: ReturnType<typeof setTimeout> | null = null;

function installTick() {
	const target = sources[sourceIdx.value];
	switch (phase.value) {
		case "typing":
			if (displayed.value.length < target.length) {
				displayed.value = target.slice(0, displayed.value.length + 1);
				installTimer = setTimeout(installTick, 38);
			} else {
				phase.value = "holding";
				installTimer = setTimeout(installTick, 1700);
			}
			break;
		case "holding":
			phase.value = "deleting";
			installTimer = setTimeout(installTick, 18);
			break;
		case "deleting":
			if (displayed.value.length > 0) {
				displayed.value = displayed.value.slice(0, -1);
				installTimer = setTimeout(installTick, 18);
			} else {
				phase.value = "empty";
				installTimer = setTimeout(installTick, 260);
			}
			break;
		case "empty":
			sourceIdx.value = (sourceIdx.value + 1) % sources.length;
			phase.value = "typing";
			installTimer = setTimeout(installTick, 60);
			break;
	}
}

const currentLabel = computed(() => sourceLabels[sourceIdx.value]);

onMounted(() => {
	installTick();
});
onUnmounted(() => {
	if (installTimer) clearTimeout(installTimer);
});
</script>

<template>
	<div class="install-wrap">
		<aside class="install-card">
			<div class="install-pms" role="tablist" aria-label="Package manager">
				<button
					v-for="(pm, i) in pms"
					:key="pm.name"
					type="button"
					role="tab"
					:aria-selected="i === selectedPm"
					class="pm-chip"
					:class="{ active: i === selectedPm }"
					@click="selectedPm = i"
				>
					<span class="pm-logo">
						<svg
							v-if="pm.name === 'npm'"
							viewBox="0 0 27 27"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<rect width="27" height="27" rx="2.5" fill="#CB3837" />
							<polygon
								fill="#fff"
								points="5.8 21.75 13.43 21.75 13.43 9.36 17.27 9.36 17.27 21.75 21.42 21.75 21.42 5.48 5.8 5.48"
							/>
						</svg>
						<svg
							v-else-if="pm.name === 'pnpm'"
							viewBox="0 0 200 200"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<g fill="#F9AD00">
								<rect x="0" y="0" width="56" height="56" />
								<rect x="72" y="0" width="56" height="56" />
								<rect x="144" y="0" width="56" height="56" />
								<rect x="72" y="72" width="56" height="56" />
								<rect x="144" y="72" width="56" height="56" />
							</g>
							<g fill="#7B7B7B">
								<rect x="0" y="72" width="56" height="56" />
								<rect x="0" y="144" width="56" height="56" />
								<rect x="72" y="144" width="56" height="56" />
								<rect x="144" y="144" width="56" height="56" />
							</g>
						</svg>
						<svg
							v-else-if="pm.name === 'bun'"
							viewBox="0 0 80 70"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<path
								d="M40 4 C18 4 4 19 4 36 C4 53 18 66 40 66 C62 66 76 53 76 36 C76 19 62 4 40 4 Z"
								fill="#FBF0DF"
								stroke="#000"
								stroke-width="2.5"
							/>
							<ellipse cx="30" cy="38" rx="2.5" ry="3.5" fill="#000" />
							<ellipse cx="50" cy="38" rx="2.5" ry="3.5" fill="#000" />
							<path
								d="M30 47 Q40 54 50 47"
								stroke="#000"
								stroke-width="2.5"
								fill="none"
								stroke-linecap="round"
							/>
						</svg>
						<svg
							v-else
							viewBox="0 0 30 30"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<circle cx="15" cy="15" r="13.5" fill="#2C8EBB" />
							<g
								stroke="#fff"
								stroke-width="1.2"
								fill="none"
								stroke-linecap="round"
							>
								<path d="M5 12 Q15 8 25 14" />
								<path d="M5 18 Q15 22 25 16" />
								<path d="M8 7 Q15 15 22 7" />
								<path d="M8 23 Q15 15 22 23" />
							</g>
						</svg>
					</span>
					<span class="pm-name">{{ pm.name }}</span>
				</button>
			</div>

			<div class="install-terminal" aria-live="polite">
				<span class="prompt">$</span>
				<span class="cmd">{{ pms[selectedPm].cmd }}</span>
				<span class="source">{{ displayed }}</span><span class="caret" />
			</div>

			<transition name="fade-label" mode="out-in">
				<p :key="currentLabel" class="install-caption">
					<span class="caption-mark">↳</span>
					{{ currentLabel }}
				</p>
			</transition>
		</aside>
	</div>
</template>

<style scoped>
/* Stretch to the full width of the surrounding doc container. The
 * component now sits inline with the page prose, so it inherits the
 * body container's bounds rather than imposing its own. */
.install-wrap {
	padding: 0;
	margin: 0;
	max-width: none;
	width: 100%;
}

.install-card {
	position: relative;
	margin: 16px 0 32px;
	padding: 0;
	background: none;
	border: none;
	border-radius: 0;
}

.install-pms {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin-bottom: 18px;
}
.pm-chip {
	display: inline-flex;
	align-items: center;
	gap: 9px;
	padding: 9px 16px 9px 11px;
	font: 700 13px/1 "Inter", system-ui, sans-serif;
	color: #d8d8de;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.09);
	border-radius: 9px;
	cursor: pointer;
	transition:
		background 160ms ease,
		border-color 160ms ease,
		color 160ms ease,
		transform 160ms ease,
		box-shadow 160ms ease;
}
.pm-chip:hover {
	background: rgba(255, 255, 255, 0.07);
	border-color: rgba(255, 121, 198, 0.4);
	color: #f8f8f2;
	transform: translateY(-1px);
}
.pm-chip.active {
	background: rgba(255, 121, 198, 0.1);
	border-color: rgba(255, 121, 198, 0.7);
	color: #ffffff;
	box-shadow: 0 6px 22px -10px rgba(255, 121, 198, 0.6);
}
.pm-chip.active:hover {
	transform: translateY(-1px);
}
.pm-logo {
	display: inline-flex;
	width: 20px;
	height: 20px;
}
.pm-logo svg {
	width: 100%;
	height: 100%;
	display: block;
}
.pm-name {
	letter-spacing: 0.2px;
}

.install-terminal {
	display: flex;
	align-items: center;
	gap: 0.5ch;
	flex-wrap: wrap;
	padding: 16px 20px;
	background: #0e0e14;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 10px;
	font: 500 14.5px/1.45 "IBM Plex Mono", "Fira Mono", monospace;
}
.install-terminal .prompt {
	color: #6272a4;
	font-weight: 700;
	user-select: none;
}
.install-terminal .cmd {
	color: #f8f8f2;
	font-weight: 600;
}
.install-terminal .source {
	color: #f1fa8c;
	font-weight: 600;
	white-space: pre;
}
.install-terminal .caret {
	display: inline-block;
	width: 8px;
	height: 1.05em;
	margin-left: 1px;
	background: #ff79c6;
	vertical-align: -3px;
	animation: caret-blink 1s steps(1) infinite;
}
@keyframes caret-blink {
	0%,
	50% {
		opacity: 1;
	}
	51%,
	100% {
		opacity: 0;
	}
}

.install-caption {
	margin: 14px 0 0;
	padding-left: 22px;
	color: #6272a4;
	font: 500 12.5px/1.4 "IBM Plex Mono", "Fira Mono", monospace;
	letter-spacing: 0.2px;
}
.caption-mark {
	color: #ff79c6;
	margin-right: 8px;
	font-weight: 700;
}

.fade-label-enter-active,
.fade-label-leave-active {
	transition:
		opacity 240ms ease,
		transform 240ms ease;
}
.fade-label-enter-from {
	opacity: 0;
	transform: translateY(-3px);
}
.fade-label-leave-to {
	opacity: 0;
	transform: translateY(3px);
}

/* On touch devices the typed source string (up to 52 chars on a
 * single line) wraps as the install animation grows the string
 * character by character, popping the page on every reflow. Hide
 * the card on any device without a hover-capable pointer — phones,
 * tablets, and touch laptops alike — so the page stays stable. */
@media (hover: none) and (pointer: coarse) {
	.install-wrap {
		display: none;
	}
}
</style>
