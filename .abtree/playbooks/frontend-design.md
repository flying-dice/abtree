# Frontend design playbook

Build distinctive, production-grade frontend interfaces. The default failure mode for AI-generated UI is *generic* — bland fonts, timid colour, predictable layouts. This playbook exists to fight that.

The output is real, working code (HTML/CSS/JS, React, Vue, etc.) — not a mockup, not a description.

---

## 1. Design thinking — before any code

Before touching the editor, commit to a clear conceptual direction. Answer four questions:

- **Purpose.** What problem does this interface solve? Who uses it? In what context?
- **Tone.** Pick an extreme. Brutally minimal · maximalist chaos · retro-futuristic · organic / natural · luxury / refined · playful / toy-like · editorial / magazine · brutalist / raw · art-deco / geometric · soft / pastel · industrial / utilitarian · or another that is true to the brief. Use these as inspiration, not a menu.
- **Constraints.** Framework, performance budget, accessibility floor, browser support, data the UI consumes.
- **Memorable element.** What is the *one* thing a person will remember after closing the tab? Identify it explicitly. The rest of the design supports it.

**Commit.** Bold maximalism and refined minimalism both work. The killer is timidity — picking neither, blending toward the safe middle. Whatever direction you choose, execute it with intentionality.

---

## 2. Implementation criteria

The code you write must be:

- **Production-grade.** Real working code, not a sketch. Handles the cases the brief mentions.
- **Functional.** Interactions work. Forms validate. State updates correctly.
- **Visually striking.** Memorable, not generic.
- **Cohesive.** A clear aesthetic point-of-view that runs through every detail.
- **Refined.** Spacing, typography, motion, transitions — every detail considered.

---

## 3. Aesthetics guidelines

### Typography

Choose fonts that are beautiful, unique, and characterful. Pair a distinctive display font with a refined body font. **Avoid generic defaults**: Inter, Roboto, Arial, system fonts, Helvetica, Space Grotesk, Open Sans. Vary font choices across designs — never converge on the same family across multiple builds.

### Colour & theme

Commit to a cohesive palette. Use CSS variables for consistency. **Dominant colours with sharp accents outperform timid, evenly-distributed palettes.** Avoid the cliché AI-default of purple gradients on white. Vary between light and dark modes across designs.

### Motion

Animations and micro-interactions define the experience. Prioritise CSS-only solutions for vanilla HTML. Use Motion (or Framer Motion) for React when available. **One well-orchestrated page-load with staggered reveals (`animation-delay`) creates more delight than a dozen scattered hover effects.** Use scroll-triggers and hover states that surprise.

### Spatial composition

Default layouts are predictable. Reach for the unexpected:

- Asymmetry.
- Overlap and z-axis depth.
- Diagonal flow.
- Grid-breaking elements.
- Generous negative space *or* controlled density — pick a side, not the middle.

### Backgrounds & visual details

Solid background colours are the default of the unimaginative. Create atmosphere:

- Gradient meshes.
- Noise textures and grain overlays.
- Geometric patterns.
- Layered transparencies.
- Dramatic shadows.
- Decorative borders.
- Custom cursors.

Match the texture to the aesthetic direction.

---

## 4. Anti-patterns — never ship these

- Generic fonts (Inter / Roboto / Arial / Helvetica / system).
- Purple-gradient-on-white "AI" colour scheme.
- Predictable layouts — header, three feature cards in a row, CTA button.
- Cookie-cutter component patterns that lack context-specific character.
- Convergence on the same fonts, colours, or layouts across different briefs. **No two builds should look the same.**

---

## 5. Match complexity to vision

- **Maximalist designs** need elaborate code: extensive animations, layered effects, considered typography stacks, custom interactions.
- **Minimalist designs** need restraint and precision: careful spacing, deliberate type sizing, subtle motion, atmospheric backgrounds that don't shout.

Elegance is execution. Don't underdeliver on a bold direction. Don't overdesign a refined one.

---

## 6. Self-check before finishing

Run this checklist against the implementation:

1. Does the aesthetic direction match the brief precisely?
2. Are the specified animations / motion all present and well-orchestrated?
3. Is the typography distinctive (no generic fallback)?
4. Is the colour palette committed (no timid mid-tones)?
5. Is the spatial composition interesting (no default grid)?
6. Does the background / texture create atmosphere?
7. Is the memorable element clear and intentional?
8. Would this pass as human-designed work from a top studio?

Anything that fails a check goes back into the editor. Do not ship a design that fails any of the eight.
