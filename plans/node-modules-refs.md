---
id: 1778500966-node-modules-scheme-ships
title: $ref node-modules: scheme backed by any node package manager
status: refined
author: Jonathan Turnock
created: 2026-05-11
reviewed_by: Jonathan Turnock
---

## Summary

Add a `node-modules:<pkg-name>[/<sub-path>]` URI scheme to abtree's `$ref` resolution path (`src/tree.ts:39`, backed by `@apidevtools/json-schema-ref-parser`). The `<pkg-name>` is the standard npm package name (the `name` field in the fragment package's `package.json`); the install location is whatever `npm install` / `pnpm install` / `bun install` puts in `node_modules/<pkg-name>/`. The resolver walks up `node_modules/<pkg-name>/` from the referring file's directory — standard node module resolution — so every mainstream `node_modules`-emitting package manager works unchanged.

**Scheme-name note.** The original intent was a literal `node_modules://...` (mirroring the directory name verbatim). Empirical testing against `@apidevtools/json-schema-ref-parser` showed two blockers: (1) underscores are invalid in URI scheme names per RFC 3986 §3.1, so the library treats the underscore-bearing scheme as a relative path and prepends the base file's directory, breaking resolution; (2) the `://` (authority-form) syntax triggers WHATWG URL parsing, which treats `@scope/pkg` as a userinfo component and **silently strips the `@scope` half**. The single-colon opaque-URI form `node-modules:@scope/pkg/sub` (RFC 3986 §3) sidesteps both issues — the hyphen makes the scheme name valid, and the absence of `//` preserves `@scope` verbatim. Verified by a one-shot fixture test before this plan was refined; results captured in the Risks section.

Distribution is delegated **entirely** to whichever node package manager the consumer prefers. Bun's git-dependency syntax (https://bun.com/docs/pm/cli/add#git-dependencies) is one supported install path; `npm install github:owner/repo#v1.2.0`, `pnpm add github:owner/repo#v1.2.0`, `bun add github:owner/repo#v1.2.0` are interchangeable. abtree builds no fetcher, no cache, no install verb — `package.json` is the source of truth for dependencies and the package manager's lockfile (`package-lock.json` / `pnpm-lock.yaml` / `bun.lock`) provides reproducibility.

This plan **supersedes** the two previously-refined plans, which are archived (moved to `plans/archive/`) when this plan lands:

- `plans/dependency-ref-resolver.md` (`dependency://<alias>` scheme + per-tree `_dependencies/` cache).
- `plans/abtree-dependencies-cli-subcommand.md` (custom `abtree dependencies install` CLI).

Reason for the pivot: every problem those plans solved (git fetch, tag resolution, commit pinning, lockfile, transitives, hoisting, auth) is already solved by every mainstream node package manager. Building a parallel package manager is duplicate work and a worse UX for users who already know `npm install` / `pnpm add` / `bun add`.

## Requirements

**Scheme registration.** A custom resolver is registered against `$RefParser` via the existing `dereference` call at `src/tree.ts:39`. It matches `$ref` strings starting with `node-modules:`. Built-in resolvers (`file`, `http`) are untouched and continue to handle `./...`, `../...`, `https://...`, `file://...` refs exactly as today.

**Grammar.** A `node-modules:` ref has the form:

```
node-modules-ref ::= "node-modules:" <pkg-name> [ "/" <sub-path> ] [ "#" <json-pointer> ]
<pkg-name>       ::= <scoped-name> | <bare-name>
<scoped-name>    ::= "@" <segment> "/" <segment>
<bare-name>      ::= <segment>
<segment>        ::= /^[a-z0-9][a-z0-9._-]*$/  — npm package-name rules, lowercase
<sub-path>       ::= one or more "/"-separated POSIX path segments inside the package
<json-pointer>   ::= standard JSON Pointer fragment processed by ref-parser, not by this resolver
```

**Package-name split rule.** Splitting the body of the ref into `<pkg-name>` and `<sub-path>`:
- If the body starts with `@`, the package name is everything up to (and including) the segment after the **first** `/`. The sub-path is whatever follows the **second** `/`, if present. Example: `@acme/bt-retry/fragments/x.yaml` → `pkgName = "@acme/bt-retry"`, `subPath = "fragments/x.yaml"`.
- Otherwise (bare name), the package name is everything up to the **first** `/`. The sub-path is whatever follows. Example: `bt-retry/fragments/x.yaml` → `pkgName = "bt-retry"`, `subPath = "fragments/x.yaml"`.

This is node's standard bare-specifier resolution split — the same logic node uses for `import "@scope/pkg/sub"`.

**Default file.** Without a sub-path, the resolved target is `<pkg-dir>/TREE.yaml`. With a sub-path, the resolved target is the file at that path under `<pkg-dir>` verbatim — no `TREE.yaml` convention applied.

**Package identity.** The package name is the **name from the fragment package's `package.json`**, not the GitHub owner/repo. A repo at `github.com/acme/bt-retry-fragments` whose `package.json` declares `"name": "@acme/bt-retry"` is referenced as `node-modules:@acme/bt-retry`, not `node-modules:acme/bt-retry-fragments`. This is the npm convention.

**JSON Pointer fragments.** A `#<json-pointer>` segment after the path is preserved by the library and applied as a JSON Pointer to the returned document — e.g. `node-modules:@acme/bt-retry#/tree` returns the cached TREE.yaml's `tree:` field. The library strips the fragment before passing the URL to our resolver.

**Resolution algorithm.** From the directory of the referring file, walk up parents looking for `<dir>/node_modules/<pkg-name>/`. Return the first match. All mainstream node package managers (npm, pnpm with isolated/hoisted modes, yarn classic, yarn berry with `nodeLinker: node-modules`, bun) install to `node_modules/` — hoisted to the project root by default; nested under `node_modules/<parent>/node_modules/` when version conflicts force it. The walk-up rule handles both layouts and any package manager's hoisting decisions.

**Transitive resolution.** When the library calls our resolver for a `$ref` inside an installed package's document, the parent document's URL is passed as `baseUrl` (with a JSON Pointer fragment identifying where the ref appeared in the parent). We maintain a per-resolver `Map<documentURL, pkgDir>` populated each time we resolve a ref; lookups from a `node-modules:X` baseUrl strip its `#<pointer>` fragment, look up `X`'s recorded `pkgDir`, and use that directory as the walk-up starting point. This gives true nested resolution (a fragment's transitive refs walk up from inside the fragment's own dir, finding its nested `node_modules/` first).

**No TREE.yaml schema changes.** This plan introduces **no** new top-level field on TREE.yaml. Dependencies live in `package.json`. The consumer's `package.json` is the source of truth; abtree validation does not look at it. The fragment author publishes a repo with `package.json` (name + version) plus `TREE.yaml` at the package root. Authoring TREE.yaml is unchanged; only the `$ref` strings can reference packages now.

**Error messages.** Every error from this resolver is a stable string and is matched verbatim in acceptance criteria. See the Error surface table in Technical Approach.

**Stateless across loadTree calls.** A new `urlToPkgDir` map is created per `makeNodeModulesResolver` call (per `loadTree`); no cross-call state.

**Cyclic-ref behaviour preserved.** The existing `dereference({ circular: "ignore" })` semantics are unchanged. A cyclic `node-modules:` ref (A → B → A) leaves a literal `{ $ref: "..." }` node in the snapshot; the runtime fails cleanly if it ever ticks one — same as cyclic file refs today.

**No backfill.** Existing trees that contain no `node-modules:` refs continue to validate, snapshot, and tick byte-identically. The new resolver only matches `node-modules:`-prefixed strings, so it cannot intercept existing refs.

## Technical Approach

### Author flow (a fragment publisher)

A fragment package is a normal npm-compatible package with two files at minimum:

```
my-fragment-repo/
  package.json                 # { "name": "@acme/bt-retry", "version": "1.2.0" }
  TREE.yaml                    # the fragment's tree
  fragments/                   # optional, for sub-files referenced via sub-path
    inner.yaml
```

Publishing = `git tag v1.2.0 && git push --tags`. No registry account required for git-source consumption — any of `npm install github:acme/bt-retry#v1.2.0`, `pnpm add github:acme/bt-retry#v1.2.0`, or `bun add github:acme/bt-retry#v1.2.0` works. (Authors who *also* publish to a registry gain semver-range semantics for free, but it's not required.)

### Consumer flow

Pick whichever package manager your project already uses:

```bash
# install a git tag (pick one — all three are equivalent)
npm  install github:acme/bt-retry#v1.2.0
pnpm add     github:acme/bt-retry#v1.2.0
bun  add     github:acme/bt-retry#v1.2.0

# install a tarball
bun add @acme/bt-retry@https://example.com/bt-retry-1.2.0.tgz
```

`package.json` now contains an entry like (exact serialization varies by manager):

```json
{
  "dependencies": {
    "@acme/bt-retry": "github:acme/bt-retry#v1.2.0"
  }
}
```

The manager's lockfile pins the exact commit. The fragment ends up on disk at `node_modules/@acme/bt-retry/`.

Reference it from any TREE.yaml:

```yaml
tree:
  type: sequence
  children:
    - $ref: "node-modules:@acme/bt-retry#/tree"                  # inline the fragment's tree node
    - $ref: "node-modules:@acme/bt-retry/fragments/inner.yaml"   # inline a named sub-file
```

No `abtree dependencies install`. No `_dependencies/`. No custom CLI.

### File layout

```
src/deps/
  parse.ts        # parseNodeModulesRef — single small function
  resolve.ts      # makeNodeModulesResolver, findNodeModulesPkg
  types.ts        # NodeModulesRef shape
```

~150 lines total across all three files.

### Resolver registration

`src/tree.ts` change:

```ts
import { makeNodeModulesResolver } from "./deps/resolve.ts";

export async function loadTree(slug: string): Promise<ParsedTree | null> {
  for (const dir of TREE_SOURCES) {
    const yamlPath = join(dir, slug, "TREE.yaml");
    if (!existsSync(yamlPath)) continue;
    const raw = await $RefParser.dereference(yamlPath, {
      resolve: { "node-modules": makeNodeModulesResolver(yamlPath) },
      dereference: { circular: "ignore" },
    });
    const parsed = validateTreeFile(raw);
    return { /* unchanged */ };
  }
  return null;
}
```

### Resolver implementation (`src/deps/resolve.ts`)

```ts
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ResolverError } from "@apidevtools/json-schema-ref-parser";
import { parseNodeModulesRef } from "./parse.ts";

export function findNodeModulesPkg(startDir: string, pkgName: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, "node_modules", pkgName);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function makeNodeModulesResolver(yamlPath: string) {
  const initialDir = dirname(yamlPath);
  const urlToPkgDir = new Map<string, string>();
  return {
    order: 200, // run AFTER the file resolver (order: 100); see note below
    canRead: (file: { url: string }) => file.url.startsWith("node-modules:"),
    read: async (file: { url: string; baseUrl?: string }) => {
      try {
        const ref = parseNodeModulesRef(file.url);
        const baseDocUrl = file.baseUrl?.split("#")[0];
        const startDir = (baseDocUrl && urlToPkgDir.get(baseDocUrl)) ?? initialDir;
        const pkgDir = findNodeModulesPkg(startDir, ref.pkgName);
        if (!pkgDir)
          throw new Error(
            `module '${file.url}' not found in node_modules/; run 'npm install' / 'pnpm install' / 'bun install'`,
          );
        const target = ref.subPath
          ? join(pkgDir, ref.subPath)
          : join(pkgDir, "TREE.yaml");
        if (!existsSync(target))
          throw new Error(
            `module '${file.url}' resolved to '${target}' but the file does not exist`,
          );
        urlToPkgDir.set(file.url, pkgDir);
        return await readFile(target);
      } catch (err) {
        if (err instanceof ResolverError) throw err;
        throw new ResolverError(err as Error, file.url);
      }
    },
  };
}
```

Notes:
- **Order: 200, not 1.** The library's built-in file resolver (`order: 100`) matches any URL without a `://`-style protocol — including our single-colon `node-modules:bt-retry`. When two resolvers both `canRead`, the library runs them in order and propagates the *last* error. If our resolver runs first (low order) and throws, the file resolver runs next, tries to open `node-modules:bt-retry` as a real path, fails with ENOENT, and that ENOENT message overshadows ours. Running at `order: 200` puts us last, so when both resolvers reject, our message is what reaches the user. The file resolver still runs first, but its ENOENT is silently swallowed in favour of our message.
- `ResolverError` wrapping ensures the library's pass-through branch fires; a plain `Error` would be re-wrapped with `err.message` undefined and our message lost.
- `findNodeModulesPkg` is O(depth) from `startDir`; for typical layouts (`<repo>/.abtree/trees/<slug>/TREE.yaml`) it terminates in 3–5 stat calls.
- The "not found" message intentionally enumerates all three install verbs rather than picking one. abtree is package-manager-neutral.
- The "file does not exist" message is distinct from the "not found" message: a present `node_modules/<pkg>/` with a missing sub-path indicates a typo in the `$ref` sub-path or a missing file in the package, not a missing install. Surfacing the resolved path helps the user fix the typo.

### Parser (`src/deps/parse.ts`)

```ts
export interface NodeModulesRef { pkgName: string; subPath?: string; }
export function parseNodeModulesRef(url: string): NodeModulesRef;
```

Rules:
1. Must start with `node-modules:`; body (everything after) must be non-empty.
2. If the body starts with `@`:
   - Find the first `/`. The package name is `@<scope>/<name>` where `<name>` is everything up to the second `/` (or end-of-body).
   - Sub-path is whatever follows the second `/`, if any.
   - The body must contain at least one `/` after the `@` (otherwise the scope has no name half — error).
3. Otherwise (bare name):
   - Find the first `/`. Everything before is the package name; everything after is the sub-path.
   - The package name half must be non-empty.
4. Each segment of the package name (the scope, the name, or the bare name) must match `/^[a-z0-9][a-z0-9._-]*$/`. Standard npm package-name rules, simplified to lowercase only.

Examples:
- `node-modules:bt-retry` → `{ pkgName: "bt-retry" }`
- `node-modules:bt-retry/fragments/x.yaml` → `{ pkgName: "bt-retry", subPath: "fragments/x.yaml" }`
- `node-modules:@acme/bt-retry` → `{ pkgName: "@acme/bt-retry" }`
- `node-modules:@acme/bt-retry/fragments/x.yaml` → `{ pkgName: "@acme/bt-retry", subPath: "fragments/x.yaml" }`

Rejection examples (all throw `invalid module ref '<url>': <reason>`):
- `node-modules:` → `missing package name`
- `node-modules:@acme` → `scoped package missing the name half (expected @scope/name)`
- `node-modules:Bad_Name` → `package name 'Bad_Name' violates npm naming rules`
- `node-modules:-bad` → `package name '-bad' violates npm naming rules (must start with [a-z0-9])`

### Schema / validation

**No** schema changes. The existing TREE.yaml schema and `tree.schema.json` are unchanged. A `node-modules:` ref is a string like any other `$ref`, validated at resolution time by the resolver, not by the schema.

Eager validation (scanning TREE.yaml strings for `node-modules:` substrings and checking `node_modules/<pkg>/` existence at validate time, before `loadTree` runs) is **explicitly out of scope for v1**. The resolution-time error path already names the right install verbs and is fast enough.

### Error surface

Every distinct failure produces a stable, exact message. Acceptance criteria assert these strings verbatim.

| Failure | Message | Thrown from |
|---|---|---|
| Body empty after scheme | `invalid module ref 'node-modules:': missing package name` | `parseNodeModulesRef` |
| Scoped package missing name half | `invalid module ref '<url>': scoped package missing the name half (expected @scope/name)` | `parseNodeModulesRef` |
| Segment fails npm name regex | `invalid module ref '<url>': package name '<name>' violates npm naming rules` | `parseNodeModulesRef` |
| Package not in `node_modules/` walking up | `module '<url>' not found in node_modules/; run 'npm install' / 'pnpm install' / 'bun install'` | resolver `read` |
| Sub-path or `TREE.yaml` file missing inside present package | `module '<url>' resolved to '<absolute-path>' but the file does not exist` | resolver `read` |

The "not found" message lists all three install verbs in a stable order (`npm` / `pnpm` / `bun`) so log greps and CI checks can match it deterministically.

## Affected Systems

- `src/tree.ts` — add the `resolve: { "node-modules": makeNodeModulesResolver(yamlPath) }` option to the existing `$RefParser.dereference` call. Plus one import.
- New `src/deps/` directory: `parse.ts`, `resolve.ts`, `types.ts`. ~150 lines total.
- `src/types.ts` — re-export `NodeModulesRef` from `src/deps/types.ts`.
- `docs/guide/fragments.md` — append a "Cross-repo refs (modules)" subsection showing the install workflow with npm/pnpm/bun.
- New `docs/guide/publishing-fragments.md` — short author-side guide on `package.json` + tagging.
- No new runtime dependencies. `@apidevtools/json-schema-ref-parser` is already in `package.json`. The resolver itself uses only `node:fs` / `node:path`, so it runs unchanged under node and bun.
- No CLI changes. No new commander subcommands.
- No `tree.schema.json` regeneration needed.
- Archive `plans/dependency-ref-resolver.md` and `plans/abtree-dependencies-cli-subcommand.md` to `plans/archive/` (create the directory) as part of landing this plan.

## Acceptance Criteria

- A TREE.yaml containing `$ref: "node-modules:@acme/bt-retry#/tree"` validates via the existing validator (no schema change needed).
- With `node_modules/@acme/bt-retry/TREE.yaml` populated by `bun add github:acme/bt-retry#v1.2.0` (project default manager), `abtree execution create <slug>` succeeds and inlines the package's tree under `#/tree`. CI also runs an integration test that pre-populates `node_modules/@acme/bt-retry/` via a `pnpm install` step in a tmp-dir fixture and asserts the same resolution — proving the resolver is package-manager-agnostic, not just bun-specific. `npm install` is not separately exercised in CI; it shares the same `node_modules/<pkg>/` layout as `bun install`, so passing `pnpm` covers the cross-manager claim.
- The same setup with `$ref: "node-modules:@acme/bt-retry/fragments/inner.yaml"` resolves the sub-file (no `TREE.yaml` convention applied).
- A `$ref` whose package is **not** in `node_modules/` fails with stderr containing the exact string `module 'node-modules:@acme/bt-retry' not found in node_modules/; run 'npm install' / 'pnpm install' / 'bun install'` and a non-zero exit code.
- A `$ref` whose package **is** in `node_modules/` but whose sub-path doesn't exist fails with stderr matching the regex `module 'node-modules:@acme/bt-retry/missing\.yaml' resolved to '.*node_modules/@acme/bt-retry/missing\.yaml' but the file does not exist` and a non-zero exit code.
- Unit test: `parseNodeModulesRef("node-modules:@acme/bt-retry/fragments/x.yaml")` returns `{ pkgName: "@acme/bt-retry", subPath: "fragments/x.yaml" }`.
- Unit test: `parseNodeModulesRef("node-modules:bt-retry")` returns `{ pkgName: "bt-retry" }` (no sub-path).
- Unit test: `parseNodeModulesRef("node-modules:")` throws with message exactly equal to `invalid module ref 'node-modules:': missing package name`.
- Unit test: `parseNodeModulesRef("node-modules:@acme")` throws with message exactly equal to `invalid module ref 'node-modules:@acme': scoped package missing the name half (expected @scope/name)`.
- Unit test: `parseNodeModulesRef("node-modules:Bad_Name")` throws with message exactly equal to `invalid module ref 'node-modules:Bad_Name': package name 'Bad_Name' violates npm naming rules`.
- Unit test: `findNodeModulesPkg` walks up from a deep starting dir and returns the first matching `node_modules/<pkg>/`; returns `null` when none exists. Verified with a tmp-dir fixture.
- Integration test (transitive, nested `node_modules/`): if `node_modules/@acme/parent/TREE.yaml` contains `$ref: "node-modules:@acme/child#/tree"`, and `@acme/child` is installed at `node_modules/@acme/parent/node_modules/@acme/child/TREE.yaml` (the nested layout any manager produces on version conflict), the transitive resolves to the nested copy.
- Integration test (transitive, hoisted): same setup but `@acme/child` only at top-level `node_modules/@acme/child/`. Resolves through walk-up.
- Integration test (nearest wins): both nested and hoisted copies of `@acme/child` exist; nested takes precedence.
- Regression: the existing test suite (`bun test`) passes with zero diff after this change. Trees using only path-based and `https://` refs validate, snapshot, and tick byte-identically.
- Documentation: `docs/guide/fragments.md` has a new "Cross-repo refs (modules)" subsection that shows the install command with all three managers and the resulting `$ref` syntax. `docs/guide/publishing-fragments.md` exists and walks through publishing a fragment package (one-page max).

## Risks & Considerations

- **Fragment authors must publish `package.json`.** A repo that's purely YAML can't be installed by any package manager without a `package.json` declaring a name. This is a one-line `package.json` requirement on the publisher side. Documented in `publishing-fragments.md`.
- **Package name ≠ repo name.** Users have to know the package's `name` field (from `package.json`) to write the `$ref`, not the GitHub repo name. This matches npm convention but can confuse first-time users. Mitigation: a future `abtree deps list` verb (out of scope here) could read `package.json`'s `dependencies` and print each name.
- **No `--check` drift mode in v1.** The superseded CLI plan had `abtree dependencies install --check` for CI. Each manager has its own equivalent: `npm ci`, `pnpm install --frozen-lockfile`, `bun install --frozen-lockfile` (each fails if the lockfile doesn't match `package.json`). Documented in the guide.
- **No version visibility at the `$ref` site.** Reader has to check `package.json` to know which version `node-modules:@acme/bt-retry` resolves to. Same trade-off as npm convention.
- **Yarn berry PnP is not supported.** Yarn 2+ with `nodeLinker: pnp` skips `node_modules/` entirely and serves packages from `.zip` archives via a runtime resolver. The walk-up approach finds nothing under PnP. Yarn berry users must set `nodeLinker: node-modules` in `.yarnrc.yml` for abtree's resolver to work. Documented limitation.
- **pnpm isolated mode uses symlinks.** pnpm's default mode places real package contents at `node_modules/.pnpm/<name>@<ver>/node_modules/<name>/` and creates a symlink at `node_modules/<name>` pointing at that location. `existsSync` and `readFile` follow symlinks transparently, so the walk-up rule finds the symlink at the expected path and reads through it. No special handling needed. Verified in the pnpm CI integration test described in Acceptance Criteria.
- **`@apidevtools/json-schema-ref-parser` URL handling forced the scheme to opaque-URI form.** As detailed in the Summary's scheme-name note, the library's URL parsing rules made `node_modules://` unusable. The hyphenated single-colon `node-modules:` form is the workaround. If the library's parsing behaviour changes in a future major version (e.g. exposing an option to disable URL normalization), we could revisit and offer the `node_modules://` alias — but this is a non-blocking future concern, not a v1 requirement.
- **Loss of opinion on selectors.** The superseded plans rejected `branch:` and `semver:` selectors at parse time for reproducibility. With the package manager owning install, abtree no longer has a say; users can install from `#main` if they want. The lockfile still pins the commit for frozen-install workflows, but the spec is fragile to upstream branch movement. Mitigation: a docs note recommending tags or commit pins.
- **`package.json`'s `exports` field is ignored.** `node-modules:` resolves to filesystem paths directly, bypassing any `exports`/`imports` map in the fragment's `package.json`. For YAML-only packages this is fine, but a future enhancement could honor `exports`.
- **Missing `package.json` at project root produces the standard not-found message.** If the consumer's project has no `node_modules/` (because no `package.json` exists), the walk-up returns `null` and the user sees `module '...' not found in node_modules/; run 'npm install' / 'pnpm install' / 'bun install'`. The message names the right verbs regardless — if there's no `package.json`, running `npm init -y` first is the user's responsibility, and the error already points at the install verbs which fail loudly without a `package.json`. Not worth a special case.

## Open Questions

None. The three questions from the draft are resolved:

1. **Supersession**: confirmed — this plan replaces `plans/dependency-ref-resolver.md` and `plans/abtree-dependencies-cli-subcommand.md`, which move to `plans/archive/`.
2. **Scheme name**: `node-modules:` (single colon, hyphen). Decided. Two alternatives ruled out: (a) the user's original `node_modules://` is invalid per RFC 3986 (underscores not allowed in scheme names) and additionally loses `@scope` prefixes to WHATWG URL userinfo parsing — both blockers reproduced in a fixture test. (b) the bare-specifier alternative (`$ref: "@acme/bt-retry"`) is rejected because ref-parser interprets non-URL strings as relative file paths, which would silently break existing path-based refs.
3. **Missing `package.json` at project root**: no special case. The generic "not found in node_modules/" message already names `npm install` / `pnpm install` / `bun install`, all of which fail loudly with a clear error if `package.json` is missing — the user gets a useful error path either way without resolver-side code.
