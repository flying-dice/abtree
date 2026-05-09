# STYLEGUIDE.md

Conventions for documentation in this repo. Lift the existing docs as the
canonical examples — when the rule and a doc disagree, the doc is right
and this file is stale.

## Audience

The reader is **new to behaviour trees** and likely has no exposure to
deterministic AI — their experience with "AI" is generative LLMs, not
state machines, planners, or game-AI controllers. Assume they have never
seen a sequence/selector/parallel diagram before.

Two implications:

- **Illustrate every new concept in plain language** before naming it.
  "A node that runs its children in order and aborts on the first
  failure" comes before the word _sequence_, not after. The first time
  the term appears, define it inline; reach for analogies (if/else,
  cooking recipes, assembly lines) when they help.
- **Don't replace industry-standard terms with fluff.** _Sequence,
  selector, parallel, action, evaluate, instruct, cursor, blackboard_ —
  these are real terms used in the BT and game-AI literature. The
  documentation aims to educate, not to soften. Substituting "first
  step" for _evaluate_ saves a sentence today and costs the reader a
  vocabulary forever.

The combination: define the term once, then use it. Don't dodge the
term, don't lecture about it.

## Voice

- **Second person.** "You drive a flow with three commands." Never first
  person ("I", "we"). The product does things; describe what it does.
- **Terse, declarative, terminal-adjacent.** Short sentences, confident
  claims, no hedging. Prefer "abtree validates the YAML on load" over
  "abtree will attempt to validate".
- **Two-beat pacing** in marketing copy: a confident claim, then the
  punchline. _"Three branch types. One leaf type. That's the whole language."_

## Spelling and casing

- **British English.** _behaviour, colour, modernise, organising,
  utilises_. The codebase uses British spelling consistently — match it.
- **Sentence case** for headings and UI labels.
  Yes: _Get started_, _Why behaviour trees?_, _Writing your own tree_.
  No: _Get Started_, _Why Behaviour Trees?_.
- **Lower-case product name:** `abtree` (not Abtree, not ABTree). Only
  capitalise at the start of a sentence — even there, lower-case is fine.

## Punctuation

- **One-em dashes** ( — ) for parenthetical bites; sparingly.
- **No exclamation marks** anywhere except the blink-cursor demo.
- **No rhetorical questions** in body copy.

## Markdown conventions

- **Inline `code`** for any literal — flag names, paths, tree slugs, state
  keys (`$LOCAL.greeting`), command names.
- **Bold** for the first occurrence of a new term, then plain.
- **Code fences** include a language tag (` ```sh `, ` ```yaml `,
  ` ```json `). The language label renders as a pink Plex Mono eyebrow
  in the docs site.
- **Tables** for paired data (command → purpose, field → meaning). Keep
  them under five columns; if it's wider, restructure as a definition
  list.
- **Internal links** use absolute paths (`/concepts/state`) so they work
  in both VitePress and the rendered llms.txt output.

## File and heading naming

- **File names:** kebab-case (`getting-started.md`, `branches-and-actions.md`).
- **Tree slugs (YAML names):** kebab-case (`hello-world`, `code-review`).
- **Behaviour-tree node names** in YAML: PascalCase with underscores
  (`Choose_Greeting`, `Check_Weather`) — these render as spaces in
  Mermaid diagrams.
- **Heading hierarchy:** every page has exactly one `h1` (the title);
  sections are `h2`; subsections `h3`. Don't skip levels.

## Voice for examples

- CLI examples address the agent, not the human. _"`abtree next` returns
  the next step"_, not _"run `abtree next`"_. The human hands a brief to
  their agent — the agent runs the loop.
- When an example shows JSON output, label it `json` and indent two
  spaces. Truncate long instruction strings with `...` rather than
  pretending they fit in one line.

## Don't

- No marketing fluff: _seamless, powerful, cutting-edge, next-generation,
  revolutionise_.
- No anthropomorphising the runtime ("abtree wants to help you").
- No decorative emoji in docs body or CLI output. Status uses Plex Mono
  glyphs (`✓` `✗` `→`). The four feature-card icons on the home page are
  the entire emoji vocabulary, and even those render as inline SVG.
- No abbreviating "behaviour tree" to "BT" in prose. In tables and
  technical reference it's acceptable.
