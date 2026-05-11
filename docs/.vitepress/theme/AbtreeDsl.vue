<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

// ─── install demo ────────────────────────────────────────────────────────
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
// scope, a private scope, a GitHub ref, a git+ssh URL to a private host, a
// raw tarball URL on a company-internal CDN.
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

// ─── tiles ───────────────────────────────────────────────────────────────
interface Tile {
	num: string;
	title: string;
	file: string;
	code: string;
}

const tiles: Tile[] = [
	{
		num: "01",
		title: "Compose",
		file: "tree.ts",
		code: `import {
  sequence, selector, action,
  evaluate, instruct,
} from "@abtree/dsl";

// Trees are plain nested function calls.
const tree = sequence("Greeting", () => {
  // Action: evaluate (precondition) + instruct.
  action("Detect_Time", () => {
    instruct(\`Detect the time of day.\`);
  });

  // sequence / selector / parallel — three composites.
  selector("Choose_Greeting", () => {
    action("Morning", () => {
      evaluate(\`time is morning\`);
      instruct(\`Say "Good morning".\`);
    });
    action("Default", () => {
      instruct(\`Say "Hello".\`);
    });
  });
});`,
	},
	{
		num: "02",
		title: "State",
		file: "state.ts",
		code: `// local<T>() — declares a $LOCAL slot, returns a reference to it.
const timeOfDay = local<string | null>("time_of_day", null);
//    ^ "$LOCAL.time_of_day"  : LocalRef<string | null>

const greeting  = local<string | null>("greeting", null);
//    ^ "$LOCAL.greeting"

// global<T>() — declares a $GLOBAL value, returns a reference.
// The default is the instruction the agent resolves at runtime.
const user = global<string>("current_user", 'obtain via "whoami"');
//    ^ "$GLOBAL.current_user"  : GlobalRef<string>

action("Morning", () => {
  // Refs interpolate as their path strings, never as the value.
  evaluate(\`\${timeOfDay} equals morning\`);
  //  → "$LOCAL.time_of_day equals morning"
  instruct(\`Write "Good morning, \${user}" to \${greeting}.\`);
});`,
	},
	{
		num: "03",
		title: "Type safe",
		file: "type-safe.ts",
		code: `import { type LocalRef, type GlobalRef } from "@abtree/dsl";

// Factory: declares the slot types this tree needs.
function greet(refs: {
  user: GlobalRef<string>;
  out:  LocalRef<string | null>;
}) {
  return action("Greet", () => {
    instruct(\`Write "Hello, \${refs.user}" to \${refs.out}.\`);
  });
}

// Caller wires its own state in:
const user  = global<string>("current_user", 'obtain via "whoami"');
const count = local<number>("count", 0);

greet({ user, out: count });
//                    ^^^^^
//   ❌ LocalRef<number> not assignable
//      to LocalRef<string | null>`,
	},
	{
		num: "04",
		title: "Reuse",
		file: "import.ts",
		code: `// Pull a published tree from npm — its factory ships its slot types.
import { greet } from "@me/greeting-tree";
import {
  sequence, action, instruct,
  local, global,
} from "@abtree/dsl";

const user  = global<string>("current_user", 'obtain via "whoami"');
const intro = local<string | null>("intro", null);
const brief = local<string | null>("brief", null);

// Open every daily brief with the published greeter.
sequence("Daily_Brief", () => {
  greet({ user, out: intro });

  action("Compose_Brief", () => {
    instruct(\`Draft today's brief for \${user}. Store at \${brief}.\`);
  });

  action("Send", () => {
    instruct(\`Send "\${intro} \\n\\n \${brief}" to \${user}.\`);
  });
});`,
	},
];

const TS_KEYWORDS = new Set([
	"import",
	"from",
	"const",
	"let",
	"export",
	"default",
	"return",
	"null",
	"true",
	"false",
	"as",
	"type",
	"function",
]);
const TS_FNS = new Set([
	"sequence",
	"selector",
	"parallel",
	"action",
	"evaluate",
	"instruct",
	"local",
	"global",
	"writeLocal",
	"writeGlobal",
]);

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function highlight(src: string): string {
	return src
		.split("\n")
		.map((line) => highlightLine(line) || "&nbsp;")
		.join("\n");
}

function highlightLine(line: string): string {
	let head = line;
	let tail = "";
	const cmt = line.indexOf("//");
	if (cmt !== -1 && !isInsideString(line, cmt)) {
		head = line.slice(0, cmt);
		tail = `<span class="t-com">${esc(line.slice(cmt))}</span>`;
	}
	let out = "";
	let i = 0;
	while (i < head.length) {
		const c = head[i];
		if (c === '"' || c === "'" || c === "`") {
			const open = c;
			let j = i + 1;
			while (j < head.length && head[j] !== open) {
				if (head[j] === "\\") j++;
				j++;
			}
			const lit = head.slice(i, j + 1);
			out +=
				open === "`"
					? interpolate(lit)
					: `<span class="t-str">${esc(lit)}</span>`;
			i = j + 1;
		} else if (/[a-zA-Z_$]/.test(c)) {
			let j = i;
			while (j < head.length && /[\w$]/.test(head[j])) j++;
			const word = head.slice(i, j);
			if (TS_KEYWORDS.has(word)) {
				out += `<span class="t-kw">${esc(word)}</span>`;
			} else if (TS_FNS.has(word)) {
				out += `<span class="t-fn">${esc(word)}</span>`;
			} else {
				out += esc(word);
			}
			i = j;
		} else if (/\d/.test(c)) {
			let j = i;
			while (j < head.length && /[\d.]/.test(head[j])) j++;
			out += `<span class="t-num">${esc(head.slice(i, j))}</span>`;
			i = j;
		} else {
			out += esc(c);
			i++;
		}
	}
	return out + tail;
}

function isInsideString(line: string, idx: number): boolean {
	let inStr = false;
	let quote = "";
	for (let i = 0; i < idx; i++) {
		const c = line[i];
		if (c === "\\") {
			i++;
			continue;
		}
		if (inStr) {
			if (c === quote) inStr = false;
		} else if (c === '"' || c === "'" || c === "`") {
			inStr = true;
			quote = c;
		}
	}
	return inStr;
}

function interpolate(literal: string): string {
	let out = '<span class="t-str">';
	let i = 0;
	while (i < literal.length) {
		if (literal[i] === "$" && literal[i + 1] === "{") {
			out += '</span><span class="t-interp">${';
			i += 2;
			let depth = 1;
			let start = i;
			while (i < literal.length && depth > 0) {
				if (literal[i] === "{") depth++;
				else if (literal[i] === "}") depth--;
				if (depth > 0) i++;
			}
			out += esc(literal.slice(start, i)) + "}</span>";
			i++;
			out += '<span class="t-str">';
		} else {
			out += esc(literal[i]);
			i++;
		}
	}
	out += "</span>";
	return out;
}

const renderedTiles = computed(() =>
	tiles.map((t) => ({ ...t, html: highlight(t.code) })),
);
</script>

<template>
	<section class="dsl-wrap">
		<div class="dsl-label">
			<span class="dsl-eyebrow">Authoring</span>
			<span>TypeScript DSL → behaviour tree → npm</span>
		</div>

		<div class="dsl-grid">
			<article
				v-for="tile in renderedTiles"
				:key="tile.num"
				class="dsl-tile"
			>
				<header class="tile-head">
					<span class="dot r" />
					<span class="dot y" />
					<span class="dot g" />
					<span class="tile-file">{{ tile.file }}</span>
					<span class="tile-tag">
						<span class="tag-num">{{ tile.num }}</span>
						<span class="tag-title">{{ tile.title }}</span>
					</span>
				</header>
				<pre class="tile-code" v-html="tile.html" />
			</article>
		</div>

		<aside class="install-card">
			<div class="install-eyebrow">No registry required</div>
			<h3 class="install-headline">Ship trees like any other library.</h3>

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
	</section>
</template>

<style scoped>
.dsl-wrap {
	margin: 2.5rem 0 3rem;
	font-family: "Inter", system-ui, sans-serif;
}

.dsl-label {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.7rem;
	font-size: 1.05rem;
	color: var(--vp-c-text-2);
	margin-bottom: 1.5rem;
}
.dsl-eyebrow {
	padding: 3px 10px;
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 1.4px;
	text-transform: uppercase;
	color: #ff79c6;
	background: rgba(255, 121, 198, 0.12);
	border: 1px solid rgba(255, 121, 198, 0.3);
	border-radius: 999px;
}

.dsl-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 1rem;
}
@media (max-width: 820px) {
	.dsl-grid {
		grid-template-columns: 1fr;
	}
}

.dsl-tile {
	background: #12121c;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 12px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.tile-head {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 10px 14px;
	background: rgba(255, 255, 255, 0.04);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.dot {
	width: 11px;
	height: 11px;
	border-radius: 50%;
}
.dot.r {
	background: #ff5f57;
}
.dot.y {
	background: #febc2e;
}
.dot.g {
	background: #28c840;
}
.tile-file {
	margin-left: 8px;
	color: rgba(255, 255, 255, 0.45);
	font: 500 11px/1 "IBM Plex Mono", monospace;
}
.tile-tag {
	margin-left: auto;
	display: inline-flex;
	align-items: baseline;
	gap: 6px;
	font: 700 10px/1 "IBM Plex Mono", monospace;
	letter-spacing: 1.4px;
}
.tag-num {
	color: rgba(255, 255, 255, 0.32);
}
.tag-title {
	color: #ff79c6;
	text-transform: uppercase;
}

.tile-code {
	margin: 0;
	padding: 18px 20px 22px;
	font-family: "IBM Plex Mono", "Fira Mono", monospace;
	font-size: 12.5px;
	line-height: 1.7;
	color: #f8f8f2;
	white-space: pre-wrap;
	word-break: normal;
	flex: 1;
}

/* ---- install demo (hero card) ---- */
.install-card {
	position: relative;
	margin: 2rem 0 0;
	padding: 36px 40px 32px;
	background:
		radial-gradient(
			at 0% 0%,
			rgba(255, 121, 198, 0.08),
			transparent 55%
		),
		radial-gradient(
			at 100% 100%,
			rgba(189, 147, 249, 0.08),
			transparent 55%
		),
		linear-gradient(180deg, #1b1b22 0%, #131318 100%);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 16px;
	overflow: hidden;
}

.install-eyebrow {
	font: 700 10px/1 "IBM Plex Mono", monospace;
	letter-spacing: 2.4px;
	text-transform: uppercase;
	color: #ff79c6;
	margin-bottom: 10px;
}

.install-headline {
	margin: 0 0 24px;
	font-size: 26px;
	font-weight: 700;
	letter-spacing: -0.5px;
	color: #f8f8f2;
	line-height: 1.15;
}

.install-pms {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin-bottom: 20px;
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
	padding: 18px 22px;
	background: #0e0e14;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 10px;
	font: 500 15px/1.45 "IBM Plex Mono", "Fira Mono", monospace;
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

@media (max-width: 820px) {
	.install-card {
		padding: 26px 22px 24px;
	}
	.install-headline {
		font-size: 22px;
	}
	.install-terminal {
		font-size: 13px;
		padding: 14px 16px;
	}
}

/* Dracula tokens — comments deliberately a touch brighter than canonical
 * slate-comment because they are the educational content of each tile. */
:deep(.t-kw) {
	color: #ff79c6;
}
:deep(.t-fn) {
	color: #50fa7b;
}
:deep(.t-str) {
	color: #f1fa8c;
}
:deep(.t-interp) {
	color: #ffb86c;
}
:deep(.t-num) {
	color: #bd93f9;
}
:deep(.t-com) {
	color: #8a96be;
	font-style: italic;
}
</style>
