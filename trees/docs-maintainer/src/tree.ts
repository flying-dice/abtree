import {
	action,
	ambient,
	evaluate,
	global,
	instruct,
	local,
	sequence,
} from "@abtree/dsl";

// ─── docs inventory & sitemap ────────────────────────────────────────────
const inventory = local("inventory", null);
const sitemap = local("sitemap", null);
const initialSitemap = local("initial_sitemap", null);

// ─── critique outputs ────────────────────────────────────────────────────
const suggestions = local("suggestions", null);
const suggestionsCount = local("suggestions_count", null);
const currentSuggestion = local("current_suggestion", null);
const appliedLog = local("applied_log", [] as unknown[]);

// ─── CLI completeness ────────────────────────────────────────────────────
const cliSurface = local("cli_surface", null);
const coverageReport = local("coverage_report", null);
const coverageComplete = local("coverage_complete", null);

// ─── review & final artefact ─────────────────────────────────────────────
const reviewReport = local("review_report", null);
const changeReport = local("change_report", null);

const docsRoot = global(
	"docs_root",
	"the docs directory of the project being maintained (e.g. ./docs)",
);
const cliRoot = global(
	"cli_root",
	"the source directory of the CLI being documented (e.g. ./packages/cli)",
);

export const tree = sequence("Docs_Maintainer", () => {
	// 1. Discover the CLI surface once. Source of truth for the
	//    CLI_Completeness_Gate that runs every cycle.
	action("Locate_CLI_Surface", () => {
		evaluate(`${cliRoot} is set and ${docsRoot} is set`);
		instruct(`
			Read the CLI source rooted at ${cliRoot} and enumerate the
			full public surface: every command, subcommand, positional,
			flag, option, environment variable, and exit code a user is
			expected to see. Be exhaustive — this list is the source of
			truth for documentation completeness. Save the enumeration as
			a structured object at ${cliSurface} keyed by command path,
			each entry containing:
			  - command (full invocation path)
			  - summary (one line)
			  - args (positionals)
			  - flags (with type and default)
			  - env (environment variables read)
			  - exit_codes
			  - source_path (where the surface is defined)
		`);
		evaluate(`${cliSurface} is set`);
	});

	// 2. Cycle: sweep → sitemap → critique → apply → CLI gate → review →
	//    verify. The outer retries drive "keep passing until clean" —
	//    Verify_Cycle_Clean is the only gate that triggers a re-run.
	sequence("Cycle", (cycle) => {
		cycle.retries = 6;

		// 2a. Sweep and classify every page under the docs root.
		action("Sweep_And_Classify", () => {
			evaluate(`${docsRoot} is set`);
			instruct(`
				Walk ${docsRoot}. For every documentation page (markdown,
				MDX, or doc-config file) capture:
				  - path
				  - tier: "orientation" | "education" | "reference"
				    (orientation = top-level pages such as home /
				    motivation / getting-started; education = guides,
				    tutorials, conceptual explainers; reference =
				    lookup pages, schemas, CLI reference)
				  - purpose: one sentence on what the page is for
				  - audience: who reads it
				  - clarity_score: 0..1 (does the prose read well?)
				  - impact_score: 0..1 (how load-bearing is the page in
				    the reader's journey?)
				  - srp_score: 0..1 (does the page own exactly one
				    concept, task, or surface?)
				  - issues: list of concrete problems flagged on this
				    page (style, structure, gaps, drift)
				Save the full inventory at ${inventory}.
			`);
			evaluate(`${inventory} is set`);
		});

		// 2b. Build the private sitemap — the single working document
		//     that drives critique and amendment. Overwritten every cycle.
		action("Build_Sitemap", () => {
			evaluate(`${inventory} is set`);
			instruct(`
				Compose a markdown sitemap from ${inventory}. Structure:

				  ---
				  private: true
				  generated_by: docs-maintainer
				  generated_at: <YYYY-MM-DD HH:MM>
				  ---

				  # Documentation sitemap

				  ## Tier map
				  Three sections — Orientation, Education, Reference —
				  each listing the pages in that tier with a one-line
				  summary. Within a tier, order pages by impact_score
				  descending.

				  ## Per-page detail
				  For each page in ${inventory}:

				    ### <path>
				    - Tier: <tier>
				    - Purpose: <purpose>
				    - Audience: <audience>
				    - Scores: clarity <n> | impact <n> | SRP <n>
				    - Issues: bulleted list (or "none")
				    - Status: "pending" | "amended" | "stable"

				  ## Narrative arc
				  One paragraph describing the intended reader journey
				  from orientation → education → reference, naming the
				  specific pages that anchor each stage.

				Write the markdown to ./documentation-sitemap.md
				(overwriting any prior copy). Save the path to ${sitemap}.
				This file is private — it is the maintainer's working
				document, not a published page, and the frontmatter must
				declare \`private: true\`.
			`);
			evaluate(`${sitemap} is set`);
		});

		// 2c. Snapshot the first sitemap so Change_Report can show
		//     before-vs-after. Self-gating: runs only on the first cycle.
		action("Snapshot_Initial_Sitemap", () => {
			evaluate(`${sitemap} is set`);
			instruct(`
				If ${initialSitemap} is already set, this is not the first
				cycle — submit success without doing anything.

				Otherwise copy the file at ${sitemap} to
				./documentation-sitemap.initial.md (overwriting any prior
				copy) and save the new path to ${initialSitemap}. This is
				the only record of the initial state, since Build_Sitemap
				overwrites the live sitemap on every cycle.
			`);
			evaluate(`${initialSitemap} is set`);
		});

		// 2d. Senior-technical-writer critique. Encodes MDN three-tier
		//     structure + Microsoft Manual of Style via fragments.
		action("Critique_Sitemap", () => {
			evaluate(`${sitemap} is set`);
			instruct(`
				Read fragments/style-principles.md verbatim and apply it
				to the sitemap at ${sitemap} and the underlying docs at
				${docsRoot}. Act as a senior technical writer assessing
				the site against:
				  - MDN three-tier structure (orientation / education /
				    reference)
				  - Microsoft Manual of Style (voice, tense, sentence
				    case, parallel construction, action-oriented
				    headings, scannable structure, defined jargon)
				  - Narrative arc — does the reader progress
				    orientation → education → reference cleanly?
				  - Single responsibility — does each page own exactly
				    one concept?
				  - Coverage — is the educational content sufficient to
				    onboard a new reader end-to-end?

				Emit an ordered catalog of suggestions stored at
				${suggestions}, highest-impact first. Each suggestion:

				  { id, target_path, type, severity, description, why }

				where \`type\` is one of: "split", "merge", "rewrite",
				"rename", "move", "add", "delete", "restructure". An
				empty list is a valid result and signals the cycle is
				converging.

				Set ${suggestionsCount} to the length of ${suggestions}.
			`);
			evaluate(`${suggestions} is set and ${suggestionsCount} is set`);
		});

		// 2e. Apply suggestions one-by-one until the queue empties.
		//     Sitemap entry for the affected page is amended inline so
		//     the sitemap always reflects the current state of the docs.
		sequence("Apply_Suggestions", (apply) => {
			apply.retries = 40;

			action("Pick_Suggestion", () => {
				evaluate(`${suggestions} is set`);
				instruct(`
					If ${suggestions} is empty, set ${currentSuggestion}
					to null and submit success — there is nothing to
					apply this pass. Otherwise pop the head of
					${suggestions} into ${currentSuggestion} and remove
					it from the queue.
				`);
			});

			action("Apply_Suggestion", () => {
				instruct(`
					If ${currentSuggestion} is null, submit success — the
					queue is empty and there is nothing to apply.

					Otherwise apply ${currentSuggestion}. Edit the target
					file(s) at ${currentSuggestion}.target_path. Consult
					fragments/style-principles.md as you write so the
					new text matches the encoded MDN + Microsoft Manual
					of Style principles.

					Then amend ${sitemap} inline: locate the per-page
					entry for ${currentSuggestion}.target_path and update
					its Status to "amended", refresh its scores, and add
					a one-line note under Issues describing what landed.
					If the suggestion created or deleted pages, add or
					remove the corresponding entries in the sitemap and
					update the Tier map.

					Append a summary of the applied suggestion to
					${appliedLog}:
					  { id, target_path, type, summary }.
				`);
			});

			action("Continue_Or_Done", () => {
				evaluate(`${suggestions} is empty`);
			});
		});

		// 2f. CLI completeness — every command in ${cliSurface} must
		//     appear in the docs. The product (CLI) must be fully
		//     documented and a user should be able to use the docs to
		//     know everything about it.
		action("CLI_Completeness_Gate", () => {
			evaluate(`${cliSurface} is set`);
			instruct(`
				Cross-check ${cliSurface} against the docs under
				${docsRoot}. For every command, flag, environment
				variable, and exit code in the CLI surface, locate where
				it is documented (path + line). Compose a coverage
				report at ${coverageReport}:

				  { documented: [...], missing: [...], stale: [...] }

				where \`missing\` is anything in ${cliSurface} not found
				in the docs, and \`stale\` is anything documented that no
				longer exists in ${cliSurface}.

				Set ${coverageComplete} to true iff \`missing\` and
				\`stale\` are both empty.
			`);
			evaluate(`${coverageReport} is set and ${coverageComplete} is set`);
		});

		// 2g. Multi-agent final review of this cycle's diff. Mirrors the
		//     srp-refactor pattern, scoped to documentation changes via
		//     fragments/docs-review.md.
		action("Final_Review", () => {
			evaluate(`${appliedLog} is set`);
			instruct(`
				Run the docs-review procedure documented at
				fragments/docs-review.md. Read that file and follow its
				numbered steps verbatim, scoping the review to the
				changes captured in ${appliedLog} during this cycle.

				The procedure orchestrates haiku/sonnet/opus subagents in
				parallel and ends with a filtered, high-signal issue
				list. Capture that final list (issue description +
				reason + cited_lines + page_path) as ${reviewReport}.
				An empty list is a valid result — it is the signal that
				this cycle's changes hold up.
			`);
			evaluate(`${reviewReport} is set`);
		});

		// 2h. Cycle gate. Only succeeds if the critique was clean AND
		//     coverage is complete AND the review surfaced no issues.
		//     Failing here re-runs the entire cycle from Sweep, which is
		//     the mechanism that drives "keep reviewing and passing on
		//     the docs until clear and consistent".
		action("Verify_Cycle_Clean", () => {
			evaluate(
				`${suggestionsCount} is 0 and ${coverageComplete} is true and ${reviewReport} is empty`,
			);
			instruct(`
				Cycle converged: no outstanding critique, full CLI
				coverage, and no review findings. The documentation set
				is now clear, consistent, and progressively structured.
			`);
		});
	});

	// 3. Final change report — before-vs-after summary the human reads.
	action("Change_Report", () => {
		evaluate(
			`${initialSitemap} is set and ${sitemap} is set and ${appliedLog} is set`,
		);
		instruct(`
			Compose a markdown change report. Required sections:

			  # Documentation change report — <YYYY-MM-DD HH:MM>

			  ## Headline
			  - Pages reviewed: <n>
			  - Suggestions applied: <count of ${appliedLog}>
			  - CLI coverage: complete | <n missing> | <n stale>
			  - Final review findings: <count of ${reviewReport}>

			  ## What changed
			  Bulleted list rendered from ${appliedLog}: target → type →
			  summary.

			  ## Coverage
			  ${coverageReport} (verbatim).

			  ## Final review
			  ${reviewReport} (verbatim).

			  ## Sitemaps on disk
			  - Initial: ${initialSitemap}
			  - Final:   ${sitemap}

			Write the markdown to ./DOCUMENTATION_CHANGE_REPORT.md
			(overwriting any prior copy). Save the path to ${changeReport}.
		`);
		evaluate(`${changeReport} is set`);
	});
});

export { ambient };
