import { StatusCodes } from "http-status-codes";
import { z } from "zod";

export type ErrorData = z.infer<typeof ErrorData>;

export const ErrorData = z
	.object({
		timestamp: z.string(),
		status: z.enum(StatusCodes),
		error: z.string(),
		message: z.string(),
	})
	.meta({ ref: "ErrorData" });
