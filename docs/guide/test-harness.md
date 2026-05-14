---
title: Programmatic test harness
description: Drive an abtree execution deterministically from TypeScript with @abtree/testing — a when().respond() DSL that mirrors the abtree CLI surface. Both CLI and MCP transports built in; same scenario script runs against either.
---

# Programmatic test harness

`@abtree/testing` is a small programmatic harness for driving an abtree execution end-to-end from a TypeScript file. It complements [BDD test specs](/guide/testing) — instead of a YAML scenario that the agent reads and walks, you script the exchange step-by-step using a `when().respond()` DSL that mirrors the abtree CLI surface.

Reach for this when:

- You're writing **regression tests** that must run identically across releases (CI pipelines, parity checks between transports).
- You need **precise assertions** at every step — expected name, expected response type, exact `$LOCAL` value.
- The tree under test is **deterministic** enough that an LLM in the loop would be overkill.

For BDD-style specs that an agent walks through using fixtures for external side effects, see [Test a tree](/guide/testing) and the [`@abtree/test-tree`](/registry) runner.

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
  slug: "hello-world",
  treeDir: "/abs/path/to/trees/hello-world",
});

const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));

try {
  await agent.start("hello-world", "scenario");

  await agent.when(instruct("Acknowledge_Protocol"))
    .respond(submit("success"));

  await agent.when(instruct("Determine_Time"))
    .respond(localWrite("time_of_day", "morning"), submit("success"));

  await agent.when(evaluate("Morning_Greeting"))
    .respond(evalAs(true));

  await agent.when(instruct("Morning_Greeting"))
    .respond(localWrite("greeting", "Good morning!"), submit("success"));

  await agent.expectDone();
  await agent.expectLocal({ greeting: "Good morning!" });
} finally {
  await agent.close();
  fixture.cleanup();
}
```

Each `.when(...).respond(...)` line reads as *"when the runtime asks me to do X, the agent responds with Y."* The terminal action in every chain is either `submit(...)` or `eval(...)` — that's what advances the cursor.

## Vocabulary

The DSL mirrors the abtree CLI surface verb-for-verb.

### Step matchers — what the runtime is asking

| Helper | Matches `next` response |
| --- | --- |
| `instruct(name)` | `{ type: "instruct", name, instruction }` |
| `evaluate(name)` | `{ type: "evaluate", name, expression }` |

### Agent actions — what the agent calls back with

| Helper | CLI verb | Terminal? |
| --- | --- | --- |
| `submit(status)` | `abtree submit <id> <success\|failure\|running>` | yes |
| `eval(result)` | `abtree eval <id> <true\|false>` | yes |
| `localWrite(path, value)` | `abtree local write <id> <path> <val>` | no |

Every `.respond(...)` chain must end with exactly one terminal action. The harness throws if the terminal is missing or not last.

### Harness verbs — the rest of the CLI

| Method | CLI verb |
| --- | --- |
| `agent.start(tree, summary)` | `abtree execution create <tree> <summary>` |
| `agent.localRead([path])` | `abtree local read <id> [path]` |
| `agent.globalRead([path])` | `abtree global read <id> [path]` |
| `agent.expectDone()` | asserts the next `next` returns `{ status: "done" }` |
| `agent.expectLocal({ ... })` | reads `$LOCAL` and deep-equals each named slot |
| `agent.close()` | tears the transport down |

## Transports

Both transports take a `cwd` (where the abtree runtime resolves `.abtree/` from) and optionally `command` + `args` for invoking the CLI.

### `CliTransport`

Spawns the abtree CLI once per verb. Each call is a fresh subprocess.

```ts
new CliTransport({ cwd: fixture.cwd });   // assumes `abtree` on PATH

// or, for in-repo source:
new CliTransport({
  cwd: fixture.cwd,
  command: "bun",
  args: ["packages/cli/index.ts"],
});
```

Stateless — `close()` is a no-op.

### `McpTransport`

Spawns the `abtree mcp` server once and drives every subsequent call as an [MCP](/guide/mcp) tool invocation over stdio.

```ts
new McpTransport({ cwd: fixture.cwd });
```

Roughly **8× faster wall-clock** than `CliTransport` for end-to-end scenarios — the subprocess startup is paid once instead of per step.

### Implementing a new transport

Implement the `Transport` interface (eight async methods + a `NextResponse` return type for `next`) and pass an instance to `AgentHarness`. Scenario code runs unchanged.

```ts
import { type Transport, type NextResponse, AgentHarness } from "@abtree/testing";

class HttpTransport implements Transport {
  constructor(private baseUrl: string) {}

  async createExecution(tree: string, summary: string) {
    const r = await fetch(`${this.baseUrl}/executions`, {
      method: "POST",
      body: JSON.stringify({ tree, summary }),
    });
    return r.json();
  }

  async next(id: string): Promise<NextResponse> { /* … */ }
  // submit, eval, localRead, localWrite, globalRead, close
}
```

## Fixtures

`setupTreePackageFixture(opts)` `mkdtemp`'s an isolated dir, copies the tree package's `main.json` into a `<slug>/` subdir, and returns `{ cwd, treePath, cleanup }`. Pass `treePath` to `agent.start(...)`; pair the cleanup with the harness's `close()` in a `finally` block:

```ts
const fixture = setupTreePackageFixture({
  slug: "hello-world",
  treeDir: "/abs/path/to/trees/hello-world",
});

const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
try {
  await agent.start(fixture.treePath, "scenario");
  // …
} finally {
  await agent.close();
  fixture.cleanup();
}
```

Without isolation, executions and snapshots from the run would land in the caller's project tree.

## Sharing one scenario across transports

The scenario lives in one file; runners thread their transport through it. This is the "behavioural parity" pattern — both transports must produce identical observable behaviour against the same tree.

```ts
// scenario.ts — written once
import { type AgentHarness, instruct, submit } from "@abtree/testing";

export async function runScenario(agent: AgentHarness): Promise<void> {
  await agent.when(instruct("Acknowledge_Protocol"))
    .respond(submit("success"));
  // … rest of the scenario
  await agent.expectDone();
}
```

```ts
// run-cli.ts
import { AgentHarness, CliTransport, setupTreePackageFixture } from "@abtree/testing";
import { runScenario } from "./scenario.ts";

const fixture = setupTreePackageFixture({ slug: "X", treeDir: TREE });
const agent = new AgentHarness(new CliTransport({ cwd: fixture.cwd }));
try {
  await agent.start("X", "cli");
  await runScenario(agent);
} finally {
  await agent.close();
  fixture.cleanup();
}
```

`run-mcp.ts` is identical except for `McpTransport`.

## When to reach for the BDD runner instead

`@abtree/test-tree` (the [BDD-style runner](/guide/testing)) is the better fit when:

- The scenario reads naturally as **given/when/then English**.
- External side effects need fixture-driven replay (mocked MR creates, git pushes, HTTP calls).
- Tree authors should be able to add scenarios without writing TypeScript.
- A markdown report (and the live SVG diagram next to the execution) is the deliverable.

The programmatic harness here is the better fit when the scenario is a precise sequence of runtime behaviours you want to assert against — typically regression suites built and maintained by the tree's author or by abtree itself.

## Reference

- Package: [`@abtree/testing`](https://github.com/flying-dice/abtree/tree/main/packages/testing) — full API on every export via TSDoc.
- Worked example: the bundled [`tests/`](https://github.com/flying-dice/abtree/tree/main/tests) directory in the abtree repo runs the same scenario against both transports as a parity check.
