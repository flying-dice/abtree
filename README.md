<p align="center">
  <img src="docs/public/abtree-mark.svg" alt="abtree" width="120" />
</p>

<h1 align="center">abtree</h1>

<p align="center">
  <strong><s>Hoping.</s> Behaving.</strong><br/>
  Replace the skill file you hope your agent reads with a tree the runtime walks — one step at a time, verified at every move.
</p>

<p align="center">
  <a href="https://abtree.sh">Docs</a> ·
  <a href="https://abtree.sh/getting-started">Get started</a> ·
  <a href="https://abtree.sh/concepts/">How it works</a>
</p>

---

## Install

**macOS / Linux**

```sh
curl -fsSL https://github.com/flying-dice/abtree/releases/latest/download/install.sh | sh
```

**Windows (PowerShell)**

```powershell
irm https://github.com/flying-dice/abtree/releases/latest/download/install.ps1 | iex
```

![A behaviour tree walking the SRP refactor loop end-to-end](docs/public/example.svg)

## What it does

abtree is a runtime for agent workflows. Author a tree as JSON, YAML, or compile it from the TypeScript DSL. Ship it through any transport your team already uses — abtree never sees the distribution; it only reads the file at the path you point it at. Your agent drives execution through three commands (`next`, `eval`, `submit`) and only ever sees the next step.

## Read the docs

Concepts, guides, CLI reference, and a five-minute walkthrough all live at **[abtree.sh](https://abtree.sh)**.

→ [**Get started in five minutes**](https://abtree.sh/getting-started)
