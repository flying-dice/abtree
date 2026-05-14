// MCP server protocol-shape tests using InMemoryTransport.
//
// These cover the parts of the server that don't touch the filesystem:
// tools/list, resources/list, resources/read, and the error-translation
// path. The full hello-world end-to-end walk runs via real subprocess
// in `mcp-bench.test.ts` (which also captures the bench numbers).
//
// The reason for the split: `packages/runtime/src/paths.ts` resolves
// `EXECUTIONS_DIR` / `SNAPSHOTS_DIR` from `process.cwd()` at module
// load time and caches the result, so an in-process server cannot
// easily be redirected at a per-test tmp dir. A subprocess inherits a
// fresh `cwd`, so it can.

import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RESOURCE_URIS } from "../src/mcp/resources.ts";
import { createMcpServer } from "../src/mcp/server.ts";
import { TOOL_NAMES } from "../src/mcp/tools.ts";

const DOCS = {
	execute: "# execute doc\n",
	author: "# author doc\n",
	schema: '{"$schema":"https://json-schema.org/draft-07/schema#"}',
	skill: "# skill doc\n",
};

async function makeClient(): Promise<Client> {
	const server = createMcpServer(DOCS);
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "abtree-test-client", version: "0.0.0" });
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	return client;
}

test("tools/list returns exactly the expected 10 tools", async () => {
	const client = await makeClient();
	const { tools } = await client.listTools();
	const names = tools.map((t) => t.name).sort();
	expect(names).toEqual([...TOOL_NAMES].sort());
	expect(tools).toHaveLength(10);
});

test("each tool carries an object inputSchema", async () => {
	const client = await makeClient();
	const { tools } = await client.listTools();
	for (const tool of tools) {
		expect(tool.inputSchema).toBeDefined();
		expect(tool.inputSchema.type).toBe("object");
	}
});

test("read-only tools carry readOnlyHint: true", async () => {
	const client = await makeClient();
	const { tools } = await client.listTools();
	const readOnly = [
		"abtree_local_read",
		"abtree_global_read",
		"abtree_execution_list",
		"abtree_execution_get",
	];
	for (const name of readOnly) {
		const tool = tools.find((t) => t.name === name);
		expect(tool?.annotations?.readOnlyHint).toBe(true);
	}
});

test("destructive tools carry destructiveHint: true", async () => {
	const client = await makeClient();
	const { tools } = await client.listTools();
	const destructive = ["abtree_local_write", "abtree_execution_reset"];
	for (const name of destructive) {
		const tool = tools.find((t) => t.name === name);
		expect(tool?.annotations?.destructiveHint).toBe(true);
	}
});

test("resources/list returns the four abtree://docs/* entries", async () => {
	const client = await makeClient();
	const { resources } = await client.listResources();
	const uris = resources.map((r) => r.uri).sort();
	expect(uris).toEqual([...RESOURCE_URIS].sort());
	expect(resources).toHaveLength(4);
});

test("resources/read returns the expected body for each doc", async () => {
	const client = await makeClient();
	for (const uri of RESOURCE_URIS) {
		const result = await client.readResource({ uri });
		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]?.uri).toBe(uri);
		const expectedBody =
			DOCS[uri.replace("abtree://docs/", "") as keyof typeof DOCS];
		expect(result.contents[0]?.text).toBe(expectedBody);
	}
});

test("a tool call against a malformed execution id returns isError: true", async () => {
	const client = await makeClient();
	const result = await client.callTool({
		name: "abtree_next",
		arguments: { execution: "no-such-execution" },
	});
	expect(result.isError).toBe(true);
	const content = result.content as { type: string; text: string }[];
	expect(content[0]?.text.length ?? 0).toBeGreaterThan(0);
});

test("abtree_eval and abtree_submit expose an optional note input", async () => {
	const client = await makeClient();
	const { tools } = await client.listTools();
	for (const name of ["abtree_eval", "abtree_submit"]) {
		const tool = tools.find((t) => t.name === name);
		expect(tool).toBeDefined();
		const schema = tool?.inputSchema as {
			properties: Record<string, { description?: string }>;
			required?: string[];
		};
		expect(schema.properties).toHaveProperty("note");
		expect(schema.required ?? []).not.toContain("note");
		expect(schema.properties.note?.description).toContain("trace");
	}
});

test("abtree_submit rejects whitespace-only note via the zod schema", async () => {
	const client = await makeClient();
	const result = await client.callTool({
		name: "abtree_submit",
		arguments: {
			execution: "nope__abtree-hello-world__1",
			status: "success",
			note: "   ",
		},
	});
	expect(result.isError).toBe(true);
});
