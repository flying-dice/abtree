#!/usr/bin/env bun
import { Command } from "commander";
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

const program = new Command()
  .name("abt")
  .description("Agent Behaviour Tree CLI")
  .version("1.0.0");

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

program.parse();
