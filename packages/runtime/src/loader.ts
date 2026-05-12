// Turns the caller's `tree` argument (slug or path) into a fully-parsed,
// dereferenced, validated, and normalised `ParsedTree`.
//
// Tree files can split themselves across multiple YAML/JSON documents using
// JSON-Schema-style $ref. The ref-parser dereferences relative paths,
// absolute paths, and URLs at load time so the rest of the pipeline sees
// one fully-resolved object.
//
//   tree:
//     type: sequence
//     children:
//       - $ref: "./fragments/auth.yaml"
//       - $ref: "./fragments/work.yaml"
//
// The returned `slug` is sanitised for safe use as an execution-ID prefix.

import $RefParser from "@apidevtools/json-schema-ref-parser";
import { resolveTreeArg } from "./tree-arg.ts";
import type { ParsedTree } from "./types.ts";
import { normalizeNode, validateTreeFile } from "./validate.ts";

export interface LoadedTree {
	yamlPath: string;
	slug: string;
	parsed: ParsedTree;
}

export async function loadTree(arg: string): Promise<LoadedTree | null> {
	const resolution = resolveTreeArg(arg);
	if (!resolution) return null;
	const parsed = await parseTreeAtPath(resolution.yamlPath);
	return { yamlPath: resolution.yamlPath, slug: resolution.slug, parsed };
}

// circular: 'ignore' leaves cyclic edges as literal { $ref: "..." }
// objects in the resolved tree. Non-cyclic refs are still expanded.
// This stops a cycle from blowing the stack at validate / snapshot
// time; the ref node is preserved in the snapshot and surfaces a
// clean failure if the runtime ever ticks it.
async function parseTreeAtPath(yamlPath: string): Promise<ParsedTree> {
	const raw = await $RefParser.dereference(yamlPath, {
		dereference: { circular: "ignore" },
	});
	const parsed = validateTreeFile(raw);
	return {
		local: parsed.state?.local ?? {},
		global: parsed.state?.global ?? {},
		root: normalizeNode(parsed.tree),
	};
}
