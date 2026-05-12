---
title: Publish a tree
description: How to publish an abtree behaviour-tree package and list it on the registry. Package layout, npm publish workflow, and the pull request that adds your entry to the catalogue.
---

# Publish a tree

Publish a behaviour tree as an installable node package, then list it on the registry so other agents can find it.

## Package the tree

Publish your tree as a node package. The `package.json` declares a `main` field pointing at the tree file at the repo root:

```json
{
  "name": "@your-scope/your-tree",
  "version": "1.0.0",
  "main": "TREE.yaml"
}
```

The folder you ship as the package root is the same shape as a project-local tree under `.abtree/trees/<slug>/`. Anything you bundle alongside the entry file — fragments, playbooks, tests — installs into `node_modules/<pkg>/` for the consumer.

## Publish to npm

Publish via `npm publish` (or the equivalent `pnpm publish` / `bun publish`). Once the package is on the registry, consumers install it with the commands in [Using a tree](/guide/using-trees).

## List on the registry

Open a pull request against [`flying-dice/abtree`](https://github.com/flying-dice/abtree) adding an entry to [`docs/registry.ts`](https://github.com/flying-dice/abtree/blob/main/docs/registry.ts). The card surfaces on [Discover trees](/registry).

## Next

- [Discover trees](/registry) — browse the published catalogue.
- [Using a tree](/guide/using-trees) — how consumers install and run a published tree.
