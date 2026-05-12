---
title: Anti-patterns
description: Shapes that look like idioms but fail in practice — unbounded retries, native loops, pure-instruct actions, unordered parallels, and misuse of `submit running`. Recognise each so the runtime catches the bug at design time.
---

# Anti-patterns

Shapes that look right but are not. Each entry names the trap, explains why abtree rejects it, and points at the idiom you reach for instead.

## No native loops

abtree has no repeater, no while-condition, no "back to step N". Anything that needs to retry is expressed as `retries: N` on a node, or as a `selector` of `N` attempts. If a workflow needs unbounded iteration, fold the iteration into a single `instruct` and cap it ("at most three attempts, then submit failure").

## No unbounded retries

A `selector` with `N` children gives you `N` attempts. There is no shape that gives unlimited attempts. This is intentional — unbounded retries are dangerous for autonomous agents.

## Every action needs an evaluate precondition

Even when the precondition obviously holds, write the `evaluate`. It documents the contract, gives the runtime a chance to short-circuit on bad state, and surfaces failures earlier with clearer messages. Pure-instruct actions are reserved for the last child of a selector that serves as a fallback.

## `$LOCAL` keys are scoped to one execution

`$LOCAL` is per-execution, not per-tree. Two executions of the same tree have isolated `$LOCAL`. Do not design as if state persists across runs — if you need cross-run state, the agent reads and writes external files via the instruct text.

## Internal bookkeeping keys are reserved

abtree tracks cursor state in a `runtime` field on the execution document — `runtime.node_status`, `runtime.step_index`, and `runtime.retry_count`. These are internal to the tick engine: never visible via `abtree local read` and never writable via `abtree local write`. They are documented in [Inspecting executions](/guide/inspecting-executions) for diagnostics, not for use.

## A selector with all evaluate-gated children needs a default

If every child has an `evaluate` precondition that might fail, the selector fails when none match. If you want a "none of the above" branch, add a no-evaluate action as the last child.

## Ordering inside a `parallel`

Do not depend on parallel children running in YAML order. The agent receives requests for each child in turn but is free to satisfy them in any sequence. If you need ordering, use `sequence`.

## `submit running` keeps the cursor put

Use `abtree submit <id> running` only when waiting on something external (a human approval, a long-running tool). The execution stays in `performing` phase; `abtree next` returns the same instruct. Do not use it to "skip" an instruct.

## Next

- [Idioms](/guide/idioms) — the shapes you reach for instead.
- [Testing trees](/guide/testing) — pin behaviour against regressions.
