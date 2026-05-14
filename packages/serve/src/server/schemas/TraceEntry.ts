import { z } from "zod";

export type TraceEntry = z.infer<typeof TraceEntry>;

/**
 * One entry of the execution audit log — what the agent submitted, the
 * cursor the engine had pointed at when it acted, and the outcome the
 * engine returned. `note` is free-form prose written by the agent
 * (e.g. "matched morning_greeting condition") and is the primary
 * exploration surface in the UI.
 */
export const TraceEntry = z
	.object({
		ts: z.string(),
		kind: z.enum(["evaluate", "instruct", "protocol"]),
		cursor: z.string(),
		name: z.string(),
		submitted: z.string(),
		outcome: z.string(),
		note: z.string().optional(),
	})
	.meta({ ref: "TraceEntry" });
