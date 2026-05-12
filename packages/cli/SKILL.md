---
name: abtree
description: Drive abtree behaviour-tree workflows. Use when the user asks to run, resume, or inspect an abtree execution; when they invoke a bundled tree by name; when they want to run a fragment installed as a node package; or when they ask to design a new tree.
allowed-tools:
  - Bash(abtree *)
---

<!--
  This skill ships with the abtree CLI. Install it with:

      abtree install skill

  Pass --variant claude|agents and --scope project|user to skip the prompts.
-->

# abtree

CLI that drives YAML behaviour-tree workflows. **This skill is only a signpost.** The installed binary carries the authoritative docs — read them from the CLI, not from memory.

## Read the docs from the CLI

```sh
abtree --help                     # top-level commands and global options
abtree <command> --help           # exact flags and options for any subcommand

abtree docs skill                 # this file, straight from the binary
abtree docs execute               # the runtime protocol — read before driving an execution
abtree docs author                # tree-authoring guide
abtree docs schema                # TREE.yaml JSON schema

abtree execution list             # running and completed executions
```

For broader docs (concepts, full guides, examples), fetch `https://abtree.sh/llms.txt` first (the index lists every page as `<path>.md`), then pull each `https://abtree.sh/<path>.md` you need.

## Install (only if `abtree --version` fails)

- macOS / Linux: `curl -fsSL https://github.com/flying-dice/abtree/releases/latest/download/install.sh | sh`
- Windows: `irm https://github.com/flying-dice/abtree/releases/latest/download/install.ps1 | iex`
