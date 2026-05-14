#!/usr/bin/env bun
import { resolve } from "node:path";
import { parseArgs } from "node:util";

type Target = {
	bunTarget: string;
	outfile: string;
};

const matrix: Target[] = [
	{ bunTarget: "bun-linux-x64", outfile: "abtree-linux-x64" },
	{ bunTarget: "bun-linux-arm64", outfile: "abtree-linux-arm64" },
	{ bunTarget: "bun-darwin-x64", outfile: "abtree-darwin-x64" },
	{ bunTarget: "bun-darwin-arm64", outfile: "abtree-darwin-arm64" },
	{ bunTarget: "bun-windows-x64", outfile: "abtree-windows-x64.exe" },
];

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		all: { type: "boolean" },
	},
});

const root = resolve(import.meta.dir, "../../..");
const entrypoint = resolve(root, "packages/cli/index.ts");
const serveDir = resolve(root, "packages/serve");

// Pre-build the inspector frontend so its dist/ assets exist when the
// CLI bundles. The CLI's `serve` subcommand statically imports those
// files via `with { type: "file" }` to embed them into the binary.
console.log("→ building inspector frontend");
const frontend = Bun.spawnSync({
	cmd: ["bun", "run", "build"],
	cwd: serveDir,
	stdout: "inherit",
	stderr: "inherit",
});
if (!frontend.success) process.exit(frontend.exitCode ?? 1);

function compile(outfile: string, bunTarget?: string) {
	const outPath = resolve(root, outfile);
	console.log(`→ ${outfile}${bunTarget ? ` (${bunTarget})` : ""}`);
	const cmd = ["bun", "build", "--compile"];
	if (bunTarget) cmd.push(`--target=${bunTarget}`);
	cmd.push(entrypoint, `--outfile=${outPath}`);
	const result = Bun.spawnSync({ cmd, stdout: "inherit", stderr: "inherit" });
	if (!result.success) process.exit(result.exitCode ?? 1);
}

if (values.all) {
	for (const { bunTarget, outfile } of matrix) compile(outfile, bunTarget);
} else {
	compile(process.platform === "win32" ? "abtree.exe" : "abtree");
}
