---
title: Delegating to subagents
description: Run a stretch of the tree in a spawned subagent, with the parent waiting on a verified exit token. Use delegate(...) in the DSL — it desugars to standard nodes; the runtime stays unchanged.
---

# Delegating to subagents

Some stretches of a tree are best run by a different agent than the one driving the rest. A cheap model can handle a focused inner loop while a stronger model orchestrates. A specialist subagent can do a self-contained piece of work and report back. Long-running scope can be isolated from the parent's context.

abtree expresses this with the **`delegate(...)`** DSL helper. The parent agent kicks off a subagent for an inner subtree; the subagent drives that subtree via the same `abtree next/eval/submit` loop; on its last inner action it returns a build-time-generated **exit token**; the parent verifies the token and resumes at the next post-scope action.

The runtime does not know about delegation. `delegate(...)` is pure DSL sugar that emits a normal `sequence` of standard nodes. Everything happens via convention encoded in the generated instruct text.

## The shape

```ts
import { action, delegate, evaluate, instruct, local, selector, sequence } from "@abtree/dsl";

const timeOfDay = local("time_of_day", null);
const greeting = local("greeting", null);

sequence("Hello_World", () => {
  action("Determine_Time", () => {
    instruct(`Classify the current hour and store at ${timeOfDay}.`);
  });

  delegate("Compose_Greeting", {
    brief: `Pick the branch matching ${timeOfDay} and compose a single sentence at ${greeting}.`,
    model: "haiku",
    output: greeting,
  }, () => {
    selector("Choose_Greeting", () => {
      action("Morning_Greeting", () => {
        evaluate(`${timeOfDay} is "morning"`);
        instruct(`Compose a morning greeting and store at ${greeting}.`);
      });
      action("Afternoon_Greeting", () => {
        evaluate(`${timeOfDay} is "afternoon"`);
        instruct(`Compose an afternoon greeting and store at ${greeting}.`);
      });
      action("Evening_Greeting", () => {
        evaluate(`${timeOfDay} is "evening"`);
        instruct(`Compose an evening greeting and store at ${greeting}.`);
      });
    });
  });

  action("Announce_Greeting", () => {
    instruct(`Read ${greeting} and print it.`);
  });
});
```

This is exactly the shape used in [@abtree/hello-world](https://github.com/flying-dice/abtree/tree/main/trees/hello-world).

## What `delegate` desugars to

The helper appends **one sequence** to the current composite parent. The sequence is named exactly `<name>` and has three sections:

```text
Compose_Greeting (sequence)
├── Spawn_Compose_Greeting              (action — parent submits success, then spawns a subagent)
├── Choose_Greeting (selector)          (your body — subagent drives these nodes)
│   ├── Morning_Greeting
│   ├── Afternoon_Greeting
│   └── Evening_Greeting
└── Return_To_Parent_Compose_Greeting   (action — subagent's exit point, carries the exit token)
```

Wrapping the markers + body inside their own sequence keeps the whole scope as a single unit from the outer tree's point of view. A `delegate(...)` placed inside a `selector` parent therefore behaves as "try this delegated path as one option; on failure, fall through".

## How the runtime walk plays out

1. The parent agent calls `abtree next` and receives the `Spawn_<name>` instruct. The instruct text tells the parent to **submit success first**, then spawn the subagent, then wait.
2. The parent submits success. The runtime advances the cursor to the first inner action.
3. The parent spawns a subagent (using the harness's Agent tool) and blocks on it. The instruct body has already given the subagent its standing orders: drive `abtree next/eval/submit` on this execution, return the exit token verbatim when you process `Return_To_Parent_<name>`, return the failure token if `next` ever returns `done`/`failure`.
4. The subagent drives the inner walk normally. When it processes the `Return_To_Parent_<name>` instruct it submits success and returns the exit token to the parent.
5. The parent verifies the returned reply equals the token exactly. On match, it calls `abtree next` and resumes at the next post-scope action.

::: warning Submit before spawn
The cursor advances only on `submit`. The parent **must** submit success for the `Spawn_<name>` step *before* spawning the subagent — otherwise the subagent's first `abtree next` returns the same Spawn instruct it just received. The generated instruct text spells out this ordering at the top so the parent doesn't get it wrong.
:::

## Options

```ts
delegate(name, { brief?, model?, output? }, body);
```

### `brief: string`

Free-form text describing what the subagent should do. Interpolated verbatim into the Spawn instruct under a `BRIEF:` label so the subagent can find it amid the boilerplate. Use this for everything that the surrounding instruct nodes don't already make obvious: domain context, output format, tone, constraints.

### `model: string`

Advisory model hint. Names a model the harness should use when spawning the subagent (e.g. `"haiku"`, `"sonnet"`, `"opus"`, or any string the parent's harness understands). abtree does not enforce this — the instruct text says explicitly "if your harness does not support model selection, ignore this hint". Use the hint to keep cheap work on cheap models without rewriting the tree.

### `output: LocalRef<unknown>`

Optional `$LOCAL` ref the inner work is expected to populate. When set, the `Return_To_Parent_<name>` action gets a leading `evaluate("${output} is set")` step. The Return action — and the wrapping scope — fails if the subagent submitted success for every inner action **without** actually writing the declared slot. This catches the silent-claim-of-success bug class; it does not affect the normal failure path (inner-body action failures already surface via the standard tree-walk).

## Exit tokens

The token is generated at build time. Format: `DLG__<scope-name>__<short-hash>`, where `<short-hash>` is the first 8 hex chars of `sha256(<scope-name> + ":" + <dsl-version>)`. Properties that follow:

- **Deterministic** — the same scope name produces the same token across builds. Generated tree files are reproducible.
- **Scope-local** — different scope names produce different tokens. Nested `delegate(...)` calls each get their own.
- **Plaintext in the JSON** — anyone who can read the tree file can read the token. This is intentional: the token is a clean-exit signal, not a security boundary. A misbehaving subagent already has full `$LOCAL` access via the CLI; forging the token is the least of the parent's worries.

## When to reach for `delegate(...)`

- A self-contained inner subtree could be driven by a cheaper or differently-specialised model.
- You want to keep the parent's working context lean and let a subagent absorb the back-and-forth of an inner loop.
- The work is naturally bracketed: a clear entry, a clear deliverable, a clear handoff back.
- You want a structured failure signal (`output` gate) that distinguishes "delivered nothing" from "branches all failed".

## When NOT to reach for it

- The inner work is one action. The boilerplate overhead is not worth it; just write the action.
- The subagent would need to ask the user mid-scope. The parent is the one with the human in front of it; structure the work so the parent does the asking and the subagent runs from already-resolved state.
- You want concurrent subagents. `delegate` is sequential by design (parent blocks on the subagent). For fan-out, use `parallel` at the parent level and put a `delegate` inside each branch.

## Pitfalls

### Forgetting the submit-before-spawn ordering

The parent's Spawn handler must submit success **first**, then spawn. If you ship a parent harness that spawns then waits then submits, the subagent's first `abtree next` returns the same Spawn instruct and the loop confuses itself. The generated instruct text spells out the ordering — read it.

### Skipping token verification

The whole point of the exit token is that the parent can tell "the subagent reached `Return_To_Parent`" from "the subagent bailed early with a confident-sounding reply". A parent that ignores the token and just calls `abtree next` to keep going loses that signal. Verify exact-string match.

### Hoping `output` catches all failure modes

`output` catches **silent claimed success without writing**. Genuine inner-body failures (selector exhausts, an action's evaluate returns false) surface through the normal tree-walk failure path — the wrapping scope fails before reaching `Return_To_Parent`, and the subagent's `abtree next` returns `{status:"failure"}`. At that point the subagent must return the failure token (`<exit-token>__FAILED`); the parent recognises any reply other than the exact success token as scope failure.

### Cross-tree token collisions

Don't worry about them. Tokens are scope-name + dsl-version derived, but **executions are independent** — two trees that happen to use `delegate("X", ...)` will produce the same token in their respective tree files, but the parent only ever verifies against its own execution's expected token. The scope of the token's identity is one execution, not the global tree corpus.

## Worked example

The bundled [hello-world](https://github.com/flying-dice/abtree/tree/main/trees/hello-world) tree is the smallest end-to-end demonstration of `delegate(...)`. It uses all three options (`brief`, `model: "haiku"`, `output`) around a three-branch selector. The CLI test suite (`packages/cli/tests/cli.test.ts`) walks the desugared tree step-by-step against the protocol, which is the most precise specification of the runtime behaviour.

## Reference

For the API surface, see the inline TSDoc on `delegate` in [@abtree/dsl](https://github.com/flying-dice/abtree/tree/main/packages/dsl). For the boilerplate text the helper generates, see `packages/dsl/src/delegate-templates.ts` in the same package.
