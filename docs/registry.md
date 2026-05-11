---
title: Registry
description: Searchable catalog of abtree behaviour-tree packages. Each card links to a source repository you can install via npm, pnpm, or bun.
---

# Registry

Behaviour trees published as installable node packages. Click a card to open the source repository. Once installed, run a tree via:

```sh
abtree execution create ./node_modules/<pkg-name> "<summary>"
```

<RegistryCards />

## Submitting your own

Publish your tree as a node package (`package.json` + a `main` pointing at the tree YAML/JSON at the repo root), then open a PR against [`flying-dice/abtree`](https://github.com/flying-dice/abtree) adding an entry to [`docs/registry.ts`](https://github.com/flying-dice/abtree/blob/main/docs/registry.ts).
