import { Scalar } from "@scalar/hono-api-reference";
import { openAPIRouteHandler } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import { name, version } from "../../package.json";
import ApplicationFactory from "./ApplicationFactory.ts";
import { GetExecution } from "./routes/GetExecution.ts";
import { GetExecutions } from "./routes/GetExecutions.ts";
import { GetExecutionTree } from "./routes/GetExecutionTree.ts";
import type { ErrorData } from "./schemas/ErrorData.ts";

export const app = ApplicationFactory.createApp();

app.onError((err, c) => {
	const data: ErrorData = {
		error: err.name || "internal_error",
		message: err.message,
		status: StatusCodes.INTERNAL_SERVER_ERROR,
		timestamp: new Date().toISOString(),
	};
	return c.json(data, StatusCodes.INTERNAL_SERVER_ERROR);
});

app.get("/api/executions", ...GetExecutions);
app.get("/api/executions/:id", ...GetExecution);
app.get("/api/executions/:id/tree", ...GetExecutionTree);

app.get(
	"/v3/api-docs",
	openAPIRouteHandler(app, {
		documentation: {
			info: {
				title: name,
				version,
			},
		},
	}),
);

app.get("/api", Scalar({ url: "/v3/api-docs" }));
