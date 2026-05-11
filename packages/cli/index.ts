#!/usr/bin/env bun
import {
	parseEvalResult,
	parseExecutionId,
	parseScopePath,
	parseSubmitStatus,
	parseSummary,
	parseTreeSlug,
	rebuildMermaid,
	setMutationListener,
} from "abtree_runtime";
import { Command } from "commander";
import AUTHOR_DOC from "../../docs/agents/author.md" with { type: "text" };
import EXECUTE_DOC from "../../docs/agents/execute.md" with { type: "text" };
import TREE_SCHEMA from "../../tree.schema.json" with { type: "text" };
import SKILL_CONTENT from "./SKILL.md" with { type: "text" };
import {
	cmdDocs,
	cmdEval,
	cmdExecutionCreate,
	cmdExecutionGet,
	cmdExecutionList,
	cmdExecutionReset,
	cmdGlobalRead,
	cmdInstallSkill,
	cmdLocalRead,
	cmdLocalWrite,
	cmdNext,
	cmdSubmit,
	cmdUpgrade,
} from "./src/commands.ts";
import { VERSION } from "./src/version.ts";

setMutationListener(rebuildMermaid);

const program = new Command()
	.name("abtree")
	.description(
		"Durable execution engine for Agent Behaviour Trees. Creates executions that track work via a structured tree walk.",
	)
	.version(VERSION)
	.addHelpText(
		"after",
		`
Documentation:
  abtree docs execute   Runtime protocol — what an agent does at each step.
  abtree docs author    YAML authoring guide for tree files.
  abtree docs schema    JSON Schema for tree YAML files.
  abtree docs skill     The agent skill (same content 'install skill' writes).
`,
	);

const docs = program
	.command("docs")
	.description("Print embedded documentation");
docs
	.command("execute")
	.description("Print the execution protocol (for agents driving abtree)")
	.action(() => {
		cmdDocs(EXECUTE_DOC);
	});
docs
	.command("author")
	.description("Print the tree-authoring guide")
	.action(() => {
		cmdDocs(AUTHOR_DOC);
	});
docs
	.command("schema")
	.description("Print the JSON Schema for tree YAML files")
	.action(() => {
		cmdDocs(TREE_SCHEMA);
	});
docs
	.command("skill")
	.description("Print the agent skill (same content `install skill` writes)")
	.action(() => {
		cmdDocs(SKILL_CONTENT);
	});

const execution = program.command("execution").description("Manage executions");

execution
	.command("create")
	.description("Create a new execution")
	.argument("<tree>", "Tree slug")
	.argument("<summary...>", "Execution summary")
	.action(async (treeSlug: string, summaryParts: string[]) => {
		await cmdExecutionCreate(
			parseTreeSlug(treeSlug),
			parseSummary(summaryParts.join(" ")),
		);
	});

execution
	.command("list")
	.description("List all executions")
	.action(() => {
		cmdExecutionList();
	});

execution
	.command("get")
	.description("Get execution details")
	.argument("<id>", "Execution ID")
	.action((id: string) => {
		cmdExecutionGet(parseExecutionId(id));
	});

execution
	.command("reset")
	.description("Reset execution to initial state")
	.argument("<id>", "Execution ID")
	.action((id: string) => {
		cmdExecutionReset(parseExecutionId(id));
	});

program
	.command("next")
	.description("Get next evaluate/instruct request")
	.argument("<execution>", "Execution ID")
	.action((executionId: string) => {
		cmdNext(parseExecutionId(executionId));
	});

program
	.command("eval")
	.description("Submit evaluation result")
	.argument("<execution>", "Execution ID")
	.argument("<result>", "true or false")
	.action((executionId: string, result: string) => {
		cmdEval(parseExecutionId(executionId), parseEvalResult(result));
	});

program
	.command("submit")
	.description("Submit instruction outcome")
	.argument("<execution>", "Execution ID")
	.argument("<status>", "success, failure, or running")
	.action((executionId: string, status: string) => {
		cmdSubmit(parseExecutionId(executionId), parseSubmitStatus(status));
	});

const local = program.command("local").description("Manage $LOCAL scope");

local
	.command("read")
	.description("Read from $LOCAL")
	.argument("<execution>", "Execution ID")
	.argument("[path]", "Dot-notated path")
	.action((executionId: string, path?: string) => {
		cmdLocalRead(parseExecutionId(executionId), path);
	});

local
	.command("write")
	.description("Write to $LOCAL")
	.argument("<execution>", "Execution ID")
	.argument("<path>", "Dot-notated path")
	.argument("<value...>", "Value (JSON or string)")
	.action((executionId: string, path: string, valueParts: string[]) => {
		cmdLocalWrite(
			parseExecutionId(executionId),
			parseScopePath(path),
			valueParts.join(" "),
		);
	});

const global = program.command("global").description("Manage $GLOBAL scope");

global
	.command("read")
	.description("Read from $GLOBAL")
	.argument("<execution>", "Execution ID")
	.argument("[path]", "Dot-notated path")
	.action((executionId: string, path?: string) => {
		cmdGlobalRead(parseExecutionId(executionId), path);
	});

const install = program
	.command("install")
	.description("Install abtree integrations");

install
	.command("skill")
	.description(
		"Install the abtree Agent Skill. Prompts for platform and scope, or pass --variant and --scope to skip the prompts.",
	)
	.option(
		"--variant <variant>",
		"Skill platform: claude (.claude/skills) | agents (.agents/skills)",
	)
	.option("--scope <scope>", "Install scope: project | user")
	.action(async (opts: { variant?: string; scope?: string }) => {
		await cmdInstallSkill(SKILL_CONTENT, opts);
	});

program
	.command("upgrade")
	.description("Upgrade abtree to the latest release from GitHub")
	.option("--check", "Print current and latest versions then exit")
	.option("--version <tag>", "Pin to a specific release tag")
	.option("--yes", "Skip confirmation prompt")
	.action(
		async (opts: { check?: boolean; version?: string; yes?: boolean }) => {
			await cmdUpgrade(opts);
		},
	);

program.parse();
