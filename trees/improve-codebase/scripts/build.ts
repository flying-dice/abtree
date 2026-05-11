#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildTreeFile } from "@abtree/dsl";
import { validateTreeFile } from "@abtree/runtime";
import { tree } from "../src/tree.ts";

const pkgDir = resolve(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(resolve(pkgDir, "package.json"), "utf8"));
const treeFile = buildTreeFile({ pkg, tree });
validateTreeFile(treeFile);
const outPath = resolve(pkgDir, "main.json");
writeFileSync(outPath, `${JSON.stringify(treeFile, null, "\t")}\n`);
console.log(`wrote ${outPath}`);
