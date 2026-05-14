---
id: 20260513T1200-pure-resolver-prunes
title: Pure-ref tree resolution
status: refined
author: Starscream
created: 2026-05-13
reviewed_by: Starscream
---

## Summary

Strip every inference layer from `loadTree`. A tree argument is a literal path to a `.json`, `.yaml`, or `.yml` file — nothing else. No slug-directory lookup under `.abtree/trees/`, no `package.json:main` probing, no conventional-filename guessing. The slug used in execution IDs comes from the tree file's own `name` field (already required by `TreeFileSchema`). The DSL/TypeScript channel keeps handling "compose from TS"; the runtime stays text-only and resolver-free.

## Requirements

- `resolveTreeArg(arg)` returns `{ yamlPath }` on success and `null` for every non-match. No throws.
- Accepts: absolute path or path resolved relative to `process.cwd()` that exists, is a regular file, and matches `/\.(ya?ml|json)$/i`. Everything else → `null`.
- `loadTree` computes `slug = sanitiseSlug(parsed.name)` after `validateTreeFile`. No fallback chain — the schema requires `name`.
- `$RefParser.dereference` keeps its current options. No custom resolvers. No bare-specifier resolution.
- These symbols are deleted from `@abtree/runtime`'s public surface and from every internal call-site: `resolveEntryYaml`, `EntryResolution`, `deriveSlugFromYaml`, `findSlugYaml`, `findPathYaml`, `missingEntryError`, `TREES_DIR`, `HOME_TREES_DIR`, `HOME_ABTREE_DIR`, `TREE_SOURCES`.
- CLI: arg help text says `"Tree file path"` (not `"Tree slug"`); the single failure message is `tree file '<arg>' not found`.
- MCP tool: `abtree_execution_create`'s description and `tree` parameter description align with the CLI ("path to a `.json`/`.yaml`/`.yml` tree file").

## Technical Approach

### `packages/runtime/src/tree-arg.ts` — collapse to one resolver

Delete `resolveTreeArg`, `findSlugYaml`, `findPathYaml`, `resolveEntryYaml`, `missingEntryError`, `deriveSlugFromYaml`, and the `EntryResolution` type. Replace with:

```ts
import { existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export interface ResolvedTreeArg {
  yamlPath: string;
}

const TREE_FILE_RE = /\.(ya?ml|json)$/i;

export function resolveTreeArg(arg: string): ResolvedTreeArg | null {
  const abs = isAbsolute(arg) ? arg : resolve(process.cwd(), arg);
  if (!existsSync(abs)) return null;
  if (!statSync(abs).isFile()) return null;
  if (!TREE_FILE_RE.test(abs)) return null;
  return { yamlPath: abs };
}
```

`sanitiseSlug` stays in this file — it's the canonical name→slug helper and is now consumed only by the loader.

### `packages/runtime/src/loader.ts` — slug from the parsed tree

`LoadedTree.slug` is computed after `validateTreeFile(raw)`:

```ts
const parsed = validateTreeFile(raw);
const slug = sanitiseSlug(parsed.name);
```

No other change. `$RefParser.dereference(yamlPath, { dereference: { circular: "ignore" } })` is unchanged.

### `packages/runtime/src/paths.ts` — drop dead exports

Delete `TREES_DIR`, `HOME_ABTREE_DIR`, `HOME_TREES_DIR`, `TREE_SOURCES`. Keep `ABTREE_DIR`, `EXECUTIONS_DIR`, `SNAPSHOTS_DIR`, `ensureDir`. (`expandHome` is internal and stays as-is.)

### `packages/runtime/src/index.ts` — public-surface trim

Drop the exports of the removed symbols. Keep `loadTree`, `LoadedTree`, `sanitiseSlug`, the remaining `paths.ts` exports, and everything else currently exported.

### `packages/cli/src/parse-args.ts` — rename only

Rename `parseTreeSlug` → `parseTreePath`. Update the failure message to `"Tree file path is required"`. The body is already minimal (non-empty/string check); there is no regex to relax.

### `packages/cli/src/commands.ts` and `packages/cli/index.ts` — wording

- `commands.ts:cmdExecutionCreate` / `cmdRender`: the failure message becomes `tree file '<arg>' not found`.
- `index.ts:94` (`execution create` arg) and `:155` (`render` arg) help text: `"Tree slug"` / `"Tree slug or path (...)"` → `"Tree file path (e.g. './my-tree/main.json')"`.

### `packages/cli/src/mcp/tools.ts:206-227` — MCP descriptions

- Tool description: `"Create a new abtree execution from a tree slug or path."` → `"Create a new abtree execution from a path to a .json/.yaml/.yml tree file."`
- `tree` parameter description: `"Tree slug or path (see \`abtree docs execute\`)."` → `"Path to a .json/.yaml/.yml tree file."`

### `packages/cli/tests/harness.ts` — drop `.abtree/trees/<slug>/` layout

The cases-harness currently stages every tree under `.abtree/trees/<slug>/`, writes a synthetic `package.json` declaring `main: "TREE.yaml"`, then invokes `abtree execution create <slug>`. With the new model the harness:

1. Stages `bundled` / `files` / `tests/trees/<slug>/TREE.yaml` content into a flat fixtures dir under the tempdir (e.g. `<tmp>/trees/<slug>/TREE.yaml`).
2. Drops the synthetic-`package.json` block entirely.
3. Invokes `abtree execution create <abs-path-to-TREE.yaml> "harness"`.

The `tree: <slug>` field in each `cases/*.yaml` stays — it's the harness's internal identifier for which fixture to stage. The harness translates it to the absolute path internally.

### `packages/cli/tests/cli.test.ts` — drop the `.abtree/trees/<slug>/` setup

`beforeAll` (lines 36-49) currently copies `hello-world/{main.json, package.json}` into `<tmp>/.abtree/trees/hello-world/` so the slug lookup works. Replace with: copy `main.json` only to `<tmp>/hello-world/main.json` (or any subpath). Invoke the CLI with that file path.

The slug-derivation change matters for the assertion at line 64: `expect(id).toMatch(/^integration-test__hello-world__\d+$/)`. The tree file's `name` is `@abtree/hello-world`, which `sanitiseSlug` collapses to `abtree-hello-world`. Update the regex to `^integration-test__abtree-hello-world__\d+$`.

### `packages/testing/src/fixture.ts` — rework

`setupTreePackageFixture` exists to lay out `.abtree/trees/<slug>/` with `main.json` + `package.json`. That's now dead weight. Two options:

1. **Keep the API, change the body**: still create an isolated cwd, copy `main.json` to `<cwd>/<slug>/main.json` (the `slug` field becomes an internal dir-name only), expose the absolute path on the returned handle. Update the doc comment to reflect the new contract.
2. **Replace it**: introduce `setupIsolatedAbtreeCwd({ prefix })` returning just `{ cwd, cleanup }`; callers pass an absolute path to `agent.start(...)`.

Recommend option 1 — preserves the existing call-sites in `tests/run-cli.ts` and `tests/run-mcp.ts` with a one-line change (the harness internally swaps from slug-based to path-based invocation). The fixture's returned shape grows a `treePath: string` field with the absolute path.

`AgentHarness.start(tree, summary)` doesn't need a signature change — `tree` was always documented as "slug or absolute path". `tests/run-cli.ts:31` and `tests/run-mcp.ts:31` switch from `agent.start("abtree-regression", "regression cli")` to `agent.start(fixture.treePath, "regression cli")`.

### `packages/runtime/tests/tree-loading.test.ts` — rewrite

Keep exactly these cases:

- Loads a relative `.json` path.
- Loads a relative `.yaml` path.
- Loads a relative `.yml` path.
- Loads an absolute `.json` path.
- Returns `null` when the path doesn't exist.
- Returns `null` for a directory.
- Returns `null` for a file with an unrecognised extension (e.g. `package.json`'s sibling `notes.txt`).
- Slug derives from the tree file's `name` — covers scoped collapse (`@acme/foo` → `acme-foo`) and unscoped passthrough (`bt-retry` → `bt-retry`).
- A tree with a relative `$ref: "./fragment.json"` dereferences — proves the stock `$RefParser` behaviour is intact.

Delete every test covering directory-with-`package.json:main`, conventional-filename probing, slug-from-`package.json:name`, `node_modules` vendoring, the missing-`main` error, the missing-`package.json` error, the YAML-direct "escape hatch", and the `.abtree/trees/<slug>/` slug lookup.

### `packages/runtime/tests/trees-schema.test.ts` — leave alone

This test reads `package.json:main` only as a discovery convention for the per-tree schema check; it does not call `loadTree`. No runtime exposure. Optional follow-up: glob `trees/*/main.json` instead. Out of scope for this change.

## Affected Systems

- `packages/runtime` — `tree-arg.ts`, `loader.ts`, `paths.ts`, `index.ts`, `tests/tree-loading.test.ts`.
- `packages/cli` — `src/parse-args.ts`, `src/commands.ts`, `index.ts`, `src/mcp/tools.ts`, `tests/cli.test.ts`, `tests/harness.ts`.
- `packages/testing` — `src/fixture.ts` (rework), surrounding JSDoc comments in `harness.ts` / `transport-cli.ts` / `transport-mcp.ts` that mention `.abtree/trees/<slug>/`.
- `tests/` (regression) — `run-cli.ts`, `run-mcp.ts` switch from slug to path.

Out of scope (deferred to a chained PR): `packages/cli/SKILL.md`, `docs/agents/execute.md` ("Available trees" section that references `.abtree/trees/<slug>/`), the `docs/` site pages, and every `trees/*/README.md` that shows `abtree run <slug>`.

## Acceptance Criteria

- `loadTree("./trees/hello-world/main.json")` returns `LoadedTree` with `slug === "abtree-hello-world"`.
- `loadTree("./trees/hello-world")` returns `null` (directory).
- `loadTree("hello-world")` returns `null` (bare slug, no longer a recognised shape).
- `loadTree("./trees/hello-world/package.json")` returns `null` (wrong extension).
- A synthetic fixture with `{"$ref": "./fragment.json"}` loads successfully through `loadTree`.
- `bun test` passes in `packages/runtime/`, `packages/cli/`, and `packages/testing/`.
- `bun tests/run-cli.ts` and `bun tests/run-mcp.ts` pass.
- `rg "resolveEntryYaml|TREES_DIR|HOME_TREES_DIR|HOME_ABTREE_DIR|TREE_SOURCES|deriveSlugFromYaml|findSlugYaml|findPathYaml|missingEntryError|EntryResolution" packages/` returns no matches (this plan file lives in `plans/`, so it does not pollute the result).
- `abtree execution create ./trees/refine-plan/main.json "smoke"` returns an execution row; `abtree next <id>` returns the protocol gate.
- `abtree execution create hello-world "smoke"` exits non-zero with `tree file 'hello-world' not found`.
- MCP `abtree_execution_create` tool's listed description and `tree` parameter description both say "path to a `.json`/`.yaml`/`.yml` tree file".

## Risks & Considerations

- **Execution-ID prefix change.** Existing executions on disk (`.abtree/executions/`) replay against their snapshot, so they keep working. New executions created from `./trees/hello-world/main.json` get the `abtree-hello-world__…` prefix instead of `hello-world__…`. Any downstream tooling that pattern-matches on the slug prefix needs to know — flag the change in the commit message body.
- **Documentation drift between this PR and the doc sweep.** `packages/cli/SKILL.md`, `docs/agents/execute.md`'s "Available trees" section, and `trees/*/README.md` all reference the slug pattern. Land them in a chained follow-up PR blocked by this one; merging this without that follow-up leaves the docs lying about how the CLI works.
- **Internal call-sites of removed symbols.** Confirmed via grep that the only consumers of `TREES_DIR` / `TREE_SOURCES` / `resolveEntryYaml` are the runtime itself, the deleted code paths, and `tests/tree-loading.test.ts` (rewritten in this change). `trees-schema.test.ts` declares a local `TREES_DIR` constant, not the runtime export.
- **`packages/testing` fixture API.** Rework is mechanical but observable to any out-of-tree consumer of `@abtree/testing`. The package is not published (workspace-only); no external blast radius.
- **No backwards compatibility.** Intentional. The slug invocation is deleted in a single commit. The CLI surfaces a single, explicit error so the failure mode is unambiguous.

## Open Questions

None remaining — every previously open item has been resolved:

- `parseTreePath` body stays minimal (non-empty/string check); no regex to drop because the current one has none.
- The `render` command's help text changes in the same patch as `execution create` (single small edit in `index.ts`).
- The docs sweep is a separate, chained PR blocked by this one.