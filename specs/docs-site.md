---
id: 1778362008-vitepress-docs-site-structure
title: Docs Site
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

A VitePress 2.x site at `docs/` documents abtree for two audiences in one place: humans (read top-to-bottom, get-started → concepts → guide → examples) and LLMs (consume `llms.txt` and the per-page `.md` source served at the site root). Lives in the same repo as the source, builds via `bun run docs:build`, intended to be hosted on Cloudflare Pages from the GitHub mirror.

## Requirements

- One VitePress site at `docs/` covering the full product surface.
- Sidebar layout: `Introduction` → `Core concepts` → `Guide` → `Examples`. Same blocks reused across every section's sidebar so navigation stays oriented.
- Each guide / concepts page ends with a "Next" link list — no dead-end pages.
- `vitepress-mermaid-renderer` plugin renders the `.mermaid` files abtree emits inline as interactive diagrams.
- `vitepress-plugin-llms` emits `llms.txt`, `llms-full.txt`, and per-page `.md` files at the build root for AI ingestion.
- IBM Plex Sans + Plex Mono via Google Fonts CDN with `<link rel="preconnect">` to amortise TLS handshake.
- Dark and light mode both work; brand colours (pink/purple chain) applied to both.
- Site builds without errors via `bun run docs:build`.
- The page count is small enough for a first-time visitor to skim in one sitting (currently 8 content pages + landing).

## Page inventory

| Path | Purpose |
|---|---|
| `/` | Hero with logo + CTA, four feature cards, "What is abtree?" prose. |
| `/getting-started` | Install, 60-second concept primer, hand-it-off-to-your-agent walkthrough, mermaid trace. |
| `/concepts/` | Why behaviour trees? Failure modes (instruction fatigue, non-determinism). |
| `/concepts/state` | `$LOCAL` vs `$GLOBAL`. |
| `/concepts/branches-and-actions` | The four primitives. |
| `/guide/writing-trees` | YAML structure, fragments via `$ref`, retries config. |
| `/guide/designing-workflows` | LLM-facing reference: idioms, decision rules, gotchas. |
| `/guide/inspecting-flows` | Flow document anatomy + mermaid output. |
| `/guide/cli` | CLI command reference. |
| `/examples` | The eight bundled trees with install + run-with-Claude snippets. |

## Technical Approach

### Stack

- **VitePress 2.x alpha** — picked over docusaurus / mintlify for minimal config, native mermaid support, and the local-search affordance.
- **Plugins:** `vitepress-mermaid-renderer` (interactive mermaid), `vitepress-plugin-llms` (llms.txt generation).
- **Fonts:** IBM Plex Sans + Plex Mono via Google Fonts CDN. Preconnect tag in `head` for TLS pre-warm.

### Theme overrides

A small `docs/.vitepress/theme/style.css` overrides VitePress brand variables to match the docs-site logo (a pink behaviour-tree mark at `docs/public/abtree-mark.svg`):

```css
:root {
  --vp-c-brand-1: #d62786;     /* light mode brand */
  --vp-c-brand-2: #8c5cf2;
  --vp-c-brand-3: #d62786;
  --vp-c-brand-soft: rgba(214, 39, 134, 0.14);
}
.dark {
  --vp-c-brand-1: #ff79c6;     /* dark mode brand — matches logo stroke */
  --vp-c-brand-2: #bd93f9;
  --vp-c-brand-3: #ff79c6;
  --vp-c-brand-soft: rgba(255, 121, 198, 0.16);
  --vp-button-brand-text: #1b1b1f;     /* swap to dark substrate text — bright pink can't carry white */
  --vp-button-brand-hover-text: #1b1b1f;
  --vp-button-brand-active-text: #1b1b1f;
}
```

The theme is intentionally minimal — VitePress defaults plus a brand colour change. An earlier iteration tried to apply a fuller Dracula-tuned theme but introduced contrast issues (warm-cream substrate in light mode). The minimal override is what shipped.

### Sidebar

Configured per-route in `docs/.vitepress/config.ts`:

```ts
sidebar: {
  "/getting-started": [<intro>, <core concepts>, <guide>, <examples>],
  "/concepts/":       [<core concepts>, <guide>, <examples>],
  "/guide/":          [<guide>, <examples>, <core concepts>],
  "/examples":        [<examples>, <guide>, <core concepts>],
}
```

Each route prioritises its own section and surfaces the others below. The repetition is verbose but keeps the user oriented from any landing page.

### LLM-friendly output

`vitepress-plugin-llms` emits at build time:
- `llms.txt` — table-of-contents in the agentskills-flavoured format.
- `llms-full.txt` — every page concatenated, ready for direct LLM ingestion.
- `<page>.md` next to every `<page>.html` — the markdown source, served at the site root for direct fetching.

This is parallel to the human site, no duplication — generated from the same content.

### Build commands

```sh
bun run docs:dev       # local preview at localhost:5173
bun run docs:build     # static site to docs/.vitepress/dist/
bun run docs:preview   # serve the built dist
```

`.gitignore` excludes `docs/.vitepress/dist/` and `docs/.vitepress/cache/`.

### Hosting

Cloudflare Pages is the intended host, fed from the GitHub mirror (the docs site lives in the public repo, not the private GitLab one). Build settings:

| Setting | Value |
|---|---|
| Build command | `bun install --frozen-lockfile && bun run docs:build` |
| Output directory | `docs/.vitepress/dist` |
| Root directory | (project root) |
| `BUN_VERSION` env | `1.3.12` |
| `NODE_VERSION` env | `20` |

## Affected Systems

- `docs/` — entire site.
- `docs/.vitepress/config.ts` — VitePress config (head, plugins, sidebar, footer, search).
- `docs/.vitepress/theme/index.ts` — mermaid-renderer initialisation, theme-mode switch.
- `docs/.vitepress/theme/style.css` — brand-colour overrides.
- `docs/public/abtree-mark.svg` — the brand logo, also used in the hero image.
- `package.json` — `docs:dev` / `docs:build` / `docs:preview` scripts; `vitepress`, `vitepress-mermaid-renderer`, `vitepress-plugin-llms` as dev deps.

## Acceptance Criteria

- `bun run docs:build` exits 0 and produces `docs/.vitepress/dist/index.html`.
- Every page links from at least one sidebar entry.
- Every guide / concepts page has a "Next" link list.
- Local dev server (`bun run docs:dev`) renders all pages without console errors.
- Mermaid blocks in `docs/getting-started.md` render as interactive SVG with zoom/pan.
- `llms.txt` and `llms-full.txt` exist in the dist.
- Both light and dark modes pass body-text contrast at AAA (verified via the contrast assessment in this commit).

## Risks & Considerations

- **VitePress 2.x is alpha.** API can change. The site has minimal custom code (mostly config and a bit of theme CSS) so updates should be tractable. Pin the version on a stable release.
- **Plugin churn.** `vitepress-mermaid-renderer` and `vitepress-plugin-llms` are third-party. Both could fall behind VitePress 2.x major changes. Mitigation: both are small enough to fork if abandoned; the mermaid output is generated by abtree and could be rendered by an alternative library.
- **Cloudflare Pages doesn't connect to self-hosted GitLab.** Hosted docs come from the GitHub mirror. Documented in the release-pipeline spec.
- **Sidebar duplication.** Four nearly-identical sidebar blocks. A future refactor could share a helper that emits the right blocks per-route. Not urgent.
- **No search index beyond local.** `themeConfig.search.provider: "local"` works for the current page count; if the docs grow we'd swap to Algolia DocSearch.

## Open Questions

- Should the docs site be linked from the README and the `--help` output? Currently the docs site URL isn't promoted from the binary; users find it via the GitHub repo. Promoting `flying-dice.github.io/abtree` (or wherever it ends up hosted) is a one-line edit when the host is finalised.
