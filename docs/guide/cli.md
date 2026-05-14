---
title: CLI reference
description: Complete CLI reference for abtree — every command, every flag, every response shape, exit codes, and environment variables. JSON-shaped responses for agents to consume directly.
---

# CLI reference

Every command outputs JSON to stdout. Errors go to stderr. See [Execution protocol](/agents/execute) for the contract an agent driving abtree follows; this page is the lookup tier for command shapes and flags.

## Executions

### `abtree execution create <tree> <summary>`

Create a new execution from a tree.

`<tree>` is a literal path — absolute or relative — to a `.json`, `.yaml`, or `.yml` tree file. No slug lookup, no `package.json` inference. For an installed npm package, pass `./node_modules/<pkg>/<file>`; for a project-local tree, pass the path you wrote it at.

`<summary>` is a human label; kebab-cased, it becomes part of the execution ID. The tree-slug segment of the ID is `sanitiseSlug(<tree-file's name field>)`.

```sh
abtree execution create ./node_modules/@abtree/hello-world/main.json "first run"
```

```json
{
  "id": "first-run__abtree-hello-world__1",
  "tree": "abtree-hello-world",
  "summary": "first run",
  "local": { ... },
  "global": { ... }
}
```

| Exit code | Meaning |
|---|---|
| `0` | Execution created. |
| `1` | Tree file not found, wrong extension, or the file failed validation. |

### `abtree execution list`

List every execution with status and phase.

```sh
abtree execution list
```

```json
[
  {
    "id": "first-run__abtree-hello-world__1",
    "tree": "abtree-hello-world",
    "summary": "first run",
    "status": "running",
    "phase": "performing"
  }
]
```

| Exit code | Meaning |
|---|---|
| `0` | List returned (zero or more entries). |

### `abtree execution get <execution-id>`

Print the full execution document — metadata, snapshot, cursor, `$LOCAL`, `$GLOBAL`, and the `runtime` bookkeeping. Identical to reading `.abtree/executions/<id>.json` directly, but formatted to stdout.

| Exit code | Meaning |
|---|---|
| `0` | Document printed. |
| `1` | Execution ID not found. |

### `abtree execution reset <execution-id>`

Reset an execution to its initial state. Status returns to `running`, the cursor returns to the start, the protocol gate re-fires on next, and all `$LOCAL` keys revert to their tree defaults. Useful for re-running an execution after fixing a tree.

```json
{ "status": "reset" }
```

| Exit code | Meaning |
|---|---|
| `0` | Execution reset. |
| `1` | Execution ID not found. |

## Execution loop

### `abtree next <execution-id>`

Return the next step. The response is one of four shapes:

| Response | Shape | Meaning |
|---|---|---|
| `evaluate` | `{ "type": "evaluate", "name": "...", "expression": "..." }` | A precondition to judge. Reply with `abtree eval <id> true\|false`. |
| `instruct` | `{ "type": "instruct", "name": "...", "instruction": "..." }` | Work to perform. Reply with `abtree submit <id> success\|failure\|running`. |
| `done` | `{ "status": "done" }` | The tree completed successfully. |
| `failure` | `{ "status": "failure" }` | The tree terminated with a failure. |

| Exit code | Meaning |
|---|---|
| `0` | Step returned, or terminal status emitted. |
| `1` | Execution ID not found, or cursor in an invalid state. |

### `abtree eval <execution-id> <true|false>`

Submit the result of an `evaluate` request. The agent reads the expression, decides whether it holds against current state, and reports back.

| Exit code | Meaning |
|---|---|
| `0` | Result accepted. |
| `1` | Execution not in `evaluating` phase, or result not `true`/`false`. |

### `abtree submit <execution-id> <success|failure|running>`

Submit the result of an `instruct` request.

| Status | Effect |
|---|---|
| `success` | Advance the cursor. If the action's last step, mark the action successful. |
| `failure` | Mark the action failed; the runtime backs out by branch rules. |
| `running` | Keep the execution in `performing` phase. Use only when waiting on something external. |

| Exit code | Meaning |
|---|---|
| `0` | Submission accepted. |
| `1` | Execution not in `performing` phase, or status not one of the three valid values. |

## State

### `abtree local read <execution-id> [path]`

Read from `$LOCAL`. With no path, return the whole scope. With a dot-notation path, return one value.

```sh
abtree local read first-run__abtree-hello-world__1 greeting
```

```json
{ "path": "greeting", "value": "Good morning, Alice!" }
```

| Exit code | Meaning |
|---|---|
| `0` | Value returned (`null` if the key is unset). |
| `1` | Execution ID not found. |

### `abtree local write <execution-id> <path> <value>`

Write a value at the given path. Values are JSON-parsed when possible — `true`, `42`, `"hello"`, `[1,2,3]` all work; anything that fails to parse is stored as a string.

| Exit code | Meaning |
|---|---|
| `0` | Value stored. |
| `1` | Execution ID not found or path missing. |

### `abtree global read <execution-id> [path]`

Read from `$GLOBAL`. Read-only via the CLI.

| Exit code | Meaning |
|---|---|
| `0` | Value returned. |
| `1` | Execution ID not found. |

## Documentation

### `abtree docs <subcommand>`

Print embedded documentation to stdout. Useful for piping into a tool, an agent, or another shell command.

| Subcommand | Output |
|---|---|
| `abtree docs execute` | The execution protocol — what an agent does at each step. |
| `abtree docs author` | The tree-authoring reference. |
| `abtree docs schema` | The JSON Schema for tree files. Byte-identical to the committed `tree.schema.json`. |
| `abtree docs skill` | The agent skill content (same text `install skill` writes). |

| Exit code | Meaning |
|---|---|
| `0` | Document printed. |

## Install

### `abtree install skill`

Install the abtree agent skill for the agent platform you use. The skill is the prompt template that teaches the agent how to drive an abtree execution.

With no flags, the command prompts for the platform and the scope. Pass `--variant` and `--scope` to skip the prompts.

| Flag | Values | Default | Meaning |
|---|---|---|---|
| `--variant <variant>` | `claude` \| `agents` | (prompt) | Target agent platform. `claude` installs under `.claude/skills/abtree/`; `agents` installs under `.agents/skills/abtree/`. |
| `--scope <scope>` | `project` \| `user` | (prompt) | `project` installs into the cwd; `user` installs into the home directory. |

```sh
abtree install skill --variant claude --scope project
```

```json
{
  "variant": "claude",
  "scope": "project",
  "path": ".claude/skills/abtree/SKILL.md"
}
```

| Exit code | Meaning |
|---|---|
| `0` | Skill written. |
| `1` | Unknown variant or scope passed. |

## Upgrade

### `abtree upgrade`

Upgrade the abtree binary in place from the latest GitHub release (or a pinned tag).

| Flag | Default | Meaning |
|---|---|---|
| `--check` | off | Print the current and latest versions, then exit. No install. |
| `--version <tag>` | latest | Pin to a specific release tag (`v0.4.2` or `0.4.2`). |
| `--yes` | off | Skip the interactive confirmation prompt. |

```sh
abtree upgrade --check
abtree upgrade --version 0.4.2 --yes
```

| Exit code | Meaning |
|---|---|
| `0` | Upgrade completed, version printed, or user declined the prompt. |
| `1` | Install directory not writable, or `installBinary` failed. |
| `2` | Network error fetching the release tag or downloading the asset. |
| `3` | Unsupported OS or architecture. |

## Help and version

### `abtree --help` (alias: `-h`)

Print the full execution protocol — the same content an agent driving abtree needs to know. Designed for an agent that runs `--help` first to learn the loop. `-h` is the short alias.

### `abtree --version` (alias: `-V`)

Print the installed abtree version and exit. `-V` is the short alias.

## Environment variables

| Variable | Effect |
|---|---|
| `ABTREE_EXECUTIONS_DIR` | Override the executions directory. Default: `.abtree/executions/` in the cwd. Accepts absolute paths, relative paths (resolved against cwd), or `~/`-prefixed paths. |

Use `ABTREE_EXECUTIONS_DIR` to keep execution state outside the repo (on a shared volume, or pointing multiple repos at the same execution store):

```sh
export ABTREE_EXECUTIONS_DIR=~/.local/state/abtree-executions
abtree execution list   # all executions across every project, in one place
```

Trees are loaded from whatever path you pass to `abtree execution create` — only the executions and snapshots directories are overridable (`ABTREE_EXECUTIONS_DIR`, `ABTREE_SNAPSHOTS_DIR`).

## Exit codes (summary)

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | User error (missing execution, invalid input, bad arguments, file write failure). |
| `2` | Network error (`abtree upgrade` only). |
| `3` | Unsupported platform (`abtree upgrade` only). |

The JSON output is always written to stdout. Errors go to stderr.

## See also

- [Execution protocol](/agents/execute) — the contract for an agent driving these commands.
