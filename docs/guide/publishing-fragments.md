# Publishing fragments

A fragment package is just a git repository with a `package.json` and a `TREE.yaml`. There's no abtree-specific publishing pipeline — you tag and push; consumers `bun add` / `pnpm add` / `npm install` from the tag.

## Layout

```
my-fragment-repo/
  package.json                 # { "name": "abtree_bt-retry", "version": "1.2.0", "main": "TREE.yaml" }
  TREE.yaml                    # the fragment's tree, in the usual abtree shape
  fragments/                   # optional, for sub-files referenced via sub-path
    inner.yaml
```

Two required `package.json` fields:

- **`name`** — the identifier consumers write in `$ref` strings (e.g. `node-modules:abtree_bt-retry`). Pick it with the same care as any npm package name.
- **`main`** — the YAML file that represents the package's default tree. abtree uses this when a consumer references the package without a sub-path (e.g. `abtree execution create ./node_modules/abtree_bt-retry` or `$ref: "node-modules:abtree_bt-retry#/tree"`). Conventionally `TREE.yaml`, but any path inside the package works.

If `main` is missing, abtree fails the run with an actionable error rather than guessing — so authors think about the entry point. Consumers can always pass a sub-path (`abtree execution create ./node_modules/<pkg>/<file>.yaml` or `$ref: "node-modules:<pkg>/<file>.yaml"`) to bypass `main`, but the supported default is to declare it.

## Cutting a release

```bash
git tag v1.2.0
git push --tags
```

That's it. No registry account is required for git-source consumption. Consumers install with:

```bash
bun add github:acme/bt-retry#v1.2.0     # tag
bun add github:acme/bt-retry#commit:<40-hex-sha>  # commit pin (most reproducible)
```

A consumer pinning a commit (or relying on a frozen lockfile after a tag-based install) gets byte-stable resolution across machines. A consumer pinning a moving ref like `#main` will pick up whatever `main` happens to be at install time — usable for development, fragile for production.

## Versioning

Tags are the unit of distribution. Pick a scheme that's meaningful to your consumers — semantic versioning is the obvious default, but anything that orders and identifies releases works.

If you also publish to a registry, range selectors like `^1.2.0` start working — the package manager resolves the range against the registry's published versions. Git-source consumers get exactly the commit they ask for, no resolution step.

## Sub-files

Anything under the package root is reachable via a sub-path in the ref:

```yaml
$ref: "node-modules:@acme/bt-retry/fragments/inner.yaml"
```

No `TREE.yaml` convention applies — the sub-path is used verbatim. This lets you ship a package that's a bundle of related fragments rather than a single tree.

## What you can rely on

- The resolver walks up `node_modules/` from the referring file using standard node resolution rules. Nested `node_modules/` shadow hoisted copies (nearest wins).
- pnpm's symlinked layout works transparently — symlinks are followed by the underlying `fs` calls.
- The `package.json` `exports` field is **not** consulted — module refs resolve to filesystem paths directly. Anything inside the published package is reachable; sub-path import maps aren't supported in v1.
- Yarn berry's PnP mode (no `node_modules/`) is not supported; set `nodeLinker: node-modules` in `.yarnrc.yml` if you need it.
