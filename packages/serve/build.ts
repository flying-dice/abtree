import { rm } from "node:fs/promises";
import path from "node:path";
import tailwind from "bun-plugin-tailwind";

const outdir = path.join(import.meta.dir, "dist");
await rm(outdir, { recursive: true, force: true });

// Stable output names so `src/server/dist-assets.ts` can statically
// import each asset via `with { type: "file" }` — those imports are what
// embed the frontend into the compiled CLI binary.
const result = await Bun.build({
	entrypoints: [path.join(import.meta.dir, "src/index.html")],
	outdir,
	plugins: [tailwind],
	minify: true,
	target: "browser",
	sourcemap: "linked",
	naming: {
		entry: "[name].[ext]",
		chunk: "[name].[ext]",
		asset: "[name].[ext]",
	},
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
});

if (!result.success) {
	console.error("Frontend bundle failed");
	for (const log of result.logs) console.error(log);
	process.exit(1);
}

for (const output of result.outputs) {
	console.log(
		` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`,
	);
}
