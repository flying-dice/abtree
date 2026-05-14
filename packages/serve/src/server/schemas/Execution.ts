import { z } from "zod";
import { TraceEntry } from "./TraceEntry.ts";

export type ExecutionSummary = z.infer<typeof ExecutionSummary>;

/** Compact row for the list view — omits state blobs to keep payloads small. */
export const ExecutionSummary = z
	.object({
		id: z.string(),
		tree: z.string(),
		summary: z.string(),
		status: z.string(),
		phase: z.string(),
		cursor: z.string(),
		snapshot: z.string(),
		protocolAccepted: z.boolean(),
		traceCount: z.number().int().nonnegative(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.meta({ ref: "ExecutionSummary" });

export type Execution = z.infer<typeof Execution>;

/** Full execution doc — everything an inspector needs in one shot. */
export const Execution = z
	.object({
		id: z.string(),
		tree: z.string(),
		summary: z.string(),
		status: z.string(),
		phase: z.string(),
		cursor: z.string(),
		snapshot: z.string(),
		protocolAccepted: z.boolean(),
		trace: z.array(TraceEntry),
		local: z.record(z.string(), z.unknown()),
		global: z.record(z.string(), z.unknown()),
		runtime: z.object({
			nodeStatus: z.record(z.string(), z.enum(["success", "failure", "running"])),
			stepIndex: z.record(z.string(), z.number().int()),
			retryCount: z.record(z.string(), z.number().int()),
		}),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.meta({ ref: "Execution" });
