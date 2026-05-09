---
id: 1778345000-dracula-vitepress-modernise
title: VitePress Dracula Theme
status: accepted
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

Modernise the VitePress documentation site at `docs/`. Move the default Inter-on-white aesthetic to a Dracula-inspired dark identity with restrained corners. The site should feel native to the developer audience the CLI targets — terminal-adjacent, decisive, distinctive — without becoming a parody. Default colour scheme is dark; light mode remains supported but is the secondary experience.

## Requirements

- Dark theme uses a Dracula-derived palette: deep purple/indigo background, soft cream foreground, magenta/cyan/green/yellow accents in the canonical Dracula slots.
- Light theme stays usable but feels like a daytime variant of the same family — same accent hues, lighter substrate.
- Border radius is tightened across the board: cards, buttons, custom blocks, code fences. The previous "soft pill" feel is gone; default is `2px` for tight elements, `4px` for cards and code blocks. No element exceeds `4px` except the search modal (which keeps VitePress defaults).
- Hero gradient on the homepage is replaced. The current purple-to-cyan gradient stays in spirit but uses Dracula hues (Pink `#ff79c6` → Purple `#bd93f9` → Cyan `#8be9fd`) and the angle changes to vertical-ish (`160deg`) so the cyan reads as a "dawn" sliver at the bottom.
- Typography:
  - **Body:** `IBM Plex Sans` (loaded from CDN). Distinctive without being decorative; reads well at long-form length.
  - **Mono:** `IBM Plex Mono` (already widely used in dev tooling, pairs with Sans).
  - **Headings:** Body inherits `IBM Plex Sans` at heavier weights — no separate display font.
- Default code-block syntax theme matches the body theme: dark uses the Dracula palette directly; light uses the official Dracula light-style adaptation (`Dracula Pro Day` colours).
- Custom block accents (tip / warning / danger) re-use Dracula palette: tip → cyan, warning → yellow, danger → red.
- The home-page feature cards drop their default subtle borders for a flat, slightly inset look (1px outline matching `--vp-c-divider`, no shadow on hover, lift on hover via translate only).
- Mermaid diagrams (via `vitepress-mermaid-renderer`) honour the dark/light split. Theme passed to the renderer becomes `dark` (Dracula-tuned) on dark mode and `neutral` on light — `forest` (default) is wrong for this aesthetic.

## Technical Approach

All work in two files:

1. **`docs/.vitepress/theme/style.css`** — set CSS variables for both `:root` (light) and `.dark` selectors. Override the VitePress palette, button colours, custom-block colours, hero gradient, code-block backgrounds, border radii.
2. **`docs/.vitepress/theme/index.ts`** — adjust the mermaid renderer theme arg from `forest` to `neutral` on light, keep `dark` on dark.

Font loading: `<link>` to Google Fonts CDN for `IBM Plex Sans` and `IBM Plex Mono`. Inject via vitepress `transformHead` config in `docs/.vitepress/config.ts`, not via CSS `@import` (HEAD link is faster and avoids render-blocking).

Border radius is centralised on a few CSS variables defined at `:root`:

```css
--abtree-radius-tight: 2px;
--abtree-radius-card: 4px;
--abtree-radius-pill: 999px;  /* badges only */
```

VitePress's own `--vp-c-*` and `--vp-c-bg` variables are the override targets — no global selector hacks. The default theme's structural rules (layout, spacing, breakpoints) stay untouched.

## Affected Systems

- `docs/.vitepress/theme/style.css` — full rewrite
- `docs/.vitepress/theme/index.ts` — mermaid theme arg change
- `docs/.vitepress/config.ts` — add `transformHead` to inject font links

No source code, no CLI, no tree definitions. Static-site styling only.

## Acceptance Criteria

- `bun run docs:build` completes with no errors.
- Loading `docs/.vitepress/dist/index.html` in dark mode shows: deep-purple background (`#282a36` Dracula bg or close), cream foreground, pink/cyan accents on links and buttons, hero gradient using the three named Dracula hues.
- Loading the same page in light mode shows: warm off-white background, same accent hues at lower saturation, no jarring shift in identity.
- All four feature cards on the home page have `4px` corners and a 1px outline that matches the divider colour.
- Hero CTA button has `2px` corners, not the default `20px` pill.
- Code fences use the Dracula palette in dark mode (visible by inspecting any `<pre>` block).
- IBM Plex Sans/Mono are the active fonts (verifiable in DevTools Computed tab).
- Mermaid diagram on `/getting-started` renders with Dracula-toned colours in dark mode.
- The hello-world execution diagram from getting-started visually reads well in both modes — green nodes still pop, uncoloured nodes don't disappear into the background.

## Risks & Considerations

- **Contrast on coloured nodes in mermaid.** Mermaid's own theme override may clash with the per-node `style fill:#4ade80` we set. Mitigation: leave the inline styles as-is (they pin the success-green); only the *un-styled* nodes adopt the palette colours.
- **Font CDN dependency.** First paint depends on Google Fonts. Acceptable trade-off for a docs site; preconnect via `transformHead` mitigates flash.
- **Light mode being an afterthought.** The Dracula brand is dark-first. Light mode will feel like a derivation. Acceptable per the "secondary experience" framing in requirements.
- **Search modal border radius.** VitePress uses an internal Algolia-flavoured modal; overriding its radius is brittle. Documented exception above.

## Open Questions

- None. Bounded to two files, no architectural decisions, single-author repo.
