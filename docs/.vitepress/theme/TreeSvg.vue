<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = withDefaults(defineProps<{ src: string; height?: number }>(), {
	height: 480,
});

const figure = ref<HTMLElement | null>(null);
const viewport = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);

const MIN = 0.15;
const MAX = 6;

let scale = 1;
let tx = 0;
let ty = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;
let svgEl: SVGSVGElement | null = null;
let resizeObserver: ResizeObserver | null = null;

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function apply() {
	if (!svgEl) return;
	svgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

function fit() {
	if (!viewport.value || !svgEl) return;
	const cw = viewport.value.clientWidth;
	const ch = viewport.value.clientHeight;
	const sw = svgEl.viewBox.baseVal.width;
	const sh = svgEl.viewBox.baseVal.height;
	if (sw <= 0 || sh <= 0) return;
	const padding = 24;
	scale = Math.min((cw - padding * 2) / sw, (ch - padding * 2) / sh, 1);
	tx = (cw - sw * scale) / 2;
	ty = (ch - sh * scale) / 2;
	apply();
}

function onPointerDown(e: PointerEvent) {
	if (e.button !== 0 || !viewport.value) return;
	dragging = true;
	lastX = e.clientX;
	lastY = e.clientY;
	viewport.value.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
	if (!dragging) return;
	tx += e.clientX - lastX;
	ty += e.clientY - lastY;
	lastX = e.clientX;
	lastY = e.clientY;
	apply();
}

function onPointerUp(e: PointerEvent) {
	if (!dragging || !viewport.value) return;
	dragging = false;
	viewport.value.releasePointerCapture(e.pointerId);
}

function zoom(factor: number) {
	if (!viewport.value) return;
	const rect = viewport.value.getBoundingClientRect();
	const cx = rect.width / 2;
	const cy = rect.height / 2;
	const next = clamp(scale * factor, MIN, MAX);
	tx = cx - (cx - tx) * (next / scale);
	ty = cy - (cy - ty) * (next / scale);
	scale = next;
	apply();
}

// Wheel only zooms in fullscreen — at inline size it would hijack the page
// scroll. Outside fullscreen we let the wheel event pass straight through.
function onWheel(e: WheelEvent) {
	if (!isFullscreen.value || !viewport.value) return;
	e.preventDefault();
	const rect = viewport.value.getBoundingClientRect();
	const cx = e.clientX - rect.left;
	const cy = e.clientY - rect.top;
	const factor = Math.exp(-e.deltaY * 0.0015);
	const next = clamp(scale * factor, MIN, MAX);
	tx = cx - (cx - tx) * (next / scale);
	ty = cy - (cy - ty) * (next / scale);
	scale = next;
	apply();
}

function toggleFullscreen() {
	if (!figure.value) return;
	if (document.fullscreenElement) {
		document.exitFullscreen?.();
	} else {
		figure.value.requestFullscreen?.();
	}
}

function onFullscreenChange() {
	isFullscreen.value = document.fullscreenElement === figure.value;
	// Re-centre after the container resizes.
	requestAnimationFrame(() => fit());
}

const hint = computed(() =>
	isFullscreen.value
		? "drag to pan · scroll to zoom · esc to exit"
		: "drag to pan · use buttons to zoom",
);

onMounted(async () => {
	if (!viewport.value) return;
	const res = await fetch(props.src);
	if (!res.ok) return;
	viewport.value.innerHTML = await res.text();
	const found = viewport.value.querySelector("svg");
	if (!found) return;
	svgEl = found as SVGSVGElement;
	const w = svgEl.viewBox.baseVal.width;
	const h = svgEl.viewBox.baseVal.height;
	// Strip the intrinsic size so the SVG sits at viewBox coords; pan/zoom
	// drives layout via CSS transform instead.
	svgEl.removeAttribute("width");
	svgEl.removeAttribute("height");
	svgEl.style.position = "absolute";
	svgEl.style.left = "0";
	svgEl.style.top = "0";
	svgEl.style.width = `${w}px`;
	svgEl.style.height = `${h}px`;
	svgEl.style.transformOrigin = "0 0";
	svgEl.style.willChange = "transform";
	svgEl.style.userSelect = "none";
	fit();
	resizeObserver = new ResizeObserver(() => fit());
	resizeObserver.observe(viewport.value);
	document.addEventListener("fullscreenchange", onFullscreenChange);
});

onUnmounted(() => {
	resizeObserver?.disconnect();
	resizeObserver = null;
	document.removeEventListener("fullscreenchange", onFullscreenChange);
});
</script>

<template>
	<figure ref="figure" class="tree-svg" :class="{ 'is-fullscreen': isFullscreen }">
		<div
			ref="viewport"
			class="viewport"
			@pointerdown="onPointerDown"
			@pointermove="onPointerMove"
			@pointerup="onPointerUp"
			@pointercancel="onPointerUp"
			@wheel="onWheel"
			:style="isFullscreen ? undefined : { height: `${height}px` }"
		></div>
		<div class="tree-svg-controls">
			<button type="button" aria-label="Zoom in" @click="zoom(1.25)">+</button>
			<button type="button" aria-label="Zoom out" @click="zoom(0.8)">−</button>
			<button type="button" class="reset" aria-label="Reset view" @click="fit">
				Reset
			</button>
			<button
				type="button"
				class="icon"
				:aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
				@click="toggleFullscreen"
			>
				<svg
					v-if="!isFullscreen"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
				</svg>
				<svg
					v-else
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M9 3v6H3M21 9h-6V3M9 21v-6H3M15 21v-6h6" />
				</svg>
			</button>
		</div>
		<div class="hint">{{ hint }}</div>
	</figure>
</template>

<style scoped>
.tree-svg {
	position: relative;
	margin: 1.5rem 0;
	border-radius: 12px;
	overflow: hidden;
	border: 1px solid rgba(98, 114, 164, 0.32);
	background: #1b1b1f;
}
.viewport {
	position: relative;
	width: 100%;
	cursor: grab;
	touch-action: none;
	overflow: hidden;
}
.viewport:active {
	cursor: grabbing;
}
.tree-svg-controls {
	position: absolute;
	top: 12px;
	right: 12px;
	display: flex;
	gap: 6px;
	z-index: 2;
}
.tree-svg-controls button {
	min-width: 32px;
	height: 32px;
	padding: 0 10px;
	font: 600 13px / 1 var(--vp-font-family-base, system-ui, sans-serif);
	letter-spacing: 0.4px;
	color: #f8f8f2;
	background: rgba(40, 42, 54, 0.88);
	border: 1px solid rgba(98, 114, 164, 0.45);
	border-radius: 8px;
	cursor: pointer;
	backdrop-filter: blur(6px);
	transition:
		background 120ms ease,
		border-color 120ms ease,
		color 120ms ease;
}
.tree-svg-controls button:hover {
	background: rgba(68, 71, 90, 0.95);
	border-color: rgba(255, 121, 198, 0.6);
	color: #ff79c6;
}
.tree-svg-controls button.reset {
	font-size: 11px;
	text-transform: uppercase;
}
.tree-svg-controls button.icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0;
}
.hint {
	position: absolute;
	bottom: 10px;
	left: 14px;
	font: 600 10px / 1 var(--vp-font-family-base, system-ui, sans-serif);
	letter-spacing: 1.2px;
	text-transform: uppercase;
	color: #6272a4;
	pointer-events: none;
	user-select: none;
}

/* Browser-native fullscreen — the figure becomes the entire viewport. */
.tree-svg:fullscreen {
	margin: 0;
	border: none;
	border-radius: 0;
}
.tree-svg:fullscreen .viewport {
	height: 100vh !important;
	width: 100vw;
}
</style>
