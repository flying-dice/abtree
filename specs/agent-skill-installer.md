---
id: 1778362003-skill-installer-prompt-flags
title: Agent Skill Installer
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

`abtree install skill` writes the bundled execution-protocol Skill (per [agentskills.io](https://agentskills.io)) into the right directory for the user's agent platform. Variants for Claude Code (`.claude/skills/`) and agentskills.io (`.agents/skills/`); scopes for project (cwd) and user (home). Interactive prompts via `@inquirer/prompts` when flags aren't provided; both `--variant` and `--scope` accepted for non-interactive use.

## Requirements

- Subcommand: `abtree install skill`.
- Two variants: `claude` (`.claude/skills/abtree/SKILL.md`) and `agents` (`.agents/skills/abtree/SKILL.md`).
- Two scopes: `project` (cwd-relative) and `user` (home-relative).
- Interactive: when invoked with no flags, prompt for variant then scope via `@inquirer/prompts.select`.
- Non-interactive: passing both `--variant <claude|agents>` and `--scope <project|user>` skips both prompts. Either flag alone is accepted; the unset one prompts.
- Invalid flag values exit with `die()` listing valid options.
- The SKILL.md content is bundled into the binary via Bun's `import ... with { type: "text" }` — same pattern used for `AGENT.md` and `--help`.
- A release asset `SKILL.md` is also published at the GitHub release page so users without the binary can curl it directly.

## Technical Approach

### Variant + scope mapping

```ts
// src/paths.ts
export const SKILL_TARGETS = {
  claude: {
    label: "Claude Code (.claude/skills)",
    project: () => join(process.cwd(), ".claude", "skills", "abtree"),
    user:    () => join(homedir(),     ".claude", "skills", "abtree"),
  },
  agents: {
    label: "agentskills.io (.agents/skills)",
    project: () => join(process.cwd(), ".agents", "skills", "abtree"),
    user:    () => join(homedir(),     ".agents", "skills", "abtree"),
  },
} as const;
```

Each variant has two closures (`project` / `user`) so cwd is captured at call time, not module-load time. Matters when the install runs against a different directory than where abtree itself was first loaded.

### Subcommand wiring

```ts
// index.ts
install
  .command("skill")
  .description("Install the abtree Agent Skill...")
  .option("--variant <variant>", "Skill platform: claude (.claude/skills) | agents (.agents/skills)")
  .option("--scope <scope>", "Install scope: project | user")
  .action(async (opts: { variant?: string; scope?: string }) => {
    await cmdInstallSkill(SKILL_CONTENT, opts);
  });
```

### Resolver functions

`resolveVariant` and `resolveScope` accept the optional flag value and either validate it or prompt:

```ts
async function resolveVariant(flag?: string): Promise<SkillVariant> {
  const valid = Object.keys(SKILL_TARGETS) as SkillVariant[];
  if (flag) {
    if (!valid.includes(flag as SkillVariant)) {
      die(`Unknown variant '${flag}'. Valid: ${valid.join(", ")}`);
    }
    return flag as SkillVariant;
  }
  return await select({
    message: "Which agent platform are you targeting?",
    choices: valid.map(v => ({ name: SKILL_TARGETS[v].label, value: v })),
  }) as SkillVariant;
}
```

### Output

After write, JSON to stdout:

```json
{
  "variant": "claude",
  "scope":   "project",
  "path":    "/path/to/.claude/skills/abtree/SKILL.md"
}
```

Consistent with the rest of the CLI's JSON-out convention.

### Release-asset variant

`.releaserc` lists `SKILL.md` alongside the binaries and install scripts:

```json
"assets": [
  { "path": "abtree-linux-x64", "label": "abtree-linux-x64" },
  ...,
  { "path": "SKILL.md", "label": "SKILL.md" }
]
```

Users without the CLI installed can curl-and-place:

```sh
mkdir -p ~/.claude/skills/abtree && \
  curl -fsSL https://github.com/flying-dice/abtree/releases/latest/download/SKILL.md \
    -o ~/.claude/skills/abtree/SKILL.md
```

### SKILL.md content

Frontmatter with `name` and `description` per the agentskills.io spec, plus the routing rules and the same numbered evaluate / instruct procedures from `--help`. The skill is for an LLM that's been triggered by the user's agent platform; it routes based on the user's request and walks the execution loop.

## Affected Systems

- `SKILL.md` — repo-root file, bundled via text import and shipped as a release asset.
- `src/paths.ts` — `SKILL_TARGETS` lookup table; `SkillVariant` and `SkillScope` exports.
- `src/commands.ts` — `cmdInstallSkill`, `resolveVariant`, `resolveScope`.
- `index.ts` — `install skill` subcommand with `--variant` and `--scope` flags.
- `.releaserc` — `SKILL.md` listed in `@semantic-release/github` assets.
- `package.json` — `@inquirer/prompts` runtime dep.

## Acceptance Criteria

- `abtree install skill` (no flags) prompts for variant and scope, then writes the file.
- `abtree install skill --variant claude --scope project` writes to `<cwd>/.claude/skills/abtree/SKILL.md` with no prompts.
- `abtree install skill --variant agents --scope user` writes to `~/.agents/skills/abtree/SKILL.md`.
- `--variant nonsense` exits with the list of valid variants.
- The CLI binary built with `bun build --compile` includes `@inquirer/prompts` (verified by smoke test on a fresh tmp directory).
- The released `SKILL.md` asset is downloadable from the GitHub release page.

## Risks & Considerations

- **`@inquirer/prompts` dynamic-import risk under `bun build --compile`.** Verified working on Linux x64; future versions of either dep could break bundling. Fallback: hand-rolled `Bun.prompt`-based picker.
- **Two-variant ceiling.** As more agent platforms ship skill formats, the lookup table grows. The map structure handles addition cleanly; no architectural change needed.
- **Label is human-readable but the value is machine-readable.** `--variant claude` (the value) takes priority over the label. Documented; flag-driven CI usage is the primary non-interactive path.
- **No way to install both variants in one shot.** Users who need both (e.g. testing across platforms) run the command twice with different flags. Acceptable.

## Open Questions

- Should the installer also write a top-level `agents.md` file (per agentskills.io spec) or just the skill? Currently it only writes `SKILL.md` — the convention so far. If a future spec mandates a sibling `agents.md`, the installer extends.
