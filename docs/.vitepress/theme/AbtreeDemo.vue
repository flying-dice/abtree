<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

interface YamlLine {
  text: string
  cls: string
  node?: string
}

interface CliLine {
  text: string
  kind: 'cmd' | 'resp' | 'blank'
}

interface Frame {
  node: string | null
  lines: CliLine[]
}

const yaml: YamlLine[] = [
  { text: 'tree:', cls: 'yk' },
  { text: '  type: sequence', cls: 'yp' },
  { text: '  name: Deploy_Service', cls: 'yp' },
  { text: '  children:', cls: 'yk' },
  { text: '    - type: action', cls: 'yp', node: 'A' },
  { text: '      name: Run_Tests', cls: 'yn', node: 'A' },
  { text: '      steps:', cls: 'yk', node: 'A' },
  { text: '        - evaluate: $LOCAL.ready is set', cls: 'ye', node: 'A' },
  { text: '        - instruct: Run the test suite.', cls: 'yi', node: 'A' },
  { text: '    - type: action', cls: 'yp', node: 'B' },
  { text: '      name: Build_Image', cls: 'yn', node: 'B' },
  { text: '      steps:', cls: 'yk', node: 'B' },
  { text: '        - evaluate: $LOCAL.tests_passed', cls: 'ye', node: 'B' },
  { text: '        - instruct: Build the Docker image.', cls: 'yi', node: 'B' },
]

const frames: Frame[] = [
  {
    node: null,
    lines: [
      { text: '$ abtree execution create deploy "ship v2"', kind: 'cmd' },
      { text: '{"id":"v2__deploy__1","status":"pending"}', kind: 'resp' },
      { text: '', kind: 'blank' },
    ],
  },
  {
    node: 'A',
    lines: [
      { text: '$ abtree next v2__deploy__1', kind: 'cmd' },
      { text: '{"type":"evaluate","name":"Run_Tests","expression":"$LOCAL.ready is set"}', kind: 'resp' },
      { text: '', kind: 'blank' },
    ],
  },
  {
    node: 'A',
    lines: [
      { text: '$ abtree eval v2__deploy__1 true', kind: 'cmd' },
      { text: '{"status":"ok"}', kind: 'resp' },
      { text: '', kind: 'blank' },
    ],
  },
  {
    node: 'A',
    lines: [
      { text: '$ abtree next v2__deploy__1', kind: 'cmd' },
      { text: '{"type":"instruct","name":"Run_Tests","instruction":"Run the test suite."}', kind: 'resp' },
      { text: '', kind: 'blank' },
    ],
  },
  {
    node: 'A',
    lines: [
      { text: '$ abtree submit v2__deploy__1 success', kind: 'cmd' },
      { text: '{"status":"ok"}', kind: 'resp' },
      { text: '', kind: 'blank' },
    ],
  },
  {
    node: 'B',
    lines: [
      { text: '$ abtree next v2__deploy__1', kind: 'cmd' },
      { text: '{"type":"evaluate","name":"Build_Image","expression":"$LOCAL.tests_passed"}', kind: 'resp' },
      { text: '', kind: 'blank' },
    ],
  },
  {
    node: 'B',
    lines: [
      { text: '$ abtree eval v2__deploy__1 true', kind: 'cmd' },
      { text: '{"status":"ok"}', kind: 'resp' },
      { text: '', kind: 'blank' },
    ],
  },
  {
    node: 'B',
    lines: [
      { text: '$ abtree next v2__deploy__1', kind: 'cmd' },
      { text: '{"type":"instruct","name":"Build_Image","instruction":"Build the Docker image."}', kind: 'resp' },
      { text: '', kind: 'blank' },
    ],
  },
  {
    node: 'B',
    lines: [
      { text: '$ abtree submit v2__deploy__1 success', kind: 'cmd' },
      { text: '{"status":"done"}', kind: 'resp' },
    ],
  },
]

const yamlCount   = ref(0)
const activeNode  = ref<string | null>(null)
const cliLines    = ref<CliLine[]>([])
const showCursor  = ref(true)
const terminalEl  = ref<HTMLElement | null>(null)
const yamlEl      = ref<HTMLElement | null>(null)

let timers: ReturnType<typeof setTimeout>[] = []

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}

function scrollBottom() {
  nextTick(() => {
    terminalEl.value?.scrollTo({ top: terminalEl.value.scrollHeight, behavior: 'smooth' })
  })
}

function scrollYamlToActive() {
  nextTick(() => {
    const first = yamlEl.value?.querySelector<HTMLElement>('.ad-hi')
    first?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

watch(activeNode, scrollYamlToActive)

function run() {
  timers.forEach(clearTimeout)
  timers = []
  yamlCount.value  = 0
  activeNode.value = null
  cliLines.value   = []
  showCursor.value = true

  // Phase 1 — type out YAML lines
  const lineMs = 200
  yaml.forEach((_, i) => {
    later(() => { yamlCount.value = i + 1 }, 400 + i * lineMs)
  })

  // Phase 2 — CLI exchange begins after YAML finishes
  const cliStart = 400 + yaml.length * lineMs + 600
  let t = cliStart

  frames.forEach((frame) => {
    later(() => { activeNode.value = frame.node }, t)
    frame.lines.forEach((line, li) => {
      later(() => {
        cliLines.value = [...cliLines.value, line]
        scrollBottom()
      }, t + li * 320)
    })
    t += frame.lines.length * 320 + 680
  })

  // Done — pause then restart
  later(() => {
    showCursor.value = false
    later(run, 2200)
  }, t + 400)
}

onMounted(run)
onUnmounted(() => timers.forEach(clearTimeout))
</script>

<template>
  <div class="ad-wrap">
    <div class="ad-label">
      <span>define a tree</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      <span>agent drives the execution</span>
    </div>

    <div class="ad-grid">
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
            :class="{
              'ad-vis': i < yamlCount,
              'ad-hid': i >= yamlCount,
              'ad-hi':  line.node === activeNode && activeNode !== null,
            }"
          >
            <span :class="line.cls">{{ line.text }}</span>
          </div>
          <span v-if="showCursor && yamlCount < yaml.length" class="ad-caret"/>
        </div>
      </div>

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
              'ad-blank': line.kind === 'blank',
            }"
          >{{ line.text }}</div>
          <span v-if="showCursor && cliLines.length > 0" class="ad-caret ad-caret-t"/>
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.ad-label svg {
  color: var(--vp-c-brand-1);
}

.ad-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  font-family: 'IBM Plex Mono', 'Fira Mono', monospace;
  font-size: 12px;
  line-height: 1.65;
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
  overflow-y: auto;
  scroll-behavior: smooth;
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
  border-radius: 3px;
  border-left: 2px solid transparent;
  transition: background 0.35s ease, border-color 0.35s ease;
}

.ad-blank { min-height: 0.7em; }

.ad-hid { opacity: 0; }

.ad-vis {
  opacity: 1;
  animation: adIn 0.18s ease both;
}

.ad-hi {
  background: rgba(189, 52, 254, 0.11);
  border-left-color: #d62786;
}

.dark .ad-hi {
  background: rgba(255, 121, 198, 0.1);
  border-left-color: #ff79c6;
}

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
.ad-cmd  { color: #f8f8f2; }
.ad-resp { color: rgba(248, 248, 242, 0.42); }

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
