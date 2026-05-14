---
id: 1779000000-pure-delegate-desugar
title: delegate(…) DSL builder for subagent scopes
status: refined
author: Starscream
created: 2026-05-13
reviewed_by: Starscream
---

## Summary

Add a `delegate(name, options, body)` helper to `@abtree/dsl` that desugars at build time into a normal `sequence` of standard nodes — a Spawn marker action, the user's body children verbatim, and a Return marker action carrying a build-time-generated exit token. The runtime is unchanged: it walks the desugared tree as plain `sequence`/`selector`/`action` nodes, with no new node type, no new CLI verb, and no new response shape from `abtree next`. Migrate the hello-world tree to the new builder as the end-to-end smoke test.

## Requirements

- Public surface: `delegate(name: string, options: DelegateOptions, body: () => void): CompositeNode`, exported from `@abtree/dsl` alongside `sequence` / `selector` / `parallel` / `action`.
- `DelegateOptions` shape:
  - `brief?: string` — free-form text describing the subagent's job. Interpolated verbatim into the Spawn instruct, framed under a `BRIEF:` heading so it is visibly distinct from the boilerplate.
  - `model?: string` — advisory model hint (e.g. `"haiku"`, `"sonnet"`, `"opus"`). Interpolated into the Spawn instruct as a "Use model: <value>. If your harness does not support model selection, ignore this hint." line. abtree does not enforce it; the parent agent's harness decides.
  - `output?: LocalRef<unknown>` — optional `$LOCAL` ref the inner work is expected to populate. When set, the `Return_To_Parent_<name>` action gets a leading `evaluate("${output} is set")` step so the scope fails if the subagent didn't deliver. When unset, the Return action has only the exit instruct.
- Exit token generation: build-time and deterministic. Format `DLG__<scope-name>__<short-hash>`, where `<short-hash>` is the first 8 hex chars of `sha256(<scope-name> + ":" + dslVersion)`. Same source → same token, so generated `main.json` files are reproducible across builds. The token is baked verbatim into both marker instructs.
- Desugaring shape: `delegate("X", opts, body)` appends a single `sequence` child named exactly `X` to the current composite parent, whose children are `[Spawn_X, ...body-children-verbatim, Return_To_Parent_X]`. Wrapping in its own sequence preserves single-unit semantics, so the helper works correctly inside both `sequence` and `selector` parents.
- Spawn instruct boilerplate must contain, in this order: (a) the submit-before-spawn ordering reminder; (b) the exit token literal; (c) the model hint, if `opts.model`; (d) the author's brief, if `opts.brief`, framed under a `BRIEF:` heading; (e) the subagent-side brief (drive `abtree next/eval/submit`, return the exit token verbatim on processing `Return_To_Parent_<name>`); (f) the parent's verification step ("if returned reply ≠ <exit-token>, the scope failed").
- Failure-mode token: when the subagent's `abtree next` returns `{status:"done"}` or `{status:"failure"}` while inside the scope, the subagent must return the literal `<exit-token>__FAILED` instead of the success token. The parent recognises any reply other than the exact `<exit-token>` (including `__FAILED`) as scope failure. Both tokens are specified in the spawn boilerplate.
- Return instruct boilerplate must contain, in this order: (a) the exit token literal; (b) instruction to submit success and return only the token; (c) an explicit "do not call `abtree next` again".
- `output`-gate semantics: the optional `evaluate("${output} is set")` step on `Return_To_Parent_<name>` exists specifically to catch the case where the subagent submitted success for every inner action but didn't actually populate the declared `$LOCAL` slot. The complementary case — inner-body actions themselves failing — already surfaces via the standard tree-walk failure path and does not need the gate.
- Nested delegation: a `delegate(...)` call inside another `delegate(...)`'s `body` must produce its own marker pair with its own token. Recursive by construction — no special handling beyond independent token derivation per scope name.
- No `delegate` node type in the runtime. `@abtree/runtime`'s `validateTreeFile` continues to see only `sequence` / `selector` / `parallel` / `action` and accepts the desugared output unchanged.
- Hello-world migration: `trees/hello-world/src/tree.ts` is rewritten to use `delegate(...)` in place of the hand-written marker pair currently in `trees/hello-world/main.json`. The regenerated `main.json` is committed alongside the source change.

## Technical Approach

1. **`packages/dsl/src/index.ts`** — add the `delegate` export after `parallel` / `action`. Outline:
   - Internal helper `deriveExitToken(scopeName: string): string` using `createHash` from `node:crypto` (Bun supports the `node:crypto` namespace natively). Returns `` `DLG__${scopeName}__${createHash("sha256").update(scopeName + ":" + DSL_VERSION).digest("hex").slice(0, 8)}` ``. `DSL_VERSION` is read from `packages/dsl/package.json`. Use whichever import strategy the DSL package currently uses for its own metadata (Bun-style `import pkg from "../package.json" with { type: "json" }` or `readFileSync` + `JSON.parse`); add the import if no such reference exists yet.
   - Public `delegate` export carries a JSDoc block matching the style of `sequence` / `selector` / `parallel` / `action` (rich `@param`, `@returns`, `@example`). The example shows brief + model + output usage against the hello-world greeting scope.
   - Internal helpers `spawnInstruct(scopeName, token, opts)` and `returnInstruct(scopeName, token)` returning the boilerplate strings (see template module below).
   - Public function:
     ```ts
     export function delegate(
       name: string,
       options: DelegateOptions,
       body: () => void,
     ): CompositeNode {
       const token = deriveExitToken(name);
       return sequence(name, () => {
         action(`Spawn_${name}`, () => instruct(spawnInstruct(name, token, options)));
         body();
         action(`Return_To_Parent_${name}`, () => {
           if (options.output) evaluate(`${options.output} is set`);
           instruct(returnInstruct(name, token));
         });
       });
     }
     ```
   - Export `DelegateOptions` and `delegate` from the package barrel.
2. **`packages/dsl/src/delegate-templates.ts`** (new file) — holds the two template functions returning the boilerplate strings. Templates use plain TS template literals; no separate templating engine. Centralising them here keeps `index.ts` lean and lets tests assert against a stable string layout. Templates are deliberately verbose — explaining the submit-before-spawn quirk in one place that every generated tree inherits.
3. **`packages/dsl/tests/delegate.test.ts`** (new file) — cases:
   - `delegate(...)` inside a `sequence` emits exactly one sequence child whose name matches the scope and whose children are `[Spawn_<name>, ...body, Return_To_Parent_<name>]` in order.
   - Spawn instruct string contains the exit token, the brief (when supplied), and the model hint (when supplied).
   - Return instruct string contains the same exit token literal.
   - The exit token is deterministic for the same scope name across two builder invocations.
   - Different scope names produce different tokens (smoke check, not exhaustive collision proof).
   - Nested `delegate(...)` inside another `delegate(...)` produces two distinct tokens, each present only in its own marker pair.
   - When `output` is supplied, the Return action's first step is `{ evaluate: "${output} is set" }` and the second step is the instruct.
   - When `output` is omitted, the Return action has exactly one step (the instruct).
   - The full desugared tree round-trips through `validateTreeFile` (imported from `@abtree/runtime`) without errors.
4. **Hello-world migration** — rewrite `trees/hello-world/src/tree.ts`:
   ```ts
   sequence("Hello_World", () => {
     action("Determine_Time", () => instruct(`…classify and store at ${timeOfDay}.`));
     delegate("Compose_Greeting", {
       brief: "Pick the time-of-day branch matching ${timeOfDay} and compose a single short greeting sentence.",
       model: "haiku",
       output: greeting,
     }, () => {
       selector("Choose_Greeting", () => {
         action("Morning_Greeting",   () => { evaluate(`${timeOfDay} is "morning"`);   instruct(`Compose cheerful morning greeting … store at ${greeting}.`); });
         action("Afternoon_Greeting", () => { evaluate(`${timeOfDay} is "afternoon"`); instruct(`Compose warm afternoon greeting … store at ${greeting}.`); });
         action("Evening_Greeting",   () => { evaluate(`${timeOfDay} is "evening"`);   instruct(`Compose relaxed evening greeting … store at ${greeting}.`); });
       });
     });
     action("Announce_Greeting", () => instruct(`Read ${greeting} and print it verbatim.`));
   });
   ```
   Then `cd trees/hello-world && bun run build` to regenerate `main.json`. Commit both source and regenerated artefact.
5. **Smoke run** — re-execute the regenerated hello-world `main.json` end-to-end against the same protocol the hand-written prototype passed. Expected behaviour is identical; the only difference is that the boilerplate text in the Spawn / Return marker instructs is now generated by the helper rather than written by hand.

## Affected Systems

- `packages/dsl/src/index.ts` — new `delegate` export, new internal `deriveExitToken` helper.
- `packages/dsl/src/delegate-templates.ts` — new file holding the spawn and return boilerplate templates.
- `packages/dsl/tests/delegate.test.ts` — new test file.
- `trees/hello-world/src/tree.ts` — rewrite to use `delegate(...)`.
- `trees/hello-world/main.json` — regenerated from the new source; replaces the hand-written prototype.
- Possibly `abtree docs author` (CLI-embedded authoring guide) or the `@abtree/dsl` README — short subsection introducing `delegate` and the agent convention it relies on. The runtime docs (`abtree docs execute`) get **no** new response types; a one-sentence pointer to the convention is enough.
- Unchanged: `packages/runtime/*`, `packages/cli/*`.

## Acceptance Criteria

- `delegate(...)` in DSL source builds without errors and `validateTreeFile` accepts the output.
- For a scope `delegate("X", opts, body)`, the generated tree contains exactly one `sequence` node named `X` whose children are `[Spawn_X, ...body-children-verbatim, Return_To_Parent_X]`. No other structural changes.
- The Spawn action's instruct text contains the exit token literal, the failure-token literal (`<token>__FAILED`), and the ordering reminder, in every generated tree. The model hint line is present iff `opts.model` supplied and absent iff omitted; the `BRIEF:` heading + author's brief is present iff `opts.brief` supplied and absent iff omitted. Both presence and absence cases are covered by tests.
- The Return action's instruct text contains the same exit token literal. The action's first step is `evaluate("${opts.output} is set")` iff `opts.output` supplied; otherwise the action has exactly one step (the instruct).
- After migration, the hello-world tree runs end-to-end with identical observable behaviour to the hand-written prototype: parent submits Spawn, spawns a subagent honouring the brief + model hint, subagent drives the inner walk and returns the build-time-generated token, parent verifies and resumes at `Announce_Greeting` with `$LOCAL.greeting` populated.
- `bun test` passes in `packages/dsl/` including the new `delegate` tests.
- Nothing in `packages/runtime/` or `packages/cli/` changes.

## Risks & Considerations

- **Build-time tokens are in the tree file.** Anyone with the generated JSON can read the exit token. Intentional: the token is a clean-exit signal, not a security boundary. Agents already have full `$LOCAL` access via the CLI; forging the token is the cheapest of many available attacks for a malicious subagent.
- **No runtime enforcement of the convention.** A subagent that ignores `Return_To_Parent` and keeps calling `next` walks past the scope into the parent's post-scope work. The convention is policed by the parent agent's token-verification step in the spawn boilerplate, not by the runtime. Acceptable trade — same trust model as every other instruct.
- **Submit-before-spawn bends "action complete" semantics.** The Spawn instruct is framed as "delegation dispatched", not "delegation finished". The boilerplate explains why; the `delegate` builder hides the awkwardness from authors so it only needs explaining in one place.
- **Model hint is advisory.** Whether `model: "haiku"` is honoured depends on the parent agent's harness. abtree has no opinion. The boilerplate states this explicitly so authors don't rely on the hint as load-bearing.
- **Nested delegation duplication.** Each nested `delegate(...)` produces its own ~30-line boilerplate paragraph in the tree file. Generated JSON gets verbose. Acceptable since tree files are build artefacts, not hand-edited.
- **Project memory: no backwards compatibility.** abtree is pre-release; no migration path or compatibility shim required. The hello-world prototype `main.json` is regenerated and replaces the hand-written version outright.

## Open Questions

- Should `DelegateOptions` expose a `subagentType` field mapping to harness-specific named agent roles (e.g. `"general-purpose"`, `"Plan"`)? V1 decision: no — fold any harness-role guidance into `brief`. Revisit only if a second consumer ships a concrete need.

(Other previously-open items resolved: boilerplate templates are NOT author-overridable in v1; renderer support for delegated scopes is explicitly out of scope and tracked separately if wanted.)
