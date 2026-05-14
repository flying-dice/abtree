---
title: Discover trees
description: Searchable catalogue of abtree behaviour-tree packages. Each card links to a source repository you can install via npm, pnpm, or bun.
---

# Discover trees

Behaviour trees published as installable node packages. Click a card to open the source repository. Once installed, run a tree via:

```sh
abtree execution create ./node_modules/<pkg> "<summary>"
```

<RegistryCards />

## Catalogue

<!-- catalogue:start — generated from docs/registry.ts by scripts/generate-registry-md.ts -->

- [`@abtree/hello-world`](/trees/hello-world) — Greet a user based on time of day. A small example tree that demonstrates the sequence, selector, and action primitives.
- [`@abtree/implement`](/trees/implement) — Implement an approved plan with complexity-gated architectural review, following the clean-code rules in `clean-code.md`.
- [`@abtree/improve-codebase`](/trees/improve-codebase) — Continuous code-improvement cycle. Scores quality metrics in parallel, hardens findings via a senior-principal critique, triages with a human gate, then iterates through each refactor with bounded retries until the queue is drained.
- [`@abtree/improve-tree`](/trees/improve-tree) — Score the effectiveness of a tree using evidence from one of its sessions, find improvements in parallel, draft a plan in `plans/`, then commit and push.
- [`@abtree/refine-plan`](/trees/refine-plan) — Refine a change request into an approved plan: analyse intent, draft to a per-execution draft file, critique it in place, promote to `plans/`, then take it through codeowner approval (either in-session or via an assigned MR).
- [`@abtree/srp-refactor`](/trees/srp-refactor) — Score a codebase for Single Responsibility violations, pause for the human to pick one to tackle, refactor it in a bounded loop (re-scoring after every pass), run a multi-agent code review, and finish with a before-vs-after change report.
- [`@abtree/technical-writer`](/trees/technical-writer) — Take a documentation goal, ground it in the repo's styleguide, find or build a home in the docs tree, write to it, and gate-check structure / flow / atomicity. Up to three write/review passes before surfacing failure to the human.
- [`@abtree/test-tree`](/trees/test-tree) — Run a BDD test spec against a target tree. Compares the run's final $LOCAL against the spec's `then` assertions and writes a markdown report next to the spec.

<!-- catalogue:end -->

## Submit your own

See [Publish a tree](/guide/publishing-a-tree) for the package layout and pull-request workflow.
