# `abtree local write` silently drops values that begin with `-` or `---`

Observed: 2026-05-10 while running `refine-plan` end-to-end against a markdown plan whose first line is `---` (YAML frontmatter).

## Symptom

```
./abtree local write <exec> hardened_plan "---\nid: 20260510-...\n...rest of plan..."
```

The CLI prints back what looks like a successful echo:

```json
{
  "path": "hardened_plan",
  "value": "<full plan content>"
}
```

But on disk, `.abtree/executions/<exec>.json` is unchanged. `mtime` doesn't move. A subsequent `abtree local read <exec> hardened_plan` returns `null` (or whatever the previous value was).

When run via `bun index.ts` instead of the compiled binary, commander surfaces the underlying error directly:

```
error: unknown option '---
id: 20260510-...
title: ...'
```

The compiled binary swallows the option-parse error and exits 0 — so the call looks successful even though no write happened.

## Root cause

`abtree local write <execution> <path> <value>` is registered with commander.js. Commander treats any positional argument that starts with `-` or `--` as a flag. The plan's leading `---` is parsed as an unknown option, the real value parameter is shifted, and `cmdLocalWrite` is never reached with the intended payload.

## Reproduction

```bash
EXEC=$(./abtree execution create hello-world test 2>&1 | jq -r .id)
./abtree submit "$EXEC" success > /dev/null   # clear protocol gate
./abtree local write "$EXEC" note "--start-of-value"
./abtree local read "$EXEC" note
# Returns null. Expected: "--start-of-value"
```

A four-character value that happens to start with `--` is enough to trigger it.

## Workaround

Use the standard `--` end-of-options separator before the value:

```bash
./abtree local write "$EXEC" note -- "--start-of-value"
```

`global write` and any future commands that take a free-text positional argument have the same shape and would have the same bug.

## Why it matters

- Silent no-op: the CLI looks like it succeeded. The compiled binary doesn't even surface commander's parse error.
- Data loss: the call's user thinks the value is in `$LOCAL`; the next `evaluate` step gating on `is set` returns false, the action collapses to failure, and the cause is invisible.
- Real-world hit: any markdown plan with YAML frontmatter, any value beginning with a dash, any path argument that's a flag-shaped string.

## Suggested fixes (in order of strength)

1. **Pass `--` automatically inside commander setup.** In `index.ts`, set `program.allowExcessArguments(false)` and use `commander`'s `.passThroughOptions()` or `.argument('<value>', ...).parseOptions = false` (not all of these are supported on every version — verify the running commander API).
2. **Validate post-parse**: after commander returns the parsed args to `cmdLocalWrite`, assert the value is non-empty and matches the original argv slice; surface a clear error if the parser ate it.
3. **Document the workaround** in `abtree docs execute` so agents know to use `--` whenever they're not sure of the value's leading characters.
4. **Hard fix**: replace commander's positional parsing for `local write` / `global write` (when added) with a manual argv slice that does not honour leading dashes.

## Test that would have caught this

A harness/integration test for the existing `local write` CLI surface, with a value that begins with `--`. Listed in `plans/hands-off-cleanup-and-improve-codebase-cycle.md` as integration test #9 (currently scoped to "non-JSON value" — should be widened to also cover "value with leading dash").

## Related observations (not separate bugs, but adjacent)

- The compiled `./abtree` binary swallows commander's `unknown option` error and exits 0. `bun index.ts` surfaces it. Whatever wraps commander in the `--compile` build path is hiding stderr or losing the exit code.
- `cmdLocalWrite` itself does not validate that the path or value is non-empty; if commander hands it `value=undefined` (or empty string), it still runs JSON.parse on the empty string, falls back to `parsed = ""`, and writes an empty string into `$LOCAL`. Not what was reproduced here but it's a related foot-gun.
