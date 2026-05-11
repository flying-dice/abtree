---
description: Install a published abtree workflow and drive it with your agent of choice. Covers prerequisites, per-repo vs global install, the skill prompt, and how to run the workflow once installed.
---

# Using a tree

Every published [abtree](https://abtree.sh) workflow installs and runs the same way. This page is the canonical reference — individual tree READMEs link here instead of duplicating it.

## Prerequisites

Install these on your `PATH`:

- **abtree CLI** — see [Getting started](/getting-started) for one-liner installers (macOS, Linux, Windows).
- **An agent.** abtree is agent-agnostic. Examples on this site use [Claude Code](https://docs.claude.com/claude-code), but any LLM agent that can run shell commands works.
- **A node package manager** — [Bun](https://bun.sh), [pnpm](https://pnpm.io), or [npm](https://www.npmjs.com).

## Install the abtree skill

The skill is the prompt template that teaches your agent how to drive an abtree execution. If you kick off a workflow and the agent doesn't seem to know what to do, the skill is missing:

```sh
abtree install skill
```

You only need to do this once per agent setup, not per tree.

## Install the tree

Choose one of two options. Either way, the tree lands as a node package — abtree finds it by path or by slug at execution time.

### Option A — per-repo (recommended)

In the repository you want to run the workflow against:

```sh
npm  install --save-dev <pkg>
pnpm add        -D       <pkg>
bun  add        --dev    <pkg>
```

The tree lands at `./node_modules/<pkg>/`. It's a dev-time tool — nothing ships in your runtime bundle.

### Option B — global

Install once, run from any repository:

```sh
npm  install -g <pkg>
pnpm add     -g <pkg>
bun  add     -g <pkg>
```

The tree lands at `$(npm root -g)/<pkg>/` (use `pnpm root -g` or `bun pm -g bin` for those managers).

### Pinning a version

Pin an npm version for byte-stable resolution across machines:

```sh
bun add <pkg>@1.2.0
```

For full reproducibility, commit your lockfile (`package-lock.json` / `pnpm-lock.yaml` / `bun.lock`).

### Installing from sources other than npm

The commands above resolve `<pkg>` from the npm registry — the default for any published tree. If you're consuming a tree that isn't published to npm (a private fork, an unpublished prototype, a local tarball), every supported package manager already documents the other source forms. A few useful ones:

- **Git** — `<manager> add github:<owner>/<repo>` (also `gitlab:`, `bitbucket:`, or a raw `git+ssh://…` / `git+https://…` URL). Pin with `#v1.2.0` or `#commit:<sha>`.
- **Local tarball** — `<manager> add ./path/to/tree-1.2.0.tgz` (output of `npm pack`).
- **Local directory** — `<manager> add ./path/to/tree-source-dir` (or `link:` for a symlink).
- **HTTPS tarball** — `<manager> add https://example.com/tree-1.2.0.tgz`.

For the exact syntax your package manager supports, see the manager's `add`/`install` reference: [npm install](https://docs.npmjs.com/cli/v10/commands/npm-install), [pnpm add](https://pnpm.io/cli/add), [bun add](https://bun.sh/docs/cli/add).

## Run the workflow

Hand a brief to your agent. The exact phrasing doesn't matter — the agent reads the skill, calls `abtree --help`, and figures out the protocol from there:

```sh
# Option A — per-repo install
claude 'Using the abtree cli, run the tree ./node_modules/<pkg>'

# Option B — global install
claude "Using the abtree cli, run the tree $(npm root -g)/<pkg>"
```

The agent walks the tree and persists state to a new `.abtree/` directory at the repo root. Gitignore it, or commit it if you want shareable run history.

## What gets written

Every execution writes the same three artefacts at the repo root:

| Path | Purpose |
|---|---|
| `.abtree/executions/<id>.json` | Full execution document — input, output, every state mutation |
| `.abtree/executions/<id>.mermaid` | Live mermaid diagram of the run, regenerated on every state change |
| `.abtree/executions/<id>.svg` | Live SVG diagram of the run, same trigger |

Individual trees also write workflow-specific files (reports, plans, etc.) — see the tree's own README.

## Reference

- [abtree concepts](/concepts/) — what behaviour trees are and why
- [Writing trees](/guide/writing-trees) — author your own
- [Designing workflows](/guide/designing-workflows) — patterns for production workflows
- [Fragments](/guide/fragments) — splitting a large tree across files
- [Inspecting executions](/guide/inspecting-executions) — debugging a stuck or failed run
- [Execution protocol](/agents/execute) — what the agent does at each step
- [CLI reference](/guide/cli) — every command, every flag
