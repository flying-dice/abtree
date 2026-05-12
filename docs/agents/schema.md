---
title: JSON Schema
description: Where the abtree tree-file JSON Schema lives, how to wire it into your editor for inline validation, and how the schema is regenerated and verified in CI.
---

# JSON Schema

abtree publishes a [JSON Schema](https://json-schema.org/) for tree YAML files so editors and validators verify a tree before it ever touches the CLI.

## Sources

- **CLI** — `abtree docs schema` prints the schema to stdout. Byte-identical to the committed file.
- **Repository** — [`tree.schema.json`](https://github.com/flying-dice/abtree/blob/main/tree.schema.json) on `main`.
- **Release** — every GitHub release ships `tree.schema.json` as an asset.
- **Stable URL** — `https://abtree.sh/schemas/tree.schema.json`.

## Configure editor integration

Add a YAML language-server comment at the top of every tree file:

```yaml
# yaml-language-server: $schema=https://abtree.sh/schemas/tree.schema.json
name: my-tree
version: 1.0.0
tree:
  type: action
  name: Greet
  steps:
    - instruct: say hello
```

VS Code with the Red Hat YAML extension, Neovim with `yaml-language-server`, and any other LSP client that speaks the same protocol then surfaces completions, type tooltips, and inline error highlights as you author the tree.

The `$schema` keyword as a top-level YAML field is also accepted by the parser if you prefer to embed it inline rather than as a comment.

## CI validation

The repository test suite parses every YAML in `.abtree/trees/` through `TreeFileSchema` to catch malformed trees. A separate CI job regenerates `tree.schema.json` from the zod source on every push and fails the build if the committed file has drifted — contributors run `bun run schema` whenever they touch the zod schema in `src/schemas.ts`.

## Source of truth

The schema is generated from `src/schemas.ts` via `src/schemas.ts:buildJsonSchema()`, the single function called by both `scripts/generate-schema.ts` (build time) and `cmdDocsSchema` (runtime). The committed `tree.schema.json` is the build output, kept fresh by CI.

## Next

- [Discover trees](/registry) — browse the published behaviour-tree packages you can install and run.
- [Authoring trees](/agents/author) — the YAML field reference the schema enforces.
- [Writing trees](/guide/writing-trees) — tutorial walkthrough that builds the bundled `hello-world` tree from scratch.
