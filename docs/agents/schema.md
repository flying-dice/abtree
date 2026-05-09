# JSON Schema

abtree publishes a [JSON Schema](https://json-schema.org/) for tree YAML files so editors and validators can verify a tree before it ever touches the CLI.

## Sources

- **CLI:** `abtree docs schema` prints the schema to stdout. Byte-identical to the committed file.
- **Repo:** [`tree.schema.json`](https://github.com/flying-dice/abtree/blob/main/tree.schema.json) on `main`.
- **Release:** every GitHub release ships `tree.schema.json` as an asset.
- **Stable URL:** `https://abtree.dev/schemas/tree.schema.json`.

## Editor integration

Add a YAML language-server comment at the top of every tree file:

```yaml
# yaml-language-server: $schema=https://abtree.dev/schemas/tree.schema.json
name: my-tree
version: 1.0.0
tree:
  type: action
  name: Greet
  steps:
    - instruct: say hello
```

VS Code with the Red Hat YAML extension, Neovim with `yaml-language-server`, and any other LSP client that speaks the same protocol will then surface completions, type tooltips, and inline error highlights as you author the tree.

The `$schema` keyword as a top-level YAML field is also accepted by the parser if you prefer to embed it inline rather than as a comment.

## CI validation

The repository's test suite parses every YAML in `.abtree/trees/` through `TreeFileSchema` (`tests/trees-schema.test.ts`), and a separate CI job (`schema` in `.gitlab-ci.yml`) regenerates the JSON Schema from the zod source and fails the build if the committed file has drifted. Both run on every push.

## Source of truth

The schema is generated from `src/schemas.ts` via `src/schemas.ts:buildJsonSchema()`, which is the single function called by both `scripts/generate-schema.ts` (build time) and `cmdDocsSchema` (runtime). The committed `tree.schema.json` is the build output, kept fresh by CI.
