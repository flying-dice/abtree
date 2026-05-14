// Static imports of every dist/ file. `with { type: "file" }` returns a
// filesystem path string at runtime — and tells the bundler to embed the
// file inside the compiled binary so that path resolves under `$bunfs`.
//
// The filenames are pinned via `naming: "[name].[ext]"` in `build.ts`.
// Run `bun run build` in this package before the CLI's compile step.

import indexCss from "../../dist/index.css" with { type: "file" };
import indexHtml from "../../dist/index.html" with { type: "file" };
import indexJs from "../../dist/index.js" with { type: "file" };

/** "/path" → filesystem path the server hands to `Bun.file`. */
export const distAssets: Record<string, string> = {
	"/index.html": indexHtml,
	"/index.js": indexJs,
	"/index.css": indexCss,
};

export const distIndexHtml = indexHtml;
