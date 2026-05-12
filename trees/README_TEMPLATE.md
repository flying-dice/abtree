# @abtree/<slug>

<!--
  One-paragraph description of what the workflow does. The same line
  that goes into `docs/registry.ts` as `description`. The home page
  uses it for the link card and meta; the per-tree docs page uses it
  for <meta name="description">. Aim for two short sentences max.
-->

<!--
  Optional safety note for destructive workflows. Examples:

    The refactor loop edits source files in your working tree. **Commit
    or stash first** if you want a clean rollback point.

    The workflow writes to `plans/` and pushes a branch. **Stash any
    unpushed local commits** before you start.

  Delete this comment if the workflow is read-only.
-->

## Run it

Paste this brief into Claude Code, ChatGPT, or any shell-capable agent<!-- optional clause: . Replace `<placeholder>` with … -->:

```text
Install the npm package @abtree/<slug>, then drive the workflow<!-- optional: against this repo -->:

  abtree --help
  abtree execution create ./node_modules/@abtree/<slug> "<workflow-specific summary, parameterised with <placeholders> as needed>"
```

![tree](./tree.svg)

<!--
  Anything beyond this point is tree-specific and optional. Common
  follow-ons:

    ## What the workflow does
    A numbered list of the high-level phases the agent will walk
    through, so a human can preview the run before they paste the
    brief.

    ## Files the workflow produces
    A table of paths the workflow writes and the action node that
    writes each one.

    ## Develop this workflow
    Clone instructions and a pointer to `src/tree.ts` + the DSL build
    so contributors can fork.

    ## Tests
    A table of the spec files in `tests/` and what each one exercises,
    plus the `bun run test:<name>` script that drives them.

  Drop any of these that aren't needed. None of them are required —
  the README only has to ship the package description, the tree.svg,
  and the Run-it block.
-->
