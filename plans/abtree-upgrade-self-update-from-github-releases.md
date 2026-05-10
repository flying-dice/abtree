---
id: 1778412133-resilient-binary-upgrade
title: abtree upgrade — self-update from GitHub releases
status: accepted
author: Starscream
created: 2026-05-10
reviewed_by: Shockwave
---

## Summary

Add an `abtree upgrade` subcommand that resolves the latest GitHub release of `flying-dice/abtree`, downloads the asset matching the running OS/arch, and atomically replaces the running binary. Mirrors the asset-naming and install-dir conventions of `install.sh` / `install.ps1`, but executes from inside the already-installed Bun-compiled binary so users do not have to re-curl the install script.

## Requirements

- Command surface: `abtree upgrade [--check] [--version <tag>] [--yes]`.
  - `--check` prints `current=vX.Y.Z latest=vA.B.C` and exits 0; never reads or writes the install path.
  - `--version <tag>` pins the target release (e.g. `v0.2.1`) and skips the latest-release lookup.
  - `--yes` skips the confirmation prompt.
  - When stdin is not a TTY and `--yes` is unset, the command proceeds without prompting (matches `install.sh`, which never prompts).
- Platform matrix matches `install.sh` / `install.ps1` exactly: `linux`/`darwin` × `x64`/`arm64`, plus `windows-x64`. OS-check failure prints `Unsupported OS: <name>` to stderr and exits non-zero; arch-check failure prints `Unsupported architecture: <name>` to stderr and exits non-zero. OS is checked first.
- Single source of truth for the current version: a `VERSION` constant exported from `src/version.ts`, sourced via `import pkg from "../package.json" with { type: "json" }`. Both `program.version()` and `cmdUpgrade` read from it.
- Latest version is resolved via `GET https://api.github.com/repos/flying-dice/abtree/releases/latest` with `User-Agent: abtree/<VERSION>` and `Accept: application/vnd.github+json`. The endpoint returns JSON; we read `tag_name`.
- Asset URL for an explicit tag `v1.2.3` is `https://github.com/flying-dice/abtree/releases/download/v1.2.3/<asset>`. Asset URL for "latest" is `https://github.com/flying-dice/abtree/releases/latest/download/<asset>` (matches `install.sh`).
- POSIX install: download to a sibling temp file inside the directory of `realpath(process.execPath)` (filename `abtree.<rand>.tmp`), `chmod 0o755`, then `rename(2)` over the running binary. The kernel keeps the running inode alive until process exit, so the in-flight `upgrade` invocation is safe.
- Windows install: rename the running `abtree.exe` to `abtree.exe.old` in-place, write the downloaded binary to the original path, then best-effort `unlink` the `.old` file. If the unlink fails (file in use), leave it; the next invocation cleans it up.
- `cmdUpgrade` always operates on `realpath(process.execPath)` so we never silently replace a symlink with a regular file. The resolved path is logged before any write.
- Before initiating any download, `cmdUpgrade` calls `access(dirname(realpathExec()), W_OK)`. If the directory is not writable, it constructs a representative temp path `<dir>/abtree.<pid>.tmp`, prints a copy-paste `sudo mv <tmp> <dest>` line, and exits 1. The binary itself never invokes `sudo`.
- If `current == latest` and `--version` is unset, print `abtree is up to date (vX.Y.Z)` and exit 0.
- Confirmation prompt (TTY, no `--yes`) prints exactly: `Upgrade abtree vX.Y.Z → vA.B.C? [y/N] `. Anything other than `y` / `Y` / `yes` aborts with exit 0.
- Exit codes: 0 success or no-op; 1 install failure (write/rename/permissions); 2 network or asset failure; 3 unsupported platform.

## Technical Approach

1. **`src/version.ts`** — exports `VERSION` from `package.json` via the JSON import above. Bun bundles JSON imports into compiled binaries; no build-time substitution needed. Replace the literal `"1.0.0"` in `index.ts`'s `program.version(...)` with this constant. The current `package.json` `version` of `0.0.0` is left untouched by this work; bumping it is a release-PR concern, not an upgrade-feature concern.

2. **`src/upgrade.ts`** — pure helpers, no `commander` coupling, each unit-testable:
   - `detectTarget(): { os, arch, asset, binName }` — reads `process.platform` and `process.arch`. Throws `Error("Unsupported OS: <name>")` or `Error("Unsupported architecture: <name>")` for unsupported pairs (OS first).
   - `fetchLatestTag(fetch?): Promise<string>` — GETs the GitHub releases API with the headers above, returns `tag_name`. The injected `fetch` parameter (default `globalThis.fetch`) makes mocking trivial in tests.
   - `compareVersions(a, b): -1 | 0 | 1` — parses `vMAJOR.MINOR.PATCH` (leading `v` stripped at parse), tuple-compares numerically. No prerelease support; if a tag fails to parse, throws.
   - `assetUrl(tag: string | "latest", asset: string): string` — builds the two URL forms described in Requirements.
   - `downloadAsset(url, destPath, fetch?): Promise<void>` — `fetch` with redirect-following, writes the response body to `destPath` via `Bun.write`. Verifies HTTP 200. If `Content-Length` is present and `< 1024`, rejects immediately as a CDN error page before writing. If `Content-Length` is absent (chunked transfer-encoding, which GitHub's CDN uses), completes the download and then validates the written byte count is `>= 1024`. On failure, removes any partial file and throws.
   - `installBinary(tmpPath: string, finalPath: string): void` — POSIX: `chmodSync(tmp, 0o755)` + `renameSync(tmp, final)`. Windows: `renameSync(final, final + ".old")`, `renameSync(tmp, final)`, `try { unlinkSync(final + ".old") } catch {}`.
   - `realpathExec(): string` — `realpathSync(process.execPath)`. Centralised so the prompt and the install both reference the same string.

3. **`src/commands.ts` — `cmdUpgrade(opts)`** — owns the user-facing console output, the prompt, and the orchestration. Entry sequence: `detectTarget` → `realpathExec` → `access(dirname, W_OK)` (exit 1 with `sudo mv <dir>/abtree.<pid>.tmp <dest>` if non-writable) → `fetchLatestTag` / version resolution → early-exit if up-to-date → confirmation prompt → `downloadAsset` to a random-suffixed temp file `abtree.<rand>.tmp` in `dirname(realpathExec())` → `installBinary`. Catches errors and maps them to the exit codes above.

4. **`index.ts`** — one `program.command("upgrade")` block registering `--check`, `--version <tag>`, `--yes`, calling `cmdUpgrade`. Replace `program.version("1.0.0")` with `program.version(VERSION)`.

5. **Tests in `tests/upgrade.test.ts`**:
   - `detectTarget` — five supported pairs return the expected asset filename; unsupported OS and unsupported arch throw with the expected messages. Mock `process.platform` / `process.arch` via `Object.defineProperty` for the duration of each case.
   - `compareVersions` — `-1`/`0`/`1` cases, leading-`v` tolerance, malformed tag throws.
   - `assetUrl` — both `"latest"` and explicit-tag forms.
   - `fetchLatestTag` — pass an injected `fetch` returning a stub `{ tag_name: "v1.2.3" }`; assert the returned tag and that the request used `User-Agent: abtree/<VERSION>` and the `Accept` header.
   - `downloadAsset` — injected `fetch` returns a 1500-byte body; assert the file is written. Second case: stub injects `Content-Length: 200` and a 200-byte body → throws with "asset too small". Third case: 404 → throws and leaves no file behind.
   - `installBinary` (POSIX path) — gated by `process.platform !== "win32"`. Creates a temp dir, writes a fake "current" binary and a fake "new" binary, calls `installBinary`, asserts the final file has mode `0o755` and the new contents.
   - `installBinary` (Windows path) — gated by `process.platform === "win32"`. Asserts the `.old` cleanup happens. CI must run on Windows to cover this; until then the path is exercised in manual smoke tests.

## Affected Systems

- `index.ts` — register `upgrade` subcommand; replace literal version string with `VERSION`.
- `src/commands.ts` — new `cmdUpgrade` handler.
- `src/upgrade.ts` — new module.
- `src/version.ts` — new module.
- `tests/upgrade.test.ts` — new test file.
- `README.md` — add an "Upgrading" section pointing at `abtree upgrade`.
- Unchanged but referenced for parity: `install.sh`, `install.ps1`, `scripts/build.ts`.

## Acceptance Criteria

- `abtree --version` and `abtree upgrade --check` print the same version string, both reading from `src/version.ts`.
- `abtree upgrade --check` against an outdated install prints `current=vX.Y.Z latest=vA.B.C`, exits 0, and does not touch the install path.
- `abtree upgrade --check` against a current install prints `abtree is up to date (vX.Y.Z)` and exits 0.
- `abtree upgrade` on Linux and macOS replaces `realpath(process.execPath)` in place; the next invocation reports the new version. Tested via `bun run scripts/build.ts` followed by an end-to-end run against an older release tag pinned via `--version`.
- `abtree upgrade` on Windows replaces `abtree.exe` and leaves no `abtree.exe.old` on the happy path. Smoke-tested manually until Windows CI exists.
- `abtree upgrade --version v0.0.1` (or any extant tag) downloads that exact release.
- Unsupported `(os, arch)` exits with code 3 and prints either `Unsupported OS: <name>` or `Unsupported architecture: <name>`.
- A non-writable install directory exits with code 1 and prints a `sudo mv <tmp> <dest>` line whose paths are valid.
- Network or asset failures (404, <1KB body, non-200 status) exit with code 2 and leave no partial file in the install directory.
- `bun test` passes including the new upgrade tests.
- A user running an outdated build sees the prompt `Upgrade abtree vX.Y.Z → vA.B.C? [y/N]` exactly.

## Risks & Considerations

- **GitHub unauthenticated rate limits** — 60 req/hr per IP. Acceptable for a CLI; the `User-Agent` header makes our traffic identifiable to GitHub. If a future use case hits the limit, the fallback is parsing the 302 `Location` header from `releases/latest/download/<asset>` to derive the tag without using the API. Not implemented in v1.
- **Windows self-replacement is fragile.** AV software, Explorer file locks, and OneDrive-synced bin directories can interrupt the rename dance. Documented failure mode: re-run `install.ps1`. No retry logic in v1.
- **No checksum verification.** GitHub releases do not currently publish a checksum file. v1 trusts HTTPS + GitHub. Adding `SHA256SUMS` to the release workflow is a tracked follow-up.
- **No rollback.** If the new binary is broken, the user re-runs `install.sh`. Same recovery path as today; no new failure mode introduced.
- **Windows test path is gated** — until CI gains a Windows runner, the Windows branch of `installBinary` is covered only by manual smoke tests. Tracked as a follow-up; not blocking v1.
- **Project memory: no backwards compatibility.** abtree is pre-release with no shipped consumers; nothing in this design needs migration logic or compatibility shims.

## Open Questions

(none — all prior open questions resolved into committed decisions above.)
