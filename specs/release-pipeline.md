---
id: 1778362006-gitlab-ci-three-stage-pipeline
title: Release Pipeline
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

GitLab CI runs three stages on every push (`check` → `test` → `release`); semantic-release is gated to `main` and runs only after lint and test pass. Cross-platform binaries are built via `bun build --compile` for five targets (Linux x64, Linux ARM64, macOS x64, macOS ARM64, Windows x64) and published to the GitHub mirror's release page alongside install scripts and the SKILL.md asset.

## Requirements

- Pipeline runs on every push and every merge request.
- Three stages: `check` (biome lint + format), `test` (bun test), `release` (semantic-release).
- The `release` stage runs only when `$CI_COMMIT_BRANCH == "main"`, only after `check` and `test` succeed.
- semantic-release reads conventional-commit messages on `main` to decide whether a release is warranted; if so it bumps the version, builds binaries, generates release notes, and publishes the release on GitHub.
- Five binaries: `abtree-linux-x64`, `abtree-linux-arm64`, `abtree-darwin-x64`, `abtree-darwin-arm64`, `abtree-windows-x64.exe`.
- Two install scripts ship as release assets: `install.sh` (Linux + macOS) and `install.ps1` (Windows). Both detect platform / arch and pull the matching binary from the latest release.
- The `SKILL.md` bundled with the binary also ships as a standalone release asset for users who want to install only the skill without the CLI.

## Technical Approach

### `.gitlab-ci.yml` shape

```yaml
stages: [check, test, release]

.bun:
  image: oven/bun:latest
  before_script:
    - bun install --frozen-lockfile

biome:
  extends: .bun
  stage: check
  script:
    - bunx biome ci .

test:
  extends: .bun
  stage: test
  script:
    - bun test

release:
  extends: .bun
  stage: release
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: on_success
    - when: never
  before_script:
    - apt-get update -qq && apt-get install -y -qq git ca-certificates
    - git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/flying-dice/abtree.git"
    - git config --global user.email "semantic-release@abtree"
    - git config --global user.name "semantic-release"
    - bun install --frozen-lockfile
  script:
    - bunx semantic-release
```

### `.releaserc`

```json
{
  "branches": ["main"],
  "repositoryUrl": "https://github.com/flying-dice/abtree.git",
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/npm", { "npmPublish": false }],
    ["@semantic-release/exec", {
      "prepareCmd": "bun build --compile --target=bun-linux-x64 ... && ..."
    }],
    ["@semantic-release/github", {
      "assets": [
        { "path": "abtree-linux-x64" },
        ...,
        { "path": "install.sh" },
        { "path": "install.ps1" },
        { "path": "SKILL.md" }
      ]
    }]
  ]
}
```

`@semantic-release/git` is intentionally **not** included. The push mirror force-pushes from GitLab to GitHub; any commit semantic-release pushed to GitHub via that plugin would be wiped on the next mirror sync. Skipping it leaves `package.json.version` at `0.0.0` in the repo — only git tags track the version, which is fine.

### Cross-platform binary build

`@semantic-release/exec`'s `prepareCmd` chains five `bun build --compile --target=<target>` invocations:

```sh
bun build --compile --target=bun-linux-x64    index.ts --outfile=abtree-linux-x64    && \
bun build --compile --target=bun-linux-arm64  index.ts --outfile=abtree-linux-arm64  && \
bun build --compile --target=bun-darwin-x64   index.ts --outfile=abtree-darwin-x64   && \
bun build --compile --target=bun-darwin-arm64 index.ts --outfile=abtree-darwin-arm64 && \
bun build --compile --target=bun-windows-x64  index.ts --outfile=abtree-windows-x64.exe
```

All five build cleanly from a Linux runner — Bun does the cross-compilation. Each binary embeds `AGENT.md` and `SKILL.md` via Bun's `with { type: "text" }` import.

### Install scripts

`install.sh`:
- `uname -s` / `uname -m` → resolve `linux | darwin` and `x64 | arm64`.
- Curl `https://github.com/flying-dice/abtree/releases/latest/download/abtree-${OS}-${ARCH}` → `/tmp/abtree`.
- `chmod +x` and move to `${INSTALL_DIR:-/usr/local/bin}/abtree`. Sudo if the install dir isn't writable.

`install.ps1`:
- Hardcoded to Windows x64 (no ARM64 build for Windows yet).
- `Invoke-WebRequest` → `$env:USERPROFILE\.local\bin\abtree.exe`.
- Patches the user's `PATH` if the install dir isn't already there.

### Mirror architecture

GitLab is the source-of-truth repo (private, self-hosted). A push mirror force-syncs to GitHub. semantic-release runs on the GitLab side using a `GITHUB_TOKEN` to talk to the GitHub API for release creation; it doesn't push back to GitHub via git — the mirror handles that.

The mirror has `keep_divergent_refs: true`, so tags semantic-release creates on GitHub via the API survive the next mirror sync (they're not in GitLab so the mirror doesn't try to overwrite them).

### Two CI/CD variables required on the GitLab project

| Key | Scope | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | Masked, Protected | GitHub PAT with `repo` scope. Used by `@semantic-release/github` for release creation; same token rewrites `origin` to push tags via the API. |
| (mirror URL credential) | n/a | The push mirror in `Settings → Repository → Mirroring repositories` carries its own embedded token. |

## Affected Systems

- `.gitlab-ci.yml` — three-stage pipeline.
- `.releaserc` — semantic-release config.
- `install.sh` / `install.ps1` — repo root.
- `package.json` — `release` script and semantic-release devDependencies.
- `bun-env.d.ts` — declares `*.md` text imports so AGENT.md / SKILL.md compile cleanly.

## Acceptance Criteria

- A push of a `chore(...)` commit triggers `biome` + `test` + `release`; release exits cleanly with "no new release" since `chore` doesn't bump the version.
- A push of a `feat(...)` commit produces a new release tag, generates release notes, builds five binaries, and uploads them + install scripts + SKILL.md as release assets.
- A push of a `fix(...)` commit produces a patch-level release.
- biome failures (lint or format) fail the `check` stage and block release.
- bun test failures fail the `test` stage and block release.
- The latest release page at `github.com/flying-dice/abtree/releases/latest` always lists the eight expected assets.
- `curl -fsSL .../latest/download/install.sh | sh` installs a working `abtree` binary.

## Risks & Considerations

- **`GITHUB_TOKEN` rotation.** The token used by both the mirror and the release stage is a single PAT. Rotating it requires updating the GitLab CI variable AND the mirror URL. Documented in operational runbook (or should be).
- **Bun cross-compilation correctness.** The Linux runner builds Darwin and Windows binaries. Bun's cross-compilation is well-supported but a regression in the toolchain would mean a release ships untested binaries. Mitigation: smoke-test the Linux binary (which the runner can execute) on every release; the others are tested manually as needed.
- **Five binaries, no smoke test for non-Linux.** Listed risk; current trade-off is that GitLab runners are Linux-only, and we don't pay for Mac/Windows runners. Acceptable for a small CLI.
- **No npm publish.** `@semantic-release/npm` is in the chain only for version bumping (`npmPublish: false`). The CLI is distributed via the install scripts + raw binaries, not npm. Documented; switching to npm publishing would require declaring the package public and writing a node-compatible entry point.
- **Mirror force-push wipes branches but not tags** (with `keep_divergent_refs: true`). Branches must always originate from GitLab; tags can be created on either side and survive.

## Open Questions

- Should we add a Windows ARM64 binary build? Bun supports it now. Low immediate demand; defer.
- Should we add a smoke-test stage that downloads each binary asset and runs `--version` post-release? Would catch upload failures or wrong-architecture binaries. Useful but not yet implemented.
