---
title: Blog
description: Field notes on behaviour trees, agent design, and the shape of prompts that hold up under load.
---

# Blog

Field notes on behaviour trees, agent design, and the shape of prompts that hold up under load.

<script setup>
import { data as posts } from './posts.data.ts'
</script>

<ul class="post-list">
  <li v-for="post in posts" :key="post.url">
    <a :href="post.url">
      <h3>{{ post.title }}</h3>
      <p v-if="post.description">{{ post.description }}</p>
    </a>
  </li>
</ul>

<style scoped>
.post-list {
  list-style: none;
  padding: 0;
  margin: 2rem 0;
}
.post-list li {
  margin: 1.25rem 0;
}
.post-list a {
  display: block;
  padding: 1rem 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s;
}
.post-list a:hover {
  border-color: var(--vp-c-brand-1);
}
.post-list h3 {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
  color: var(--vp-c-brand-1);
}
.post-list p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.92rem;
  line-height: 1.5;
}
</style>
