<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

type NodeType   = 'sequence' | 'selector' | 'parallel' | 'action'
type NodeStatus = 'pending' | 'success' | 'fail'

interface TreeNode {
  id: string
  type: NodeType
  name: string
  children?: TreeNode[]
}

interface FlatNode {
  id: string
  type: NodeType
  name: string
  prefix: string
  isRoot: boolean
}

interface AnimEvent {
  id: string
  status: NodeStatus
  delay: number
}

const simpleTree: TreeNode = {
  id: 's-root', type: 'sequence', name: 'Deploy_Service',
  children: [
    { id: 's-run',   type: 'action', name: 'Run_Tests' },
    { id: 's-build', type: 'action', name: 'Build_Image' },
    { id: 's-push',  type: 'action', name: 'Push_Image' },
  ],
}

const complexTree: TreeNode = {
  id: 'c-root', type: 'sequence', name: 'Deploy_Service',
  children: [
    {
      id: 'c-tests', type: 'sequence', name: 'Test_Suite',
      children: [
        { id: 'c-lint',  type: 'action', name: 'Lint' },
        { id: 'c-unit',  type: 'action', name: 'Unit_Tests' },
        { id: 'c-integ', type: 'action', name: 'Integration_Tests' },
      ],
    },
    {
      id: 'c-build', type: 'selector', name: 'Build_Strategy',
      children: [
        { id: 'c-cached', type: 'action', name: 'Try_Cached_Build' },
        { id: 'c-full',   type: 'action', name: 'Full_Build' },
      ],
    },
    {
      id: 'c-verify', type: 'parallel', name: 'Verify',
      children: [
        { id: 'c-smoke',  type: 'action', name: 'Smoke_Test' },
        { id: 'c-health', type: 'action', name: 'Health_Check' },
      ],
    },
    { id: 'c-push', type: 'action', name: 'Push_Image' },
  ],
}

const simpleEvents: AnimEvent[] = [
  { id: 's-root',  status: 'pending', delay: 600 },
  { id: 's-run',   status: 'pending', delay: 400 },
  { id: 's-run',   status: 'success', delay: 700 },
  { id: 's-build', status: 'pending', delay: 300 },
  { id: 's-build', status: 'success', delay: 700 },
  { id: 's-push',  status: 'pending', delay: 300 },
  { id: 's-push',  status: 'success', delay: 700 },
  { id: 's-root',  status: 'success', delay: 400 },
]

const complexEvents: AnimEvent[] = [
  { id: 'c-root',   status: 'pending', delay: 600 },
  { id: 'c-tests',  status: 'pending', delay: 300 },
  { id: 'c-lint',   status: 'pending', delay: 300 },
  { id: 'c-lint',   status: 'success', delay: 600 },
  { id: 'c-unit',   status: 'pending', delay: 250 },
  { id: 'c-unit',   status: 'success', delay: 600 },
  { id: 'c-integ',  status: 'pending', delay: 250 },
  { id: 'c-integ',  status: 'success', delay: 600 },
  { id: 'c-tests',  status: 'success', delay: 300 },
  { id: 'c-build',  status: 'pending', delay: 350 },
  { id: 'c-cached', status: 'pending', delay: 250 },
  { id: 'c-cached', status: 'fail',    delay: 700 },
  { id: 'c-full',   status: 'pending', delay: 400 },
  { id: 'c-full',   status: 'success', delay: 800 },
  { id: 'c-build',  status: 'success', delay: 300 },
  { id: 'c-verify', status: 'pending', delay: 350 },
  { id: 'c-smoke',  status: 'pending', delay: 100 },
  { id: 'c-health', status: 'pending', delay: 80  },
  { id: 'c-smoke',  status: 'success', delay: 800 },
  { id: 'c-health', status: 'success', delay: 250 },
  { id: 'c-verify', status: 'success', delay: 300 },
  { id: 'c-push',   status: 'pending', delay: 350 },
  { id: 'c-push',   status: 'success', delay: 700 },
  { id: 'c-root',   status: 'success', delay: 400 },
]

function flatten(root: TreeNode): FlatNode[] {
  const out: FlatNode[] = []
  function recurse(node: TreeNode, contextPrefix: string, branch: string, isRoot: boolean, isLast: boolean) {
    out.push({ id: node.id, type: node.type, name: node.name, prefix: contextPrefix + branch, isRoot })
    if (node.children) {
      const childContext = contextPrefix + (isRoot ? '' : (isLast ? '   ' : '│  '))
      for (let i = 0; i < node.children.length; i++) {
        const childIsLast = i === node.children.length - 1
        const childBranch = childIsLast ? '└─ ' : '├─ '
        recurse(node.children[i], childContext, childBranch, false, childIsLast)
      }
    }
  }
  recurse(root, '', '', true, false)
  return out
}

const simpleFlat  = flatten(simpleTree)
const complexFlat = flatten(complexTree)

const simpleStatuses  = ref<Record<string, NodeStatus>>({})
const complexStatuses = ref<Record<string, NodeStatus>>({})

let timers: ReturnType<typeof setTimeout>[] = []

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}

function schedule(events: AnimEvent[], target: typeof simpleStatuses): number {
  let t = 0
  for (const ev of events) {
    t += ev.delay
    const at = t
    later(() => { target.value = { ...target.value, [ev.id]: ev.status } }, at)
  }
  return t
}

function run() {
  timers.forEach(clearTimeout)
  timers = []
  simpleStatuses.value  = {}
  complexStatuses.value = {}

  const simpleEnd  = schedule(simpleEvents,  simpleStatuses)
  const complexEnd = schedule(complexEvents, complexStatuses)

  later(run, Math.max(simpleEnd, complexEnd) + 2400)
}

onMounted(run)
onUnmounted(() => timers.forEach(clearTimeout))
</script>

<template>
  <div class="atv-wrap">
    <div class="atv-tagline atv-tagline-wide">
      <span>from <em>simple and ambiguous</em></span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      <span>to <em>complex and specific</em></span>
    </div>

    <div class="atv-grid">
      <div class="atv-col">
        <div class="atv-tagline atv-tagline-narrow"><em>simple and ambiguous</em></div>
        <!-- Simple tree -->
        <div class="atv-panel">
        <div class="atv-bar">
          <span class="atv-dot r"/><span class="atv-dot y"/><span class="atv-dot g"/>
          <span class="atv-name">simple.yaml</span>
        </div>
        <div class="atv-body">
          <div
            v-for="node in simpleFlat"
            :key="node.id"
            class="atv-line"
            :class="{
              'atv-pending': simpleStatuses[node.id] === 'pending',
              'atv-success': simpleStatuses[node.id] === 'success',
              'atv-fail':    simpleStatuses[node.id] === 'fail',
              'atv-idle':    !simpleStatuses[node.id],
            }"
          >
            <span class="atv-prefix">{{ node.prefix }}</span>
            <span v-if="node.type !== 'action'" class="atv-type" :class="`atv-type-${node.type}`">{{ node.type.slice(0, 3) }}</span>
            <span class="atv-text">{{ node.name }}</span>
            <span class="atv-status">
              <svg v-if="simpleStatuses[node.id] === 'pending'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3" fill="currentColor"/></svg>
              <svg v-else-if="simpleStatuses[node.id] === 'success'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.2 5.4 4.2 7.4 7.8 2.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg v-else-if="simpleStatuses[node.id] === 'fail'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.8 2.8 7.2 7.2M7.2 2.8 2.8 7.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </span>
          </div>
        </div>
      </div>

      </div>

      <div class="atv-col">
        <div class="atv-tagline atv-tagline-narrow"><em>complex and specific</em></div>
        <!-- Complex tree -->
        <div class="atv-panel">
        <div class="atv-bar">
          <span class="atv-dot r"/><span class="atv-dot y"/><span class="atv-dot g"/>
          <span class="atv-name">deploy.yaml</span>
        </div>
        <div class="atv-body">
          <div
            v-for="node in complexFlat"
            :key="node.id"
            class="atv-line"
            :class="{
              'atv-pending': complexStatuses[node.id] === 'pending',
              'atv-success': complexStatuses[node.id] === 'success',
              'atv-fail':    complexStatuses[node.id] === 'fail',
              'atv-idle':    !complexStatuses[node.id],
            }"
          >
            <span class="atv-prefix">{{ node.prefix }}</span>
            <span v-if="node.type !== 'action'" class="atv-type" :class="`atv-type-${node.type}`">{{ node.type.slice(0, 3) }}</span>
            <span class="atv-text">{{ node.name }}</span>
            <span class="atv-status">
              <svg v-if="complexStatuses[node.id] === 'pending'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3" fill="currentColor"/></svg>
              <svg v-else-if="complexStatuses[node.id] === 'success'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.2 5.4 4.2 7.4 7.8 2.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg v-else-if="complexStatuses[node.id] === 'fail'" width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.8 2.8 7.2 7.2M7.2 2.8 2.8 7.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </span>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---------- container ---------- */
.atv-wrap {
  margin: 4rem 0 3rem;
}

.atv-tagline {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  justify-content: center;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
  text-align: center;
}
.atv-tagline em {
  font-style: normal;
  color: var(--vp-c-text-1);
  font-weight: 700;
}
.atv-tagline svg {
  color: var(--vp-c-brand-1);
  flex-shrink: 0;
}

.atv-tagline-wide   { margin-bottom: 1.5rem; }
.atv-tagline-narrow { display: none; margin-bottom: 0.6rem; font-size: 1rem; text-align: center; }

@media (max-width: 720px) {
  .atv-tagline-wide   { display: none; }
  .atv-tagline-narrow { display: block; }
}

@media (max-width: 600px) {
  .atv-tagline { font-size: 0.9rem; gap: 0.4rem; }
}

.atv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  font-family: 'IBM Plex Mono', 'Fira Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
}
.atv-col {
  min-width: 0;   /* allow grid item to shrink below its content's min-content size */
}
@media (max-width: 720px) {
  .atv-grid { grid-template-columns: 1fr; }
}

/* ---------- panel shell ---------- */
.atv-panel {
  background: #12121c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
}
.atv-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.atv-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.atv-dot.r { background: #ff5f57; }
.atv-dot.y { background: #febc2e; }
.atv-dot.g { background: #28c840; }
.atv-name {
  margin-left: 4px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.atv-body {
  padding: 14px 16px;
  height: 320px;
  overflow-y: hidden;       /* user-scroll off so we don't trap mobile touch */
  overscroll-behavior: contain;
  pointer-events: none;     /* let wheel/touch pass through to the page */
}

/* ---------- lines ---------- */
.atv-line {
  display: flex;
  align-items: center;
  padding: 3px 6px;
  margin: 1px -6px;
  border-left: 2px solid transparent;
  transition: background 0.4s ease, border-color 0.4s ease, opacity 0.4s ease;
  opacity: 0.4;
}
.atv-line.atv-pending {
  opacity: 1;
  background: rgba(241, 250, 140, 0.08);
  border-left-color: #f1fa8c;
}
.atv-line.atv-success {
  opacity: 1;
  background: rgba(80, 250, 123, 0.07);
  border-left-color: #50fa7b;
}
.atv-line.atv-fail {
  opacity: 0.85;
  background: rgba(255, 85, 85, 0.08);
  border-left-color: #ff5555;
}

.atv-prefix {
  color: rgba(255, 255, 255, 0.22);
  white-space: pre;
}

.atv-type {
  display: inline-block;
  padding: 1px 6px;
  margin-right: 8px;
  font-size: 9px;
  font-weight: 700;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.atv-type-sequence { color: #8be9fd; background: rgba(139, 233, 253, 0.12); }
.atv-type-selector { color: #ffb86c; background: rgba(255, 184, 108, 0.14); }
.atv-type-parallel { color: #bd93f9; background: rgba(189, 147, 249, 0.14); }

.atv-text {
  flex: 1;
  color: rgba(248, 248, 242, 0.85);
  transition: color 0.4s ease;
}
.atv-line.atv-pending .atv-text { color: #f1fa8c; }
.atv-line.atv-success .atv-text { color: #50fa7b; }
.atv-line.atv-fail    .atv-text { color: #ff5555; }

.atv-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  margin-left: 8px;
  transition: color 0.4s ease;
}
.atv-line.atv-pending .atv-status { color: #f1fa8c; }
.atv-line.atv-success .atv-status { color: #50fa7b; }
.atv-line.atv-fail    .atv-status { color: #ff5555; }
.atv-status svg { display: block; }
</style>
