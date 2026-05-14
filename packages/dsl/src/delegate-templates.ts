/**
 * Boilerplate templates for the {@link delegate} DSL helper.
 *
 * `spawnInstruct` and `returnInstruct` return the long-form instruction
 * strings that the helper bakes into the generated `Spawn_<name>` and
 * `Return_To_Parent_<name>` marker actions.
 *
 * The strings are deliberately verbose: they explain the
 * submit-before-spawn ordering, the exit/failure tokens, the verification
 * step, and the optional author-supplied brief and model hint. Every
 * generated tree inherits the same explanation, so the convention only
 * has to live in one place.
 *
 * Note that {@link instruct} collapses whitespace before emitting, so any
 * line breaks here are for source readability only.
 *
 * @packageDocumentation
 */

/**
 * Options shared between the helper and the templates. Mirrors the public
 * `DelegateOptions` from `./index.ts` but kept here as a structural type
 * so this module has no dependency on the public surface.
 */
export interface DelegateTemplateOptions {
	brief?: string;
	model?: string;
}

/**
 * Build the `instruct` text for the `Spawn_<name>` marker action.
 *
 * @param name - The delegated scope's name.
 * @param token - The build-time-generated exit token.
 * @param opts - Author-supplied options (`brief`, `model`).
 */
export function spawnInstruct(
	name: string,
	token: string,
	opts: DelegateTemplateOptions,
): string {
	const modelHint = opts.model
		? `Use model: "${opts.model}". If your harness does not support model selection, ignore this hint.`
		: "";
	const briefBlock = opts.brief ? `BRIEF: ${opts.brief}` : "";

	return `
		Delegate the next stretch of the tree to a subagent.
		Exit token: ${token}.
		Failure token: ${token}__FAILED.

		ORDERING — submit success for THIS step BEFORE spawning the
		subagent, because the runtime advances the cursor only on submit.
		Otherwise the subagent's first \`abtree next\` would return this
		same instruct.

		${modelHint}

		${briefBlock}

		Procedure:
		(1) Call \`abtree submit <execution> success\` for this step now.
		(2) Spawn a subagent with this brief: drive
		\`abtree next/eval/submit\` on this execution. For evaluates, read
		every referenced $LOCAL/$GLOBAL path from the store before
		calling \`abtree eval\`. When you process an instruct named
		\`Return_To_Parent_${name}\`, follow its text: submit success for
		that step, then return ONLY the literal token \`${token}\` to your
		parent and do not call \`abtree next\` again. If \`abtree next\`
		ever returns \`{status:"done"}\` or \`{status:"failure"}\`, return
		ONLY the literal token \`${token}__FAILED\`.
		(3) Block on the subagent.
		(4) Verify the returned reply equals exactly \`${token}\`. Any
		other reply (including \`${token}__FAILED\` or extra text) means
		the scope failed — surface that and stop driving.
		(5) On successful verification, call \`abtree next\` to receive
		the next post-scope action.
	`;
}

/**
 * Build the `instruct` text for the `Return_To_Parent_<name>` marker
 * action.
 *
 * @param name - The delegated scope's name (used for self-identification
 *   in the text so the subagent can confirm it is at the exit point).
 * @param token - The build-time-generated exit token to return verbatim.
 */
export function returnInstruct(name: string, token: string): string {
	return `
		Subagent exit point for scope \`${name}\`. Submit success for this
		step, then return ONLY the literal token \`${token}\` to your
		parent. Do not call \`abtree next\` again — the parent will resume
		from here.
	`;
}
