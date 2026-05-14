// MCP resource registrations.
//
// Four static resources at `abtree://docs/{execute,author,schema,skill}`,
// each backed by a `with { type: "text" }` import — the same source the
// commander `docs` subcommand uses. Agents fetch them by URI on demand
// instead of burning a tool call on docs they have already read.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type DocSource = {
	uri: string;
	name: string;
	description: string;
	mimeType: string;
	body: string;
};

export function registerResources(
	server: McpServer,
	docs: {
		execute: string;
		author: string;
		schema: string;
		skill: string;
	},
): void {
	const all: DocSource[] = [
		{
			uri: "abtree://docs/execute",
			name: "execute",
			description:
				"Execution protocol — the binding contract for an agent driving an abtree execution.",
			mimeType: "text/markdown",
			body: docs.execute,
		},
		{
			uri: "abtree://docs/author",
			name: "author",
			description: "Authoring guide for abtree tree files.",
			mimeType: "text/markdown",
			body: docs.author,
		},
		{
			uri: "abtree://docs/schema",
			name: "schema",
			description: "JSON Schema for abtree tree files.",
			mimeType: "application/json",
			body: docs.schema,
		},
		{
			uri: "abtree://docs/skill",
			name: "skill",
			description: "abtree CLI skill manifest.",
			mimeType: "text/markdown",
			body: docs.skill,
		},
	];

	for (const doc of all) {
		server.registerResource(
			doc.name,
			doc.uri,
			{
				title: `abtree ${doc.name}`,
				description: doc.description,
				mimeType: doc.mimeType,
			},
			async (uri) => ({
				contents: [{ uri: uri.href, mimeType: doc.mimeType, text: doc.body }],
			}),
		);
	}
}

export const RESOURCE_URIS = [
	"abtree://docs/execute",
	"abtree://docs/author",
	"abtree://docs/schema",
	"abtree://docs/skill",
] as const;
