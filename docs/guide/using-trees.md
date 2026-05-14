---
title: Use a tree
description: Install a published abtree workflow and drive it with your agent of choice. Covers prerequisites, per-repo vs global install, the skill prompt, and how to run the workflow once installed.
---

# Use a tree

Every published [abtree](https://abtree.sh) workflow installs and runs the same way. This page is the canonical reference — individual tree READMEs link here instead of duplicating it.

## Prerequisites

Install these on your `PATH`:

- **abtree CLI** — see [Get started](/getting-started) for one-liner installers (macOS, Linux, Windows).
- **An agent.** abtree is agent-agnostic. Examples on this site use [Claude Code](https://docs.claude.com/claude-code), but any LLM agent that runs shell commands works.
- **A node package manager** — [Bun](https://bun.sh), [pnpm](https://pnpm.io), or [npm](https://www.npmjs.com).

## Install the abtree skill

The skill is the prompt template that teaches your agent how to drive an abtree execution. If you kick off a workflow and the agent does not seem to know what to do, the skill is missing:

```sh
abtree install skill
```

You only do this once per agent setup, not per tree.

## Install the tree

Choose one of two options. Either way, the tree lands as a node package — abtree finds it by path or by slug at execution time.

### Option A — per-repo (recommended)

In the repository you want to run the workflow against:

::: code-group

```sh [bun]
bun add --dev <pkg>
```

```sh [pnpm]
pnpm add -D <pkg>
```

```sh [npm]
npm install --save-dev <pkg>
```

:::

The tree lands at `./node_modules/<pkg>/`. It is a dev-time tool — nothing ships in your runtime bundle.

### Option B — global

Install once, run from any repository:

::: code-group

```sh [bun]
bun add -g <pkg>
```

```sh [pnpm]
pnpm add -g <pkg>
```

```sh [npm]
npm install -g <pkg>
```

:::

The tree lands at `$(npm root -g)/<pkg>/` (use `pnpm root -g` or `bun pm -g bin` for those managers).

### Pin a version

Pin an npm version for byte-stable resolution across machines:

```sh
bun add <pkg>@1.2.0
```

For full reproducibility, commit your lockfile (`package-lock.json`, `pnpm-lock.yaml`, or `bun.lock`).

### Install from sources other than npm

If you consume a tree that is not published to npm (a private fork, an unpublished prototype, a local tarball), every supported package manager already documents Git, local-path, tarball, and URL forms — see the manager's `add`/`install` reference: [npm install](https://docs.npmjs.com/cli/v10/commands/npm-install), [pnpm add](https://pnpm.io/cli/add), [bun add](https://bun.sh/docs/cli/add).

## Run the workflow

Hand a brief to your agent. The exact phrasing does not matter — the agent reads the skill, calls `abtree --help`, and figures out the protocol from there:

```sh
# Option A — per-repo install
claude 'Using the abtree cli, run the tree ./node_modules/<pkg>'
```

```sh
# Option B — global install
claude "Using the abtree cli, run the tree $(npm root -g)/<pkg>"
```

The agent walks the tree and persists state to a new `.abtree/` directory at the repo root. Gitignore it, or commit it if you want shareable run history.

## What gets written

Every execution writes the same two artefacts under `.abtree/executions/`:

| Path | Purpose |
|---|---|
| `.abtree/executions/<id>.json` | Full execution document — input, output, every state mutation. |
| `.abtree/executions/<id>.svg` | Live SVG diagram of the run, regenerated on every state change. |

Individual trees also write workflow-specific files (reports, plans, and so on) — see the tree's own README.

## Reference

- [Concepts](/concepts/) — what behaviour trees are and why.
- [Writing trees](/guide/writing-trees) — author your own.
- [Design a new tree](/guide/design-process) — ten-step design process.
- [Idioms](/guide/idioms) — reusable shapes for production workflows.
- [Fragments](/guide/fragments) — split a large tree across files.
- [Inspecting executions](/guide/inspecting-executions) — debug a stuck or failed run.
- [Execution protocol](/agents/execute) — what the agent does at each step.
- [CLI reference](/guide/cli) — every command, every flag.

## Next

- [Writing trees](/guide/writing-trees) — build the bundled `hello-world` tree from scratch.
