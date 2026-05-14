# @abtree/testing

A small testing harness for driving [abtree](https://abtree.sh) executions deterministically. The vocabulary mirrors the abtree CLI; a scenario reads like a scripted agent–runtime dialogue rather than a table of step configurations.

Kept separate from `@abtree/dsl` so tree-authoring packages don't pull in the MCP SDK and its transitive footprint.

## Install

```sh
bun  add -d @abtree/testing
pnpm add -D @abtree/testing
npm  install -D @abtree/testing
```

## At a glance

```ts
import {
  AgentHarness,
  CliTransport,
  setupTreePackageFixture,
  eval as evalAs,
  evaluate,
  instruct,
  localWrite,
  submit,
} from "@abtree/testing";

const fixture = setupTreePackageFixture({
  slug: "my-tree",
  treeDir: "/abs/path/to/my-tree",
});

const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));

try {
  await agent.start("my-tree", "scenario");

  await agent.when(instruct("Acknowledge_Protocol"))
    .respond(submit("success"));

  await agent.when(instruct("Write_Counter"))
    .respond(localWrite("counter", 1), submit("success"));

  await agent.when(evaluate("Verify_Counter"))
    .respond(evalAs(true));

  await agent.expectDone();
  await agent.expectLocal({ counter: 1 });
} finally {
  await agent.close();
  fixture.cleanup();
}
```

Each line reads as: *"when the runtime asks me to do X, the agent responds with Y."*

## Concepts

The harness factors the work into four pieces, all transport-agnostic.

### 1. `AgentHarness` — the orchestrator

Wraps a `Transport` and tracks one execution. Lifecycle:

| Phase | Method |
| --- | --- |
| Setup | `new AgentHarness(transport)` |
| Open | `await agent.start(treeSlug, summary)` |
| Per step | `await agent.when(matcher).respond(...actions)` |
| Inspect | `await agent.localRead([path])`, `await agent.globalRead([path])` |
| Assert | `await agent.expectDone()`, `await agent.expectLocal({ ... })` |
| Teardown | `await agent.close()` |

The harness has no opinion on the wire format or the binary location — that's the transport's job.

### 2. Step matchers — what the runtime is asking

| Helper | Matches |
| --- | --- |
| `instruct(name)` | `{ type: "instruct", name, instruction }` from `abtree next` |
| `evaluate(name)` | `{ type: "evaluate", name, expression }` from `abtree next` |

These collide with `@abtree/dsl`'s `instruct(text)` / `evaluate(expression)` step builders. If a single file needs both surfaces, alias on import:

```ts
import { instruct as instructStep, evaluate as evaluateStep } from "@abtree/dsl";
import { instruct, evaluate } from "@abtree/testing";
```

In practice scenario files import only from `@abtree/testing`, so this is rare.

### 3. Agent actions — what the agent calls back with

Every action helper produces a tagged `Action` object that the harness dispatches via the transport:

| Helper | CLI verb | Terminal? |
| --- | --- | --- |
| `submit(status)` | `abtree submit <id> <success\|failure\|running>` | yes |
| `eval(result)` | `abtree eval <id> <true\|false>` | yes |
| `localWrite(path, value)` | `abtree local write <id> <path> <val>` | no |

Each `.respond(...)` chain must end with **exactly one** terminal action — that's what advances the cursor. Pre-terminal actions (just `localWrite` today) run in declared order beforehand. The harness throws if no terminal is present, or if a terminal isn't last:

```ts
// ✓ valid
await agent.when(instruct("Write_Pair"))
  .respond(localWrite("a", 1), localWrite("b", 2), submit("success"));

// ✗ throws — no terminal
await agent.when(instruct("X")).respond(localWrite("a", 1));

// ✗ throws — terminal not last
await agent.when(instruct("X"))
  .respond(submit("success"), localWrite("a", 1));
```

### 4. Transports — the wire

Two reference implementations ship with this package. Both take a `cwd` (where the abtree runtime resolves `.abtree/` paths from) and optional `command` + `args` for invoking the CLI.

#### `CliTransport`

Spawns the abtree CLI **once per verb**. Each call is a fresh subprocess. Stateless — `close()` is a no-op.

```ts
new CliTransport({
  cwd: fixture.cwd,
  // Default: command = "abtree", args = []
  // For checkout-local invocation:
  command: "bun",
  args: ["packages/cli/index.ts"],
});
```

#### `McpTransport`

Spawns the `abtree mcp` server **once on the first verb**, then drives every subsequent call as an MCP tool invocation over its stdio. Stateful — `close()` is mandatory to release the subprocess + client.

```ts
new McpTransport({
  cwd: fixture.cwd,
  command: "bun",
  args: ["packages/cli/index.ts"],
});
```

The bundled bench in this repo measures `McpTransport` at roughly **8× faster wall-clock** than `CliTransport` for the same end-to-end scenario.

#### Custom transports

Implement the `Transport` interface (eight async methods + a `NextResponse` return type for `next`) and pass an instance to `AgentHarness`. The scenario script runs unchanged:

```ts
import { type Transport, type NextResponse, AgentHarness } from "@abtree/testing";

class HttpTransport implements Transport {
  constructor(private baseUrl: string) {}

  async createExecution(tree: string, summary: string): Promise<{ id: string }> {
    const r = await fetch(`${this.baseUrl}/executions`, {
      method: "POST",
      body: JSON.stringify({ tree, summary }),
    });
    return r.json();
  }

  async next(id: string): Promise<NextResponse> {
    const r = await fetch(`${this.baseUrl}/executions/${id}/next`);
    return r.json();
  }

  // ... submit, eval, localRead, localWrite, globalRead, close
}

const agent = new AgentHarness(new HttpTransport("http://localhost:7474"));
```

### 5. Fixtures — isolated workspace

`setupTreePackageFixture(opts)` `mkdtemp`'s an isolated dir, copies a built tree package's `main.json` into a `<slug>/` subdir, and returns `{ cwd, treePath, cleanup }`. Pass `treePath` to `agent.start(...)`; pair the cleanup with the harness's `close()` in a `finally`:

```ts
const fixture = setupTreePackageFixture({
  slug: "hello-world",
  treeDir: "/abs/path/to/trees/hello-world",
  files: ["main.json"],                    // default
  prefix: "my-scenario-",                  // default: "abtree-harness-"
});

const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
try {
  await agent.start(fixture.treePath, "scenario");
  // ...
} finally {
  await agent.close();
  fixture.cleanup();
}
```

Without isolation, executions and snapshots from the run would land in the caller's project tree.

## Recipes

### Sharing a scenario across both transports

The scenario lives in one file; runners thread their transport through it. Used by this repo's own regression suite:

```ts
// scenario.ts
import {
  type AgentHarness,
  eval as evalAs, evaluate, instruct, localWrite, submit,
} from "@abtree/testing";

export async function runScenario(agent: AgentHarness): Promise<void> {
  await agent.when(instruct("Acknowledge_Protocol")).respond(submit("success"));
  await agent.when(instruct("Write_Counter"))
    .respond(localWrite("counter", 1), submit("success"));
  await agent.when(evaluate("Verify_Counter")).respond(evalAs(true));
  await agent.expectDone();
}
```

```ts
// run-cli.ts
import { AgentHarness, CliTransport, setupTreePackageFixture } from "@abtree/testing";
import { runScenario } from "./scenario.ts";

const fixture = setupTreePackageFixture({ slug: "x", treeDir: TREE });
const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
try {
  await agent.start("x", "cli");
  await runScenario(agent);
} finally {
  await agent.close();
  fixture.cleanup();
}
```

```ts
// run-mcp.ts — identical except for `McpTransport`
```

### Mid-scenario state inspection

`localRead` and `globalRead` are available on the harness for assertions mid-flow:

```ts
await agent.when(instruct("Bump_Counter"))
  .respond(localWrite("counter", 2), submit("success"));

const counter = await agent.localRead("counter");
console.log("counter is now:", counter);

const everything = await agent.localRead();   // whole $LOCAL
```

### Round-trip JSON values

`localWrite` JSON-stringifies its `value` argument; the runtime parses it back. Strings, numbers, booleans, arrays, and plain objects round-trip correctly:

```ts
localWrite("count", 42);
localWrite("name", "Alice");
localWrite("flags", { strict: true, retries: 3 });
localWrite("ids", [1, 2, 3]);
```

### Long-running external work

If an `instruct` represents work the agent can't complete synchronously (waiting on a human, a remote job, etc.), submit `"running"` instead of `"success"`. The cursor stays in place; the next call to `agent.when(...)` against the same matcher resolves once you `submit("success")`:

```ts
await agent.when(instruct("Approve")).respond(submit("running"));
// ... do external work ...
await agent.when(instruct("Approve")).respond(submit("success"));
```

## Vocabulary cheat-sheet

| Method | Equivalent CLI verb |
| --- | --- |
| `agent.start(tree, summary)` | `abtree execution create <tree> <summary>` |
| `agent.when(instruct(name))` matches | response of `abtree next` |
| `agent.when(evaluate(name))` matches | response of `abtree next` |
| `.respond(submit(status))` | `abtree submit <id> <status>` |
| `.respond(eval(result))` | `abtree eval <id> <true\|false>` |
| `.respond(localWrite(path, value), ...)` | `abtree local write <id> <path> <val>` |
| `agent.localRead([path])` | `abtree local read <id> [path]` |
| `agent.globalRead([path])` | `abtree global read <id> [path]` |
| `agent.close()` | (tear down transport) |

## Error messages

All assertion failures throw with a self-describing message:

```text
expected instruct("Write_Counter"); got evaluate("Verify_Counter")
expected $LOCAL.counter = 2; got 1
expected { status: "done" }; got { type: "instruct", name: "Announce_Greeting", ... }
when(instruct("X")).respond(...) requires one terminal action — submit() or eval() — and got none
when(instruct("X")).respond(...) terminal action submit/eval must be last; got localWrite after it
```

Each names the matcher / slot / step at the point of failure, so test runner output points straight at the failing line.

## API reference

For the full type signatures, options, and edge-case notes, see the inline TSDoc on every export — your editor's "go to definition" surfaces the same content shown here, plus the precise method-by-method docs.
