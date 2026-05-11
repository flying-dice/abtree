<script setup lang="ts">
import { computed, ref } from "vue";
import { type RegistryEntry, registry } from "../../registry.ts";

const query = ref("");

// biome-ignore lint/correctness/noUnusedVariables: bound via <template>; biome can't see Vue SFC template references.
const filtered = computed<RegistryEntry[]>(() => {
	const q = query.value.trim().toLowerCase();
	if (!q) return registry;
	return registry.filter(
		(entry) =>
			entry.name.toLowerCase().includes(q) ||
			entry.description.toLowerCase().includes(q),
	);
});
</script>

<template>
	<div class="registry">
		<input
			v-model="query"
			type="search"
			class="registry-search"
			placeholder="Search packages by name or description…"
			aria-label="Search the abtree registry"
		/>

		<p v-if="filtered.length === 0" class="registry-empty">
			No packages match <strong>"{{ query }}"</strong>.
		</p>

		<ul v-else class="registry-grid">
			<li v-for="entry in filtered" :key="entry.name" class="registry-card">
				<a
					:href="entry.link"
					target="_blank"
					rel="noopener noreferrer"
					class="registry-card-link"
				>
					<h3 class="registry-card-name">{{ entry.name }}</h3>
					<p class="registry-card-desc">{{ entry.description }}</p>
					<span class="registry-card-cta">Open repository →</span>
				</a>
			</li>
		</ul>

		<p class="registry-meta">
			{{ filtered.length }} of {{ registry.length }} package{{
				registry.length === 1 ? "" : "s"
			}}
		</p>
	</div>
</template>

<style scoped>
.registry {
	margin: 1.5rem 0 2.5rem;
}

.registry-search {
	width: 100%;
	box-sizing: border-box;
	padding: 0.6rem 0.9rem;
	font-size: 1rem;
	font-family: inherit;
	color: var(--vp-c-text-1);
	background: var(--vp-c-bg-soft);
	border: 1px solid var(--vp-c-divider);
	border-radius: 8px;
	outline: none;
	transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.registry-search:focus {
	border-color: var(--vp-c-brand-1);
	box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

.registry-empty {
	margin-top: 1.2rem;
	padding: 1rem;
	color: var(--vp-c-text-2);
	background: var(--vp-c-bg-soft);
	border-radius: 8px;
	text-align: center;
}

.registry-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 1rem;
	margin: 1.2rem 0 0.6rem;
	padding: 0;
	list-style: none;
}

.registry-card {
	margin: 0;
	padding: 0;
}

.registry-card-link {
	display: flex;
	flex-direction: column;
	height: 100%;
	padding: 1rem 1.1rem 1.1rem;
	color: var(--vp-c-text-1);
	background: var(--vp-c-bg-soft);
	border: 1px solid var(--vp-c-divider);
	border-radius: 10px;
	text-decoration: none;
	transition: border-color 0.15s ease, transform 0.15s ease,
		box-shadow 0.15s ease;
}

.registry-card-link:hover,
.registry-card-link:focus-visible {
	border-color: var(--vp-c-brand-1);
	transform: translateY(-1px);
	box-shadow: 0 4px 14px var(--vp-c-brand-soft);
	outline: none;
}

.registry-card-name {
	margin: 0 0 0.45rem;
	font-size: 1rem;
	font-weight: 600;
	font-family: var(--vp-font-family-mono);
	color: var(--vp-c-brand-1);
	word-break: break-word;
	border-bottom: none;
	padding-top: 0;
}

.registry-card-desc {
	margin: 0 0 0.9rem;
	flex: 1;
	font-size: 0.92rem;
	line-height: 1.5;
	color: var(--vp-c-text-2);
}

.registry-card-cta {
	font-size: 0.85rem;
	font-weight: 500;
	color: var(--vp-c-brand-1);
}

.registry-meta {
	margin: 0.4rem 0 0;
	font-size: 0.85rem;
	color: var(--vp-c-text-3);
	text-align: right;
}
</style>
