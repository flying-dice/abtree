#!/usr/bin/env bun
import { Command } from "commander";
import { initDb } from "./src/db.ts";
import {
  cmdTreeList,
  cmdFlowCreate,
  cmdFlowList,
  cmdFlowGet,
  cmdFlowReset,
  cmdNext,
  cmdEval,
  cmdSubmit,
  cmdLocalRead,
  cmdLocalWrite,
  cmdGlobalRead,
} from "./src/commands.ts";
import {
  parseFlowId,
  parseTreeSlug,
  parseSummary,
  parseScopePath,
  parseEvalResult,
  parseSubmitStatus,
} from "./src/validate.ts";

const EXECUTION_GUIDE = `
EXECUTION PROTOCOL
==================

ABT is a durable behaviour tree engine. Flows bind a tree to a piece of work
and track progress in SQLite with two state scopes:
  $LOCAL  — per-flow blackboard (read/write)
  $GLOBAL — world model (read-only)

STRICT: Never read tree files directly. All interaction goes through this CLI.

--- Routing ---

  No arguments       → flow list; resume an existing flow or pick a tree
  <flow-id>          → resume that flow
  <tree-slug>        → create a new flow (remaining args = summary)
  list               → show all flows

--- Create protocol ---

  abt flow create <tree> <summary>
  abt local write <flow> change_request "<request>"
  abt next <flow>   ← begin execution loop

--- Execution loop ---

Call  abt next <flow>  to get the next request. Repeat until done.

Response shapes:

  { "type": "evaluate", "name": "…", "expression": "…" }
    → Read referenced $LOCAL/$GLOBAL values with abt local read / abt global read.
      Judge whether the expression is semantically true or false.
      Call: abt eval <flow> true|false

  { "type": "instruct", "name": "…", "instruction": "…" }
    → Do the work described. Write results to $LOCAL via abt local write.
      Call: abt submit <flow> success|failure

  { "status": "done" }    → tree complete. Report outcome.
  { "status": "failure" } → tree failed. Report what happened.

--- Strict rules ---

  • Evaluate from actual state only — call abt local read / abt global read.
    Never judge an expression from memory or context.
  • No inference — every value written to $LOCAL must come from an explicit
    source named in the instruction (tool, command, $LOCAL/$GLOBAL path, or
    a literal fallback). If the source is ambiguous, call submit failure.

--- Available trees ---

  backend-design | code-review | frontend-design | implement | refine

--- State commands ---

  abt local read  <flow> [path]         Read from $LOCAL
  abt local write <flow> <path> <val>   Write to $LOCAL
  abt global read <flow> [path]         Read from $GLOBAL

--- Reporting (per action) ---

  [flow-id] ✓ Action_Name → success|failure
`;

const program = new Command()
  .name("abt")
  .description("Durable execution engine for Agent Behaviour Trees. Creates flows that track work via a structured tree walk.")
  .version("1.0.0")
  .addHelpText("after", EXECUTION_GUIDE);

const tree = program.command("tree").description("Manage behaviour trees");
tree.command("list").description("List available trees").action(() => {
  cmdTreeList();
});

const flow = program.command("flow").description("Manage flows");

flow
  .command("create")
  .description("Create a new flow")
  .argument("<tree>", "Tree slug")
  .argument("<summary...>", "Flow summary")
  .action((treeSlug: string, summaryParts: string[]) => {
    cmdFlowCreate(parseTreeSlug(treeSlug), parseSummary(summaryParts.join(" ")));
  });

flow
  .command("list")
  .description("List all flows")
  .action(() => { cmdFlowList(); });

flow
  .command("get")
  .description("Get flow details")
  .argument("<id>", "Flow ID")
  .action((id: string) => { cmdFlowGet(parseFlowId(id)); });

flow
  .command("reset")
  .description("Reset flow to initial state")
  .argument("<id>", "Flow ID")
  .action((id: string) => { cmdFlowReset(parseFlowId(id)); });

program
  .command("next")
  .description("Get next evaluate/instruct request")
  .argument("<flow>", "Flow ID")
  .action((flowId: string) => { cmdNext(parseFlowId(flowId)); });

program
  .command("eval")
  .description("Submit evaluation result")
  .argument("<flow>", "Flow ID")
  .argument("<result>", "true or false")
  .action((flowId: string, result: string) => {
    cmdEval(parseFlowId(flowId), parseEvalResult(result));
  });

program
  .command("submit")
  .description("Submit instruction outcome")
  .argument("<flow>", "Flow ID")
  .argument("<status>", "success, failure, or running")
  .action((flowId: string, status: string) => {
    cmdSubmit(parseFlowId(flowId), parseSubmitStatus(status));
  });

const local = program.command("local").description("Manage $LOCAL scope");

local
  .command("read")
  .description("Read from $LOCAL")
  .argument("<flow>", "Flow ID")
  .argument("[path]", "Dot-notated path")
  .action((flowId: string, path?: string) => { cmdLocalRead(parseFlowId(flowId), path); });

local
  .command("write")
  .description("Write to $LOCAL")
  .argument("<flow>", "Flow ID")
  .argument("<path>", "Dot-notated path")
  .argument("<value...>", "Value (JSON or string)")
  .action((flowId: string, path: string, valueParts: string[]) => {
    cmdLocalWrite(parseFlowId(flowId), parseScopePath(path), valueParts.join(" "));
  });

const global = program.command("global").description("Manage $GLOBAL scope");

global
  .command("read")
  .description("Read from $GLOBAL")
  .argument("<flow>", "Flow ID")
  .argument("[path]", "Dot-notated path")
  .action((flowId: string, path?: string) => { cmdGlobalRead(parseFlowId(flowId), path); });

initDb();
program.parse();
