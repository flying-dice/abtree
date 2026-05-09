<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";

interface YamlLine {
	text: string;
	cls: string;
	node?: string;
	isName?: boolean;
	step?: "evaluate" | "instruct";
}

interface CliLine {
	text: string;
	kind: "cmd" | "resp" | "think" | "blank";
}

type NodeStatus = "pending" | "success" | "fail";
type StepKey = string;

interface Frame {
	node: string | null;
	pendingStep?: StepKey;
	completesStep?: StepKey;
	completesStepAs?: NodeStatus;
	completes?: string;
	completesAs?: NodeStatus;
	lines: CliLine[];
}

const yaml: YamlLine[] = [
	{ text: "name: deploy", cls: "yp" },
	{ text: "version: 1.0.0", cls: "yp" },
	{ text: "tree:", cls: "yk" },
	{ text: "  type: sequence", cls: "yp" },
	{ text: "  name: Deploy_Service", cls: "yp" },
	{ text: "  children:", cls: "yk" },
	{ text: "    - type: action", cls: "yp", node: "A" },
	{ text: "      name: Run_Tests", cls: "yn", node: "A", isName: true },
	{ text: "      steps:", cls: "yk", node: "A" },
	{ text: "        - instruct: |", cls: "yi", node: "A", step: "instruct" },
	{ text: "            Run tests.", cls: "yi", node: "A" },
	{
		text: "            Store pass/fail at $LOCAL.tests_passed.",
		cls: "yi",
		node: "A",
	},
	{
		text: "            Store coverage percentage at $LOCAL.coverage.",
		cls: "yi",
		node: "A",
	},
	{ text: "        - evaluate: |", cls: "ye", node: "A", step: "evaluate" },
	{ text: "            $LOCAL.tests_passed is true.", cls: "ye", node: "A" },
	{
		text: "            $LOCAL.coverage is greater than $GLOBAL.threshold.",
		cls: "ye",
		node: "A",
	},
	{ text: "    - type: action", cls: "yp", node: "B" },
	{ text: "      name: Build_And_Push", cls: "yn", node: "B", isName: true },
	{ text: "      steps:", cls: "yk", node: "B" },
	{ text: "        - instruct: |", cls: "yi", node: "B", step: "instruct" },
	{
		text: "            Build and push image to $GLOBAL.registry.",
		cls: "yi",
		node: "B",
	},
	{
		text: "            Store the pushed tag at $LOCAL.image_tag.",
		cls: "yi",
		node: "B",
	},
	{ text: "state:", cls: "yk" },
	{ text: "  local:", cls: "yk" },
	{ text: "    tests_passed: null", cls: "yp" },
	{ text: "    coverage: null", cls: "yp" },
	{ text: "    image_tag: null", cls: "yp" },
	{ text: "  global:", cls: "yk" },
	{ text: "    threshold: 80", cls: "yp" },
	{ text: "    registry: ghcr.io/my-app", cls: "yp" },
];

const frames: Frame[] = [
	// Create the execution
	{
		node: null,
		lines: [
			{ text: '$ abtree execution create deploy "ship v2"', kind: "cmd" },
			{ text: '{"id":"v2__deploy__1","tree":"deploy"}', kind: "resp" },
			{ text: "", kind: "blank" },
		],
	},
	// A — Run_Tests: instruct returned
	{
		node: "A",
		pendingStep: "instruct",
		lines: [
			{ text: "$ abtree next v2__deploy__1", kind: "cmd" },
			{
				text: '{"type":"instruct","name":"Run_Tests","instruction":"Run tests.\\nStore pass/fail at $LOCAL.tests_passed.\\nStore coverage percentage at $LOCAL.coverage."}',
				kind: "resp",
			},
			{ text: "", kind: "blank" },
		],
	},
	// A — do the work, write results, submit (more steps remain → step_complete)
	{
		node: "A",
		completesStep: "instruct",
		completesStepAs: "success",
		lines: [
			{
				text: "▸ run test suite → store at $LOCAL.tests_passed and $LOCAL.coverage",
				kind: "think",
			},
			{ text: "$ bun test --coverage", kind: "cmd" },
			{ text: "All tests passed. Coverage: 87%", kind: "resp" },
			{ text: "", kind: "blank" },
			{ text: "▸ writing results to $LOCAL", kind: "think" },
			{
				text: "$ abtree local write v2__deploy__1 tests_passed true",
				kind: "cmd",
			},
			{ text: "$ abtree local write v2__deploy__1 coverage 87", kind: "cmd" },
			{ text: "$ abtree submit v2__deploy__1 success", kind: "cmd" },
			{ text: '{"status":"step_complete"}', kind: "resp" },
			{ text: "", kind: "blank" },
		],
	},
	// A — gate evaluate returned
	{
		node: "A",
		pendingStep: "evaluate",
		lines: [
			{ text: "$ abtree next v2__deploy__1", kind: "cmd" },
			{
				text: '{"type":"evaluate","name":"Run_Tests","expression":"$LOCAL.tests_passed is true.\\n$LOCAL.coverage is greater than $GLOBAL.threshold."}',
				kind: "resp",
			},
			{ text: "", kind: "blank" },
		],
	},
	// A — read all three refs, eval combined expression, completes A
	{
		node: "A",
		completesStep: "evaluate",
		completesStepAs: "success",
		completes: "A",
		completesAs: "success",
		lines: [
			{
				text: "▸ refs: $LOCAL.tests_passed, $LOCAL.coverage, $GLOBAL.threshold",
				kind: "think",
			},
			{ text: "$ abtree local read v2__deploy__1 tests_passed", kind: "cmd" },
			{ text: '{"path":"tests_passed","value":true}', kind: "resp" },
			{ text: "$ abtree local read v2__deploy__1 coverage", kind: "cmd" },
			{ text: '{"path":"coverage","value":87}', kind: "resp" },
			{ text: "$ abtree global read v2__deploy__1 threshold", kind: "cmd" },
			{ text: '{"path":"threshold","value":80}', kind: "resp" },
			{ text: "", kind: "blank" },
			{ text: "▸ true and 87 > 80 → pass", kind: "think" },
			{ text: "$ abtree eval v2__deploy__1 true", kind: "cmd" },
			{ text: '{"status":"evaluation_passed"}', kind: "resp" },
			{ text: "", kind: "blank" },
		],
	},
	// B — Build_And_Push: instruct returned
	{
		node: "B",
		pendingStep: "instruct",
		lines: [
			{ text: "$ abtree next v2__deploy__1", kind: "cmd" },
			{
				text: '{"type":"instruct","name":"Build_And_Push","instruction":"Build and push image to $GLOBAL.registry.\\nStore the pushed tag at $LOCAL.image_tag."}',
				kind: "resp",
			},
			{ text: "", kind: "blank" },
		],
	},
	// B — read registry, build, write image_tag, submit, then next → done
	{
		node: "B",
		completesStep: "instruct",
		completesStepAs: "success",
		completes: "B",
		completesAs: "success",
		lines: [
			{ text: "▸ resolve $GLOBAL.registry before tagging", kind: "think" },
			{ text: "$ abtree global read v2__deploy__1 registry", kind: "cmd" },
			{ text: '{"path":"registry","value":"ghcr.io/my-app"}', kind: "resp" },
			{ text: "", kind: "blank" },
			{
				text: "▸ tag with current git SHA → ghcr.io/my-app:abc1234",
				kind: "think",
			},
			{ text: "$ docker build -t ghcr.io/my-app:abc1234 .", kind: "cmd" },
			{ text: "Pushed ghcr.io/my-app:abc1234", kind: "resp" },
			{ text: "", kind: "blank" },
			{
				text: "$ abtree local write v2__deploy__1 image_tag ghcr.io/my-app:abc1234",
				kind: "cmd",
			},
			{ text: "$ abtree submit v2__deploy__1 success", kind: "cmd" },
			{ text: '{"status":"action_complete"}', kind: "resp" },
			{ text: "", kind: "blank" },
			{ text: "$ abtree next v2__deploy__1", kind: "cmd" },
			{ text: '{"status":"done"}', kind: "resp" },
		],
	},
];

function prettifyJsonLines(lines: CliLine[]): CliLine[] {
	const out: CliLine[] = [];
	for (const line of lines) {
		if (line.kind === "resp" && /^[{[]/.test(line.text)) {
			try {
				const parsed = JSON.parse(line.text);
				for (const ln of JSON.stringify(parsed, null, 2).split("\n")) {
					out.push({ text: ln, kind: "resp" });
				}
				continue;
			} catch {
				/* fall through */
			}
		}
		out.push(line);
	}
	return out;
}

for (const frame of frames) {
	frame.lines = prettifyJsonLines(
		frame.lines.filter((l) => l.kind !== "blank"),
	);
}

const yamlCount = ref(0);
const activeNode = ref<string | null>(null);
const nodeStatuses = ref<Record<string, NodeStatus>>({});
const stepStatuses = ref<Record<string, Partial<Record<StepKey, NodeStatus>>>>(
	{},
);
const cliLines = ref<CliLine[]>([]);
const showCursor = ref(true);
const expanded = ref(false);
const terminalEl = ref<HTMLElement | null>(null);
const yamlEl = ref<HTMLElement | null>(null);

let timers: ReturnType<typeof setTimeout>[] = [];

function later(fn: () => void, ms: number) {
	timers.push(setTimeout(fn, ms));
}

function scrollBottom() {
	nextTick(() => {
		terminalEl.value?.scrollTo({
			top: terminalEl.value.scrollHeight,
			behavior: "smooth",
		});
	});
}

function lineIndent(text: string): string {
	return text.match(/^(\s*)/)?.[1] ?? "";
}
function lineHasMarker(text: string): boolean {
	return /^\s*- /.test(text);
}
function lineRest(text: string): string {
	return text.replace(/^\s*- /, "");
}
function markerStatusFor(line: YamlLine): NodeStatus | undefined {
	if (!line.node) return undefined;
	if (line.step) return stepStatuses.value[line.node]?.[line.step];
	return nodeStatuses.value[line.node];
}

function scrollYamlToActive() {
	nextTick(() => {
		const container = yamlEl.value;
		if (!container || !activeNode.value) return;
		const first = container.querySelector<HTMLElement>(
			`[data-node="${activeNode.value}"]`,
		);
		if (!first) return;
		const offset =
			first.getBoundingClientRect().top - container.getBoundingClientRect().top;
		container.scrollTo({
			top: container.scrollTop + offset - 8,
			behavior: "smooth",
		});
	});
}

watch(activeNode, scrollYamlToActive);

function run() {
	timers.forEach(clearTimeout);
	timers = [];
	yamlCount.value = yaml.length; // render full YAML immediately
	activeNode.value = null;
	nodeStatuses.value = {};
	stepStatuses.value = {};
	cliLines.value = [];
	showCursor.value = true;

	nextTick(() => {
		yamlEl.value?.scrollTo({ top: 0, behavior: "auto" });
		terminalEl.value?.scrollTo({ top: 0, behavior: "auto" });
	});

	// CLI exchange begins after a brief pause so the YAML is read first
	let t = 800;

	frames.forEach((frame) => {
		later(() => {
			activeNode.value = frame.node;
			// Mark node as pending the first time it appears
			if (frame.node && !nodeStatuses.value[frame.node]) {
				nodeStatuses.value = { ...nodeStatuses.value, [frame.node]: "pending" };
			}
			// Mark the step as pending
			if (frame.node && frame.pendingStep) {
				stepStatuses.value = {
					...stepStatuses.value,
					[frame.node]: {
						...(stepStatuses.value[frame.node] || {}),
						[frame.pendingStep]: "pending",
					},
				};
			}
		}, t);

		const lineDelay = (l: CliLine) => (l.kind === "resp" ? 120 : 320);
		const offsets: number[] = [];
		let elapsed = 0;
		for (const l of frame.lines) {
			offsets.push(elapsed);
			elapsed += lineDelay(l);
		}

		frame.lines.forEach((line, li) => {
			later(() => {
				cliLines.value = [...cliLines.value, line];
				scrollBottom();
			}, t + offsets[li]);
		});

		const respIdx = frame.lines.reduce(
			(last, l, i) => (l.kind === "resp" ? i : last),
			0,
		);
		const completionAt = t + offsets[respIdx] + 420;

		// After the response line appears, complete the step status
		if (frame.node && frame.completesStep && frame.completesStepAs) {
			later(() => {
				stepStatuses.value = {
					...stepStatuses.value,
					[frame.node!]: {
						...(stepStatuses.value[frame.node!] || {}),
						[frame.completesStep!]: frame.completesStepAs!,
					},
				};
			}, completionAt);
		}

		// After the response line appears, transition the node to its final status
		if (frame.completes && frame.completesAs) {
			later(() => {
				nodeStatuses.value = {
					...nodeStatuses.value,
					[frame.completes!]: frame.completesAs!,
				};
			}, completionAt);
		}

		t += elapsed + 680;
	});

	// Done — pause then restart
	later(() => {
		showCursor.value = false;
		later(run, 2200);
	}, t + 400);
}

function expand() {
	timers.forEach(clearTimeout);
	timers = [];
	expanded.value = true;
	yamlCount.value = yaml.length;
	activeNode.value = null;
	showCursor.value = false;

	const finalNodeStatuses: Record<string, NodeStatus> = {};
	const finalStepStatuses: Record<
		string,
		Partial<Record<StepKey, NodeStatus>>
	> = {};
	const allLines: CliLine[] = [];

	for (const frame of frames) {
		if (frame.node && frame.completesStep && frame.completesStepAs) {
			finalStepStatuses[frame.node] = {
				...(finalStepStatuses[frame.node] || {}),
				[frame.completesStep]: frame.completesStepAs,
			};
		}
		if (frame.completes && frame.completesAs) {
			finalNodeStatuses[frame.completes] = frame.completesAs;
		}
		allLines.push(...frame.lines);
	}

	nodeStatuses.value = finalNodeStatuses;
	stepStatuses.value = finalStepStatuses;
	cliLines.value = allLines;
}

function collapse() {
	expanded.value = false;
	run();
}

onMounted(run);
onUnmounted(() => timers.forEach(clearTimeout));
</script>

<template>
  <div class="ad-wrap" :class="{ 'ad-expanded': expanded }">
    <div class="ad-label ad-label-wide">
      <span class="ad-label-text">
        <span><em>define</em> a tree</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <span>the <em>agent</em> drives execution</span>
      </span>
      <button class="ad-toggle" @click="expanded ? collapse() : expand()">
        {{ expanded ? 'collapse' : 'expand' }}
      </button>
    </div>

    <div class="ad-grid">
      <div class="ad-col">
        <div class="ad-label ad-label-narrow"><em>define</em> a tree</div>
        <!-- YAML panel -->
        <div class="ad-panel">
        <div class="ad-bar">
          <span class="ad-dot r"/><span class="ad-dot y"/><span class="ad-dot g"/>
          <span class="ad-name">deploy.yaml</span>
        </div>
        <div ref="yamlEl" class="ad-body ad-yaml">
          <div
            v-for="(line, i) in yaml"
            :key="i"
            class="ad-line"
            :data-node="line.node"
            :class="{
              'ad-vis':     i < yamlCount,
              'ad-hid':     i >= yamlCount,
              'ad-pending': line.node && nodeStatuses[line.node] === 'pending',
              'ad-success': line.node && nodeStatuses[line.node] === 'success',
              'ad-fail':    line.node && nodeStatuses[line.node] === 'fail',
            }"
          >
            <template v-if="lineHasMarker(line.text)">
              <span>{{ lineIndent(line.text) }}</span><span
                class="ad-marker"
                :class="markerStatusFor(line) ? `ad-ndot-${markerStatusFor(line)}` : 'ad-marker-idle'"
              >
                <svg v-if="markerStatusFor(line) === 'pending'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3" fill="currentColor"/></svg>
                <svg v-else-if="markerStatusFor(line) === 'success'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.2 5.4 4.2 7.4 7.8 2.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <svg v-else-if="markerStatusFor(line) === 'fail'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.8 2.8 7.2 7.2M7.2 2.8 2.8 7.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                <span v-else>-</span></span><span :class="line.cls">{{ lineRest(line.text) }}</span>
            </template>
            <span v-else :class="line.cls">{{ line.text }}</span>
          </div>
          <span v-if="showCursor && yamlCount < yaml.length" class="ad-caret"/>
        </div>
      </div>

      </div>

      <div class="ad-col">
        <div class="ad-label ad-label-narrow">the <em>agent</em> drives execution</div>
        <!-- Terminal panel -->
        <div class="ad-panel">
        <div class="ad-bar">
          <span class="ad-dot r"/><span class="ad-dot y"/><span class="ad-dot g"/>
          <span class="ad-name">terminal</span>
        </div>
        <div ref="terminalEl" class="ad-body ad-term">
          <div
            v-for="(line, i) in cliLines"
            :key="i"
            class="ad-line"
            :class="{
              'ad-vis': true,
              'ad-cmd':   line.kind === 'cmd',
              'ad-resp':  line.kind === 'resp',
              'ad-think': line.kind === 'think',
              'ad-blank': line.kind === 'blank',
            }"
          >{{ line.text }}</div>
          <span v-if="showCursor && cliLines.length > 0" class="ad-caret ad-caret-t"/>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---------- container ---------- */
.ad-wrap {
  margin: 2.5rem 0 3rem;
}

.ad-label {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.ad-label-text {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
}

.ad-label em {
  font-style: normal;
  color: var(--vp-c-text-1);
  font-weight: 700;
}

.ad-label svg {
  color: var(--vp-c-brand-1);
  flex-shrink: 0;
}

.ad-label-wide   { margin-bottom: 1.5rem; }
.ad-label-narrow { display: none; margin-bottom: 0.6rem; font-size: 1rem; text-align: center; }

@media (max-width: 720px) {
  .ad-label-wide   { display: none; }
  .ad-label-narrow { display: block; }
}

@media (max-width: 600px) {
  .ad-label { font-size: 0.9rem; gap: 0.4rem; }
}

.ad-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  padding: 4px 10px;
  font: inherit;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.ad-toggle:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.ad-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  font-family: 'IBM Plex Mono', 'Fira Mono', monospace;
  font-size: 12px;
  line-height: 1.65;
}
.ad-col {
  min-width: 0;   /* allow grid item to shrink below its content's min-content size */
}

@media (max-width: 720px) {
  .ad-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .ad-grid { font-size: 11px; }
}

/* ---------- panel shell ---------- */
.ad-panel {
  background: #12121c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
}

/* ---------- title bar ---------- */
.ad-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ad-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ad-dot.r { background: #ff5f57; }
.ad-dot.y { background: #febc2e; }
.ad-dot.g { background: #28c840; }

.ad-name {
  margin-left: 4px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

/* ---------- body ---------- */
.ad-body {
  padding: 12px 16px 14px;
  height: 258px;
  overflow-y: hidden;       /* user-scroll off; programmatic scrollTo still works */
  scroll-behavior: smooth;
  overscroll-behavior: contain;
  pointer-events: none;     /* let wheel/touch pass through to the page */
}

.ad-expanded .ad-body {
  height: auto;
  overflow-y: visible;
}

.ad-expanded .ad-grid {
  align-items: start;
}

/* hide scrollbars on both panels */
.ad-body::-webkit-scrollbar { width: 0; }
.ad-body { scrollbar-width: none; }

/* ---------- lines ---------- */
.ad-line {
  white-space: pre;
  overflow: hidden;
  min-height: 1.65em;
  padding: 0 5px;
  margin: 0 -5px;
  border-left: 2px solid transparent;
  transition: background 0.35s ease, border-color 0.35s ease;
}

.ad-blank { min-height: 0.7em; }

.ad-hid { opacity: 0; }

.ad-vis {
  opacity: 1;
  animation: adIn 0.18s ease both;
}

/* node status colours */
.ad-pending {
  background: rgba(241, 250, 140, 0.07);
  border-left-color: #f1fa8c;
}
.ad-success {
  background: rgba(80, 250, 123, 0.07);
  border-left-color: #50fa7b;
}
.ad-fail {
  background: rgba(255, 85, 85, 0.07);
  border-left-color: #ff5555;
}

/* status icon replacing the YAML "- " array marker */
.ad-marker {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 1.2em;       /* matches "- " in 12px monospace */
  vertical-align: middle;
  transition: color 0.4s ease;
}
.ad-marker svg { display: block; }
.ad-marker-idle { color: rgba(255, 255, 255, 0.45); }
.ad-ndot-pending { color: #f1fa8c; }
.ad-ndot-success { color: #50fa7b; }
.ad-ndot-fail    { color: #ff5555; }

@keyframes adIn {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ---------- YAML syntax ---------- */
.yk { color: #ff79c6; }                       /* key         — pink  */
.yp { color: #8be9fd; }                       /* prop type   — cyan  */
.yn { color: #f8f8f2; font-weight: 600; }     /* node name   — white */
.ye { color: #bd93f9; }                       /* evaluate    — purple */
.yi { color: #50fa7b; }                       /* instruct    — green */

/* ---------- CLI ---------- */
.ad-cmd   { color: #f8f8f2; }
.ad-resp  { color: rgba(248, 248, 242, 0.42); }
.ad-think { color: rgba(189, 147, 249, 0.55); font-style: italic; }

/* ---------- cursor ---------- */
.ad-caret {
  display: inline-block;
  width: 7px;
  height: 1.1em;
  background: #ff79c6;
  vertical-align: text-bottom;
  animation: adBlink 1.1s step-end infinite;
}

.ad-caret-t {
  background: #f8f8f2;
}

@keyframes adBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>
