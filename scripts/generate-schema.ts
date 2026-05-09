#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildJsonSchema } from "../src/schemas.ts";

const path = resolve(import.meta.dir, "..", "tree.schema.json");
writeFileSync(path, `${JSON.stringify(buildJsonSchema(), null, 2)}\n`);
console.log(`wrote ${path}`);
