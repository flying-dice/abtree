---
description: Encoded principles for the docs-maintainer — MDN three-tier structure plus the Microsoft Manual of Style. Apply these during Critique_Sitemap and Apply_Suggestions.
---

# Style principles for technical documentation

The docs-maintainer treats every page against three lenses: **structure** (does the page sit in the right tier?), **writing** (does the prose follow the Microsoft Manual of Style?), and **single responsibility** (does the page own one concept?). This fragment is the canonical reference.

## 1. Three-tier structure (MDN model)

A documentation site is a layered teaching artefact. Reader intent decides the tier; mixing tiers on one page is a defect.

| Tier         | Reader intent                                  | MDN equivalent             | Examples                                                |
|--------------|------------------------------------------------|----------------------------|---------------------------------------------------------|
| Orientation  | "What is this and why should I care?"          | Landing / overview pages   | Home, motivation, getting-started, glossary             |
| Education    | "Teach me how to do X."                        | Learn / guide articles     | Tutorials, how-to guides, conceptual explainers         |
| Reference    | "I already know what I want — look it up fast."| Web API / element reference| CLI reference, schema, configuration, API listings      |

Rules of placement:

- **Each page belongs to exactly one tier.** A page that opens with a tutorial and ends with a flag table is two pages glued together — split it.
- **The reader walks orientation → education → reference.** Orientation hooks them, education teaches them, reference supports them once they ship. The site navigation should reflect this arc.
- **Reference pages are scannable.** Tables, definition lists, short paragraphs. The reader is searching, not reading.
- **Education pages are progressive.** Each step builds on the previous; the reader should not need to skip ahead.
- **Orientation pages defer detail.** Link out to education and reference instead of inlining flag descriptions or schemas.

Diátaxis (the framework MDN's style guide cites) splits Education further into **tutorials** (learning-oriented, hand-held) and **how-to guides** (task-oriented, recipe-style). Use the split when a page conflates the two.

## 2. Microsoft Manual of Style — applied principles

The Microsoft Manual of Style is the canonical reference for technical writing voice and mechanics. The principles below are the load-bearing ones the docs-maintainer enforces.

### Voice and tone

- **Second person.** Address the reader directly: "You configure the runtime in `abtree.config.ts`." Avoid first person (we, our). The product does things; describe what it does.
- **Present tense.** "The CLI validates the YAML on load." Not "will validate".
- **Active voice.** "abtree writes the trace to `./.abtree/executions/`." Not "the trace is written".
- **Confident, not hedged.** No _might_, _could possibly_, _typically_, _in most cases_. State the rule and the exception explicitly.
- **Conversational, not casual.** Contractions are fine (it's, you're). Slang and idioms are not — they hurt global readers and translation.

### Structure of prose

- **Lead with the punchline.** First sentence answers "what does this page do for me?". Body fills in the detail.
- **Short sentences.** Aim for one idea per sentence. Break compound sentences into bullets when the parts are parallel.
- **Parallel construction.** When listing steps or items, every item shares grammatical shape — all imperative verbs, or all noun phrases, never a mix.
- **Scannable structure.** Headings, lists, tables, code blocks. A page that is one wall of text fails the scan test.
- **Action-oriented headings.** _"Configure the runtime"_, not _"Configuration"_. The heading tells the reader what they'll do.

### Mechanics

- **Sentence case** for headings, captions, list items, and UI labels. _Configure the runtime_, not _Configure The Runtime_.
- **Oxford comma** in lists of three or more.
- **One space after a period.** Never two.
- **Em dashes** (—) with no surrounding spaces in body text, used sparingly for asides.
- **Code formatting** for any literal — file paths, flag names, command names, state keys, environment variables. Plain prose for concepts.
- **No exclamation marks** in body copy. They sound shouty in technical writing.
- **No rhetorical questions** as headings or topic openers.

### Inclusivity and globalisation

- **Avoid idioms** ("piece of cake", "out of the box", "down the road"). Translate poorly and confuse non-native readers.
- **No gendered or culture-bound metaphors.** Default to neutral examples.
- **Define every jargon term on first use.** Domain terms (sequence, selector, blackboard, tick) are fine — they're the vocabulary the reader is here to learn — but introduce each one before relying on it.
- **Be precise about numbers, dates, units.** "5 seconds", not "a few seconds". ISO-8601 dates.

### Procedures (how-to steps)

- **Numbered list, one action per step.** A step that performs two actions is two steps.
- **Imperative verb first.** "Run `abtree next`. The CLI returns the next step."
- **State the result after the action.** The reader confirms they're on track.
- **Show output when it matters.** Truncate with `...` rather than fake-wrapping long lines.

### Reference pages

- **Definition lists or tables**, not prose paragraphs.
- **Alphabetical** within a section, unless there is a workflow-driven order (e.g. CLI subcommand order matches lifecycle).
- **Every field documents**: name, type, default, required/optional, one-line description. Missing the default is the most common defect.

## 3. Single responsibility per page

Each documentation page owns exactly one concept, task, or surface. The test:

> "If I summarised this page in one sentence, would the sentence have a conjunction in it?"

If yes, the page is mixed. Split it. Common smells:

- A tutorial that becomes a reference table halfway through → extract the table to a reference page; link to it.
- A reference page that opens with an explainer → extract the explainer to a concepts page; link to it.
- A guide that documents two unrelated workflows → split into one guide per workflow.
- A landing page that inlines flag descriptions → strip them; link to the reference.

## 4. Narrative arc across the site

The site as a whole should read as a journey, not a pile. The narrative arc:

1. **Orientation** — what is this, who is it for, what does success look like.
2. **First contact** — the smallest possible working example. The reader gets something running in under five minutes.
3. **Conceptual frame** — the mental model the rest of the docs assumes. Read once, used everywhere.
4. **Education** — guides and tutorials that build capability progressively.
5. **Reference** — the lookup tier the reader returns to after they ship.

The Critique step should test the site against this arc, not just individual pages. Symptoms of a broken arc: no clear entry point, conceptual frame buried mid-guide, reference pages assumed before they're introduced, two pages competing for the same role.

## 5. What "passes" means

A page passes when:

- It sits in exactly one tier.
- It owns exactly one concept.
- It opens with a clear punchline.
- Its prose follows the voice, tense, and mechanics rules above.
- Every literal is in code format; every term is defined on first use.
- Its placement in the site's narrative arc is obvious.

A site passes when every page passes, the arc reads end-to-end without gaps, and the CLI surface is fully documented in the reference tier.
