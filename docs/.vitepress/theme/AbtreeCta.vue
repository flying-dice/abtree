<script setup lang="ts">
import { ref } from "vue";

interface Step {
	id: string;
	num: string;
	title: string;
	lang?: string;
	cmd: string;
	caption?: string;
	block?: boolean; // render as multi-line block instead of one-liner
}

const installCli = `curl -fsSL https://github.com/flying-dice/abtree/releases/latest/download/install.sh | sh`;

const installTree = `bun add --dev @abtree/srp-refactor`;

const agentPrompt = `Run the @abtree/srp-refactor workflow against this repo.

First read the runtime protocol:
  abtree --help

Then create an execution and drive it:
  abtree execution create ./node_modules/@abtree/srp-refactor "Refactor the worst SRP violation in src/"

Step through every prompt with abtree next / eval / submit until status: done.`;

const steps: Step[] = [
	{
		id: "cli",
		num: "01",
		title: "Install the abtree CLI",
		caption: "macOS / Linux — Windows uses the PowerShell one-liner below.",
		cmd: installCli,
	},
	{
		id: "tree",
		num: "02",
		title: "Add the srp-refactor tree",
		caption:
			"Drop the published tree into your project — any package manager works.",
		cmd: installTree,
	},
	{
		id: "go",
		num: "03",
		title: "Hand the brief to your agent",
		caption:
			"Paste this into Claude Code, ChatGPT, or any agent that can run shell commands.",
		cmd: agentPrompt,
		block: true,
	},
];

const winInstall = `irm https://github.com/flying-dice/abtree/releases/latest/download/install.ps1 | iex`;

const copied = ref<string | null>(null);

async function copy(id: string, text: string) {
	try {
		await navigator.clipboard.writeText(text);
		copied.value = id;
		setTimeout(() => {
			if (copied.value === id) copied.value = null;
		}, 1600);
	} catch {
		// noop — clipboard API blocked
	}
}
</script>

<template>
	<section class="cta">
		<div class="cta-eyebrow">Put it to work</div>
		<h2 class="cta-headline">Run a real workflow in three commands.</h2>
		<p class="cta-lead">
			The <code>@abtree/srp-refactor</code> tree scores your codebase for
			Single Responsibility violations, lets you pick one, then refactors
			it in a bounded loop with a multi-agent code review at the end.
		</p>

		<ol class="cta-steps">
			<li v-for="step in steps" :key="step.id" class="cta-step">
				<div class="step-num">{{ step.num }}</div>
				<div class="step-body">
					<div class="step-title">{{ step.title }}</div>
					<p v-if="step.caption" class="step-caption">{{ step.caption }}</p>
					<div class="step-cmd" :class="{ block: step.block }">
						<pre class="step-text"><code>{{ step.cmd }}</code></pre>
						<button
							type="button"
							class="copy-btn"
							:class="{ copied: copied === step.id }"
							:aria-label="
								copied === step.id ? 'Copied to clipboard' : 'Copy command'
							"
							@click="copy(step.id, step.cmd)"
						>
							<svg
								v-if="copied !== step.id"
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
								<rect x="9" y="9" width="13" height="13" rx="2" />
								<path
									d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
								/>
							</svg>
							<svg
								v-else
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.4"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
							<span>{{ copied === step.id ? "Copied" : "Copy" }}</span>
						</button>
					</div>
					<p v-if="step.id === 'cli'" class="step-alt">
						Windows:
						<code>{{ winInstall }}</code>
						<button
							type="button"
							class="copy-mini"
							:class="{ copied: copied === 'cli-win' }"
							:aria-label="
								copied === 'cli-win'
									? 'Copied to clipboard'
									: 'Copy Windows command'
							"
							@click="copy('cli-win', winInstall)"
						>
							{{ copied === "cli-win" ? "Copied" : "Copy" }}
						</button>
					</p>
				</div>
			</li>
		</ol>

		<p class="cta-foot">
			<span class="cta-foot-mark">✓</span>
			The agent reads the protocol, drives the loop, and tells you when it's
			done. <a href="/getting-started">Walk through it step-by-step →</a>
		</p>
	</section>
</template>

<style scoped>
.cta {
	position: relative;
	margin: 3rem 0 2rem;
	padding: 40px 44px 36px;
	background:
		radial-gradient(at 0% 0%, rgba(255, 121, 198, 0.1), transparent 55%),
		radial-gradient(at 100% 100%, rgba(189, 147, 249, 0.1), transparent 55%),
		linear-gradient(180deg, #1c1c24 0%, #14141a 100%);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 18px;
	overflow: hidden;
}

.cta-eyebrow {
	font: 700 10px/1 "IBM Plex Mono", monospace;
	letter-spacing: 2.4px;
	text-transform: uppercase;
	color: #ff79c6;
	margin-bottom: 10px;
}

.cta-headline {
	margin: 0 0 14px;
	font-size: 30px;
	font-weight: 700;
	letter-spacing: -0.5px;
	color: #f8f8f2;
	line-height: 1.1;
}

.cta-lead {
	margin: 0 0 32px;
	color: #d8d8de;
	font-size: 15px;
	line-height: 1.6;
	max-width: 760px;
}
.cta-lead code {
	font: 600 13.5px/1 "IBM Plex Mono", monospace;
	padding: 1px 7px;
	border-radius: 5px;
	color: #ff79c6;
	background: rgba(255, 121, 198, 0.1);
	border: 1px solid rgba(255, 121, 198, 0.22);
}

.cta-steps {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 18px;
}
.cta-step {
	display: flex;
	gap: 18px;
	align-items: flex-start;
}

.step-num {
	flex-shrink: 0;
	width: 36px;
	height: 36px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font: 700 12px/1 "IBM Plex Mono", monospace;
	letter-spacing: 1px;
	color: #ff79c6;
	background: rgba(255, 121, 198, 0.1);
	border: 1px solid rgba(255, 121, 198, 0.32);
	border-radius: 50%;
}

.step-body {
	flex: 1;
	min-width: 0;
}
.step-title {
	font-size: 15px;
	font-weight: 700;
	color: #f8f8f2;
	margin-bottom: 4px;
	letter-spacing: -0.1px;
}
.step-caption {
	margin: 0 0 10px;
	font-size: 12.5px;
	color: #8a96be;
	line-height: 1.5;
}

.step-cmd {
	position: relative;
	display: flex;
	align-items: stretch;
	gap: 0;
	background: #0e0e14;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 10px;
	overflow: hidden;
}
.step-text {
	margin: 0;
	flex: 1;
	min-width: 0;
	padding: 12px 16px;
	font: 500 13px/1.5 "IBM Plex Mono", "Fira Mono", monospace;
	color: #f1fa8c;
	white-space: pre;
	overflow-x: auto;
}
.step-cmd.block .step-text {
	white-space: pre-wrap;
	color: #f8f8f2;
}
.step-cmd.block .step-text code {
	color: inherit;
}

.copy-btn {
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 0 16px;
	color: #d8d8de;
	background: rgba(255, 255, 255, 0.04);
	border: none;
	border-left: 1px solid rgba(255, 255, 255, 0.08);
	font: 700 12px/1 "Inter", system-ui, sans-serif;
	cursor: pointer;
	transition:
		background 160ms ease,
		color 160ms ease;
}
.copy-btn:hover {
	background: rgba(255, 121, 198, 0.12);
	color: #ff79c6;
}
.copy-btn.copied {
	background: rgba(80, 250, 123, 0.12);
	color: #50fa7b;
}
.copy-btn svg {
	flex-shrink: 0;
}

.step-alt {
	margin: 10px 0 0;
	font-size: 12.5px;
	color: #8a96be;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
}
.step-alt code {
	font: 500 12px/1.4 "IBM Plex Mono", monospace;
	color: #f1fa8c;
	background: rgba(241, 250, 140, 0.06);
	border: 1px solid rgba(241, 250, 140, 0.18);
	border-radius: 5px;
	padding: 3px 8px;
}
.copy-mini {
	font: 700 10px/1 "Inter", system-ui, sans-serif;
	letter-spacing: 0.5px;
	text-transform: uppercase;
	color: #6272a4;
	background: transparent;
	border: 1px solid rgba(98, 114, 164, 0.4);
	padding: 4px 8px;
	border-radius: 5px;
	cursor: pointer;
	transition:
		color 150ms ease,
		border-color 150ms ease;
}
.copy-mini:hover {
	color: #ff79c6;
	border-color: rgba(255, 121, 198, 0.5);
}
.copy-mini.copied {
	color: #50fa7b;
	border-color: rgba(80, 250, 123, 0.5);
}

.cta-foot {
	margin: 28px 0 0;
	padding-top: 22px;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
	color: #d8d8de;
	font-size: 14px;
	line-height: 1.5;
}
.cta-foot-mark {
	color: #50fa7b;
	font-weight: 700;
	margin-right: 8px;
}
.cta-foot a {
	color: #ff79c6;
	font-weight: 600;
	text-decoration: none;
}
.cta-foot a:hover {
	text-decoration: underline;
}

@media (max-width: 720px) {
	.cta {
		padding: 28px 22px 24px;
	}
	.cta-headline {
		font-size: 24px;
	}
	.cta-step {
		gap: 14px;
	}
	.step-num {
		width: 32px;
		height: 32px;
		font-size: 11px;
	}
	.step-text {
		font-size: 12px;
		padding: 10px 12px;
	}
	.copy-btn {
		padding: 0 12px;
	}
}
</style>
