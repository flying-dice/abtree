import { serve as bunServe } from "bun";
import { Application } from "./Application.ts";
import { setApplication } from "./ApplicationFactory.ts";
import { app } from "./app.ts";
import { distAssets, distIndexHtml } from "./dist-assets.ts";

export interface StartProps {
	executionsPath: string;
	port: number;
	development: boolean;
}

export interface StartHandle {
	url: string;
	port: number;
	stop: () => Promise<void>;
}

/**
 * Boot the Bun.serve HTTP server.
 *
 * `/api/*`, `/v3/api-docs`, and `/api` (Scalar) go through the Hono
 * app. Frontend assets come from the `dist/` bundle produced by
 * `bun run build` in this package; those files are embedded into the
 * compiled CLI binary via the `with { type: "file" }` imports in
 * {@link ./dist-assets.ts}, so this works the same in dev (where dist
 * is built on disk) and in production (where dist lives inside
 * `$bunfs`). Unknown paths fall back to `index.html` for SPA routing.
 */
export function startServer(props: StartProps): StartHandle {
	setApplication(new Application({ executionsPath: props.executionsPath }));

	const server = bunServe({
		port: props.port,
		routes: {
			"/v3/api-docs": app.fetch,
			"/api/*": app.fetch,
			"/api": app.fetch,
		},
		async fetch(req) {
			const url = new URL(req.url);
			const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
			const asset = distAssets[pathname];
			if (asset) return new Response(Bun.file(asset));
			// SPA fallback so deep links land on the React router.
			return new Response(Bun.file(distIndexHtml), {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		},
	});

	console.log(
		`abtree serve → ${server.url} (executions: ${props.executionsPath})`,
	);

	return {
		url: server.url.toString(),
		port: server.port,
		stop: async () => {
			await server.stop();
		},
	};
}
