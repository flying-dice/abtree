---
id: 1778362002-where-trees-and-flows-live
title: Tree and Flow Locations
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

Trees are loaded from two locations (project-local first, user-global second). Flows are written to a single location (project-local by default, env-var overridable). Project-local trees shadow user-global trees on slug collision. Flow IDs encode the summary, tree slug, and a per-prefix counter, and double as the flow's filename.

## Requirements

- `abtree tree list` searches `<cwd>/.abtree/trees/` first, then `~/.abtree/trees/`. Slugs in the project-local set shadow same-named slugs in the user-global set.
- `abtree flow create` resolves the tree by walking the same source list and stops at the first match.
- Flow files always go to `<FLOWS_DIR>/<flow-id>.json` and `<FLOWS_DIR>/<flow-id>.mermaid`. Default `<FLOWS_DIR>` = `<cwd>/.abtree/flows/`.
- Setting `ABTREE_FLOWS_DIR=<path>` overrides the flows directory. Accepts absolute paths, cwd-relative paths, and `~/`-prefixed paths.
- A flow ID matches `^[a-z0-9_-]+__[a-z0-9_-]+__\d+$`. Three components separated by double underscores: kebab-cased summary, tree slug, per-prefix counter.
- The counter is computed by counting existing flow files whose IDs share the `<summary>__<tree>__` prefix; collisions get the next integer.
- Subdirectories under `<TREES_DIR>` (e.g. `fragments/`) are not enumerated by `listTreeSlugs` — only top-level `*.yaml` files are listed. Fragments are reachable via `$ref` regardless.

## Technical Approach

### Constants

```ts
// src/paths.ts
export const ABTREE_DIR      = resolve(process.cwd(), ".abtree");
export const TREES_DIR       = join(ABTREE_DIR, "trees");
export const HOME_ABTREE_DIR = join(homedir(), ".abtree");
export const HOME_TREES_DIR  = join(HOME_ABTREE_DIR, "trees");

// Tree lookup precedence — first match wins.
export const TREE_SOURCES: readonly string[] = [TREES_DIR, HOME_TREES_DIR];

// Flows: cwd-relative by default, env-overridable.
export const FLOWS_DIR = process.env.ABTREE_FLOWS_DIR
  ? resolve(expandHome(process.env.ABTREE_FLOWS_DIR))
  : join(ABTREE_DIR, "flows");
```

### `expandHome`

Tilde-handling for env var paths:
- `~` → `homedir()`
- `~/foo` → `<homedir>/foo`
- everything else → unchanged (passes through `resolve()` for cwd-relative paths)

### Why two scopes for trees, one for flows

Trees are *workflow definitions* — many projects share them. A `code-review` workflow installed once at `~/.abtree/trees/code-review.yaml` is available in every repo without duplication. A project that needs a tweaked version drops `.abtree/trees/code-review.yaml` into the repo root, and the project-local copy wins.

Flows are *workflow instances* — execution state for one piece of work. They belong to whichever project is doing the work; mixing them across projects produces nonsense. Default location is cwd-relative.

The `ABTREE_FLOWS_DIR` env var is for the case where flow state needs to live somewhere other than the cwd — e.g. shared volume across machines, or co-located with project data outside the repo.

### Flow ID generation

```ts
function generateFlowId(tree: string, summary: string): string {
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const prefix = `${slug}__${tree}__`;
  const count = FlowStore.countByPrefix(prefix);
  return `${prefix}${count + 1}`;
}
```

`countByPrefix` reads the flows directory, filters by prefix, and returns the count. The counter is per-(summary, tree) pair, not global. Two flows with summary "first run" against the `hello-world` tree get IDs `first-run__hello-world__1` and `first-run__hello-world__2`.

### ID validation

Every file open by ID first checks the regex `^[a-z0-9_-]+__[a-z0-9_-]+__\d+$`. Rejects path traversal (`..`), forbidden characters (`/`, `\`, `.`), and untrusted input. Defence-in-depth even though `parseFlowId` validates upstream.

## Affected Systems

- `src/paths.ts` — `TREE_SOURCES`, `FLOWS_DIR`, `expandHome`, `ABTREE_FLOWS_DIR` env var.
- `src/tree.ts` — `loadTree` walks `TREE_SOURCES`; `listTreeSlugs` unions both with project-local first; `generateFlowId`.
- `src/repos.ts` — `flowPath` enforces ID regex; `FlowStore.list` enumerates `FLOWS_DIR`.
- `index.ts` — `ensureDir(FLOWS_DIR)` and `ensureDir(TREES_DIR)` at startup.
- `docs/guide/cli.md` — documents both behaviours.

## Acceptance Criteria

- A tree at `~/.abtree/trees/code-review.yaml` is listed by `abtree tree list` from any project's cwd.
- Adding `.abtree/trees/code-review.yaml` to a project causes `abtree flow create code-review` to use the project copy.
- `ABTREE_FLOWS_DIR=/tmp/abtree-test abtree flow create hello-world "test"` writes `/tmp/abtree-test/test__hello-world__1.json`.
- `ABTREE_FLOWS_DIR=~/shared abtree flow list` reads from `~/shared/`.
- An ID like `../../etc/passwd` rejected at `flowPath` with "Invalid flow id".
- Two `flow create hello-world "first run"` calls produce IDs ending in `__1` and `__2` respectively.

## Risks & Considerations

- **Tree-name vs flow-ID confusion.** Both use kebab-case. Tree names appear in flow IDs (the middle segment). Editing a tree's `name` field after flows exist for it would orphan the flows. Acceptable trade-off; tree names are stable in practice.
- **`ABTREE_FLOWS_DIR` shared across multiple repos.** Pointing the env var at a shared directory works for cross-repo flow tracking but risks ID collisions if two repos use the same summary + tree pair. Documented; not enforced.
- **Subdirectory fragments under `trees/`.** `listTreeSlugs` is non-recursive by design — fragments aren't trees. If users put a `.yaml` in a subdirectory expecting it to be listed, they'll be surprised. Documented in the writing-trees guide.
- **Discovery ordering.** Project-local-first is hardcoded. No way to override the precedence without changing `TREE_SOURCES`. Acceptable; the convention matches every dev tool that combines repo-local and user-global config.

## Open Questions

None. Lookup paths are stable.
