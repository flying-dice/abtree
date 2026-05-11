# abtree_dsl

A tiny jest-style TypeScript DSL for authoring [abtree](https://abtree.sh) behaviour trees. Author trees in `.ts` files; the runtime consumes the canonical tree-file shape (composite/action nodes, evaluate/instruct steps, flat `state.local` + `state.global`).

## Install

```bash
bun  add abtree_dsl
pnpm add abtree_dsl
npm  install abtree_dsl
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
} from "abtree_dsl";

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
- **Branded refs** — `local()` returns `LocalRef<K, T>` and `global()` returns `GlobalRef<K, T>`. At runtime they're plain strings (so template-literal interpolation just works); at the type level they carry the scope, the literal key name, and the value type — so a `LocalRef` can't be silently passed where a `GlobalRef` is expected.

See the inline TSDoc on every export for full reference.
