# @abtree/dsl

A tiny jest-style TypeScript DSL for authoring [abtree](https://abtree.sh) behaviour trees. Author trees in `.ts` files; the runtime consumes the canonical tree-file shape (composite/action nodes, evaluate/instruct steps, flat `state.local` + `state.global`).

## Install

```bash
bun  add @abtree/dsl
pnpm add @abtree/dsl
npm  install @abtree/dsl
```

## Usage

```ts
import {
  action,
  evaluate,
  global,
  instruct,
  local,
  selector,
  sequence,
} from "@abtree/dsl";

const program = sequence("Hello_World", (n) => {
  n.description = "Greet a user based on the time of day.";

  // locals are read/write containers — fill them in as the tree runs.
  const timeOfDay = local("time_of_day", null);
  const greeting = local("greeting", null);

  // globals are values substituted into instructions at runtime.
  const currentUser = global("current_user", "world");

  action("Determine_Time", () => {
    evaluate(`${timeOfDay} is set`);
    instruct(`Detect the current time of day and write it to ${timeOfDay}.`);
  });

  selector("Choose_Greeting", () => {
    action("Morning", () => {
      evaluate(`${timeOfDay} equals morning`);
      instruct(`Write "Good morning, ${currentUser}" to ${greeting}.`);
    });
    action("Default", () => {
      instruct(`Write "Hello, ${currentUser}" to ${greeting}.`);
    });
  });
});
```

`program` is the canonical tree-node object — emit it as the YAML referenced by your package's `package.json:main`.

## Concepts

- **Locals** — read/write containers the tree fills in as it runs. `null` defaults are fine.
- **Globals** — values substituted into instructions at runtime. Defaults should be concrete.
- **In-body declarations** — calling `local()` / `global()` inside a composite/action body attaches state to that node (with the key mangled as `<NodeName>__<key>` to avoid cross-component collisions). Module-scope declarations register into a tree-wide `ambient` bucket instead. The runtime flattens everything at execution-create.
- **Branded refs** — `local()` returns `LocalRef<T>` and `global()` returns `GlobalRef<T>`. At runtime they're plain strings (so template-literal interpolation just works); at the type level they carry the scope and the value type — so a `LocalRef` can't be silently passed where a `GlobalRef` is expected.

## Delegating to a subagent

`delegate(name, options, body)` declares a scope of the tree that runs in a spawned subagent. The DSL desugars it into a normal `sequence` named `<name>` with three sections — a `Spawn_<name>` marker action, the user's body children verbatim, and a `Return_To_Parent_<name>` marker action carrying a build-time-generated exit token. The runtime does not know about delegation; it just walks the desugared nodes.

```ts
import { action, delegate, evaluate, instruct, local, selector, sequence } from "@abtree/dsl";

const greeting = local("greeting", null);
const timeOfDay = local("time_of_day", null);

sequence("Hello_World", () => {
  action("Determine_Time", () => { instruct(`Classify and store at ${timeOfDay}.`); });

  delegate("Compose_Greeting", {
    brief: `Pick the branch matching ${timeOfDay} and compose a single sentence at ${greeting}.`,
    model: "haiku",
    output: greeting,
  }, () => {
    selector("Choose_Greeting", () => {
      action("Morning_Greeting",   () => { evaluate(`${timeOfDay} is "morning"`);   instruct(`…`); });
      action("Afternoon_Greeting", () => { evaluate(`${timeOfDay} is "afternoon"`); instruct(`…`); });
    });
  });

  action("Announce_Greeting", () => { instruct(`Read ${greeting} and print it.`); });
});
```

`DelegateOptions` — all optional:

- **`brief`** — free-form text describing what the subagent should do. Baked into the Spawn instruct under a `BRIEF:` label.
- **`model`** — advisory model hint (e.g. `"haiku"`, `"sonnet"`, `"opus"`). Honoured only if the parent agent's harness supports model selection; abtree does not enforce it.
- **`output`** — a `$LOCAL` ref the inner work is expected to populate. Adds a leading `evaluate("${output} is set")` step on `Return_To_Parent_<name>` so the scope fails when the subagent submitted success for every inner action without actually writing the declared slot.

For the full pattern (why delegation, when to use it, pitfalls), see the [delegating-to-subagents guide](https://abtree.sh/guide/delegating-to-subagents).

See the inline TSDoc on every export for full reference.
