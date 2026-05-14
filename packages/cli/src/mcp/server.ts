// MCP server entry point. Builds an `McpServer`, wires the registered
// tools and resources, and (in `runMcpServer`) connects a stdio
// transport. The factory `createMcpServer` is exported separately so
// tests can pair the server with an `InMemoryTransport` without spawning
// a subprocess.

import { rebuildSvg, setMutationListener } from "@abtree/runtime";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION } from "../version.ts";
import { registerResources } from "./resources.ts";
import { registerTools } from "./tools.ts";

export interface McpDocs {
	execute: string;
	author: string;
	schema: string;
	skill: string;
}

export function createMcpServer(docs: McpDocs): McpServer {
	const server = new McpServer({
		name: "abtree",
		version: VERSION,
	});
	registerTools(server);
	registerResources(server, docs);
	return server;
}

export async function runMcpServer(docs: McpDocs): Promise<void> {
	// Same mutation listener the CLI registers at process start. Tool
	// calls that change execution state get the same on-disk SVG
	// diagnostic as commander-side writes.
	setMutationListener((id) => {
		rebuildSvg(id);
	});
	const server = createMcpServer(docs);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
