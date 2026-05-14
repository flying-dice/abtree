import { createFactory } from "hono/factory";
import { Application } from "./Application.ts";

export type Env = {
	Variables: {
		app: Application;
	};
};

/**
 * Module-level slot the bootstrap fills before routes are loaded.
 * Routes import the factory eagerly, so the singleton must exist by
 * the time any handler runs. `getApplication` throws if the bootstrap
 * forgot to call `setApplication` — surfacing the wiring bug at the
 * first request instead of with a confusing `undefined` field access.
 */
let application: Application | null = null;

export function setApplication(app: Application): void {
	application = app;
}

export function getApplication(): Application {
	if (!application) {
		throw new Error(
			"Application not initialised — call setApplication() before booting Hono.",
		);
	}
	return application;
}

export default createFactory<Env>({
	initApp: (app) => {
		app.use(async (c, next) => {
			c.set("app", getApplication());
			await next();
		});
	},
});
