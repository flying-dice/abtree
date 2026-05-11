---
id: 20260511T1700-eager-pipeline-publish
title: Publish @abtree trees and DSL to npm
status: refined
author: Jonathan Turnock
created: 2026-05-11
reviewed_by: Jonathan Turnock
---

## Summary

Wire every tree under `trees/*` and the `@abtree/dsl` package for public publication to the npm registry under the `@abtree` scope, authenticated via a classic Automation token in GitLab CI. Folds in the delta audit (publishConfig, prepublishOnly, tree.svg packaging, repository.directory provenance, private-flag on internal packages, versioning model, workspace-protocol rewriting, CI publish loop). OIDC trusted publishing was considered and rejected because `bun publish` doesn't yet implement the OIDC token-exchange flow; we trade short-lived tokens for a working pipeline today and revisit once bun catches up.

## Requirements

- Every tree under `trees/*` resolves on npm as `@abtree/<name>` (`hello-world`, `implement`, `improve-codebase`, `improve-tree`, `refine-plan`, `srp-refactor`, `technical-writer`, `test-tree`), plus `@abtree/dsl` (publishable; consumers need it to author trees with the DSL).
- Each published tarball contains `package.json`, `main.json`, `README.md`, `tree.svg`, plus any tree-specific assets already declared in `files` (`clean-code.md` for `implement`; `fragments/code-review.md` and `tests/` for `srp-refactor`). The DSL ships `src/` and `README.md` only.
- The CI release job authenticates with a classic npm Automation token stored as `NPM_TOKEN` in GitLab CI/CD variables (Protected + Masked).
- Internal packages (`@abtree/cli`, `@abtree/runtime`) carry `"private": true` and cannot be accidentally published.
- The release pipeline publishes all nine packages (1 DSL + 8 trees) on every release with a shared version (Option A) — see versioning decision below.
- `srp-refactor`'s `workspace:*` devDep on `@abtree/test-tree` is rewritten to a concrete version in the published tarball.

## Technical Approach

### Phase 1 — per-tree `package.json` hardening

For each `trees/<name>/package.json`:

1. Add `"publishConfig": { "access": "public" }`. Scoped packages default to paid-private — without this, `npm publish` exits 402.
2. Add `"prepublishOnly": "bun run build"` to the scripts block. Ensures `main.json` is fresh in the tarball regardless of working-tree state.
3. Add `"tree.svg"` to the `files` array (currently every tree omits it — the README references `./tree.svg` and npmjs.com renders the README, so the asset must ship).
4. Add a `repository` block with `directory` so npm + GitHub link the package page to the correct subdirectory:
   ```json
   "repository": {
     "type": "git",
     "url": "git+https://github.com/flying-dice/abtree.git",
     "directory": "trees/<name>"
   }
   ```
5. Add `"homepage": "https://github.com/flying-dice/abtree/tree/main/trees/<name>"` — points the npm "Homepage" link at the tree's own README in the monorepo, which is more useful than a generic registry index.

### Phase 2 — mark internal packages private

For `packages/cli/package.json`, `packages/runtime/package.json`, `packages/dsl/package.json`: add `"private": true`. These are workspace-only build dependencies for the trees; consumers never install them. The `private` flag makes any future `bun publish` from those directories a no-op rather than an accidental scope pollution.

### Phase 3 — pick a versioning model

**Decision: Option A — shared version across all trees, one release pipeline.**

Reasoning: zero consumers today, no cadence-divergence evidence yet, and the sole-maintainer cost of Option B (per-tree `.releaserc`, conventional-commit scopes per tree, `multi-semantic-release` setup, tag-collision handling) is real overhead with no current payoff. Option A matches the existing single-`.releaserc` setup, ships an afternoon's work, and can be revisited the first time cadence divergence actually bites. If `hello-world` ships a no-op version because `improve-codebase` changed — the worst case is a lockfile churn line for early consumers, easily reverted by switching to B later.

Concretely:
- Keep the existing root `.releaserc` as the single source of truth.
- Add an `@semantic-release/exec` step that, on `prepareCmd`, syncs the next computed version into every `trees/<name>/package.json`, then loops through `trees/*` running `bun publish --access=public` per tree. `bun publish` (not `npm publish`) is what handles the `workspace:*` → concrete-version rewrite inside the tarball.
- One git tag per release (`v<version>`), tagged at the repo root — no per-tree tags.

### Phase 4 — GitLab CI publish job

Update `.gitlab-ci.yml`:

1. Extend the existing `release` job rather than adding a new one — single pipeline, single trigger.
2. Write a `.npmrc` in `before_script` that references the `NPM_TOKEN` env var. `bun publish` reads from this file:
   ```yaml
   release:
     extends: .bun
     stage: release
     rules:
       - if: $CI_COMMIT_BRANCH == "main"
         when: manual
         allow_failure: true
       - when: never
     before_script:
       - apt-get update -qq && apt-get install -y -qq git ca-certificates
       - git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/flying-dice/abtree.git"
       - git config --global user.email "semantic-release@abtree"
       - git config --global user.name "semantic-release"
       - bun install --frozen-lockfile
       - echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
     script:
       - bunx semantic-release
   ```
3. The publish loop runs inside `publishCmd` of `@semantic-release/exec` in `.releaserc`. DSL publishes first so trees' devDep on `@abtree/dsl@<version>` resolves cleanly:
   ```bash
   set -e; (cd packages/dsl && bun publish --access=public); for d in trees/*/; do (cd "$d" && bun publish --access=public); done
   ```

### Phase 5 — one-time npmjs.com setup

1. Register the `@abtree` scope on the npm account (one-time, scope-level not package-level).
2. Disable the 2FA-required-for-publishing setting on the account or scope — the Automation token in step 3 cannot satisfy a 2FA prompt, and we are explicitly accepting that trade today.
3. Create an **Automation** token at `npmjs.com/settings/<user>/tokens` with publish rights to the `@abtree` scope. Automation tokens bypass 2FA (with the setting from step 2) and are the right shape for headless CI.
4. Store the token in GitLab at **Settings → CI/CD → Variables** as `NPM_TOKEN`, with **Protected** (only exposed to protected branches/tags — i.e. `main`) and **Masked** (redacted in job logs) both ticked.
5. Bootstrap-publish each package once from a developer machine so npm registers the package name under the scope: `cd packages/dsl && bun publish --access=public`, then `cd trees/<name> && bun publish --access=public` for each tree. After this, the CI job takes over.
6. Rotate `NPM_TOKEN` on a calendar reminder (90 days is a common cadence).

### Phase 6 — verification

1. `bun pm pack` inside `trees/srp-refactor` and inspect the tarball's `package.json` to confirm `@abtree/test-tree` resolved from `workspace:*` to a concrete version like `1.2.0`.
2. After CI publish, `npm view @abtree/<name>` for each package confirms the metadata and version.
3. `bun add @abtree/hello-world` in a scratch project — check `node_modules/@abtree/hello-world/` contains `main.json` and `tree.svg`.
4. Job log shows the token in the `.npmrc` write line is masked (`****`), confirming the masked CI variable is working.

## Affected Systems

- `trees/{hello-world,implement,improve-codebase,improve-tree,refine-plan,srp-refactor,technical-writer,test-tree}/package.json` — publishConfig, prepublishOnly, files, repository, homepage.
- `packages/dsl/package.json` — same publishing fields as the trees (DSL is published).
- `packages/{cli,runtime}/package.json` — `"private": true`.
- `.releaserc` — extend `prepareCmd` with the version-sync step (across trees + DSL) and add `publishCmd` with the DSL-first publish loop.
- `.gitlab-ci.yml` — write `.npmrc` from `NPM_TOKEN` in the existing `release` job's `before_script`.
- npmjs.com — scope registration, 2FA-for-publishing disabled, Automation token issued, bootstrap publish per package (out-of-band, not in this repo).
- GitLab CI/CD Variables — `NPM_TOKEN` added (Protected + Masked).

## Acceptance Criteria

- Running the manual `release` job in GitLab CI on `main` publishes every `@abtree/<name>` package at the new shared version. Confirmed by job log + `npm view @abtree/<name> version` for each.
- `bun add @abtree/hello-world` in a fresh project resolves the tarball; the package directory contains `main.json` and `tree.svg`.
- `bun pm pack` inside `trees/srp-refactor` produces a tarball whose `package.json` shows `@abtree/test-tree` as a concrete version (no `workspace:*`).
- Job log shows `NPM_TOKEN` masked (`****`) anywhere it would appear; the `.npmrc` write line is the only place the variable is referenced.
- `cd packages/cli && bun publish --dry-run` (and same for `packages/runtime`) refuses with a `private` rejection. `packages/dsl` does publish.

## Risks & Considerations

- **Long-lived token is the auth surface.** `NPM_TOKEN` is a static secret in GitLab. Leak risk is structural: anyone with maintainer access to the GitLab project can read it (when not Protected) or run a job that prints it before masking. Mitigations: Protected + Masked variable, scope the token to publish-only (not full account), rotate on a 90-day calendar reminder, and revisit OIDC trusted publishing once `bun publish` supports it.
- **2FA-for-publishing is disabled on the account.** Required for Automation tokens to work headlessly. Accept this as the cost of token auth. If the account becomes a publish target for other packages outside `@abtree`, scope the token narrowly (`@abtree:read+write`) and revisit.
- **Partial-failure mid-loop.** If `bun publish` fails on package N of 9, packages 1..N-1 are already on npm at the new version. The next CI run computes the same next-version and tries to republish — npm rejects duplicate versions. Mitigation today: `set -e` halts the loop, and the recovery procedure is to bump the version manually (`npm version patch` at the root + propagate via the prepareCmd sed) before retriggering. Documented; not automated. Trigger to automate: first time it bites.
- **Option A version churn.** Doc-only fix to one tree bumps every tree's published version. Acceptable today (zero consumers); becomes a real cost the moment external lockfiles depend on the trees. Trigger to revisit: first external consumer reports a "noop bump" complaint.
- **README relative links.** `![tree](./tree.svg)` resolves on npmjs.com only if `tree.svg` is in `files`. Packaging it (Phase 1.3) covers this; eyeball the rendered page on the first publish to confirm.
- **DSL ships as `.ts` source.** Consumers without a TypeScript loader (plain `node` < 22.5 with no flags) will fail at import time. Acceptable v1 — abtree positions itself as a bun-first project — but document in the DSL README and consider an `engines` constraint.

## Open Questions

None requiring codeowner input — this is a sole-maintainer repo (no CODEOWNERS file). Decisions taken: versioning model (Option A, shared version), auth model (Automation token over OIDC because `bun publish` does not implement npm's OIDC trusted-publishing flow yet). Ready for self-approval.
