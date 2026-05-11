<script setup lang="ts">
import { computed } from "vue";

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
