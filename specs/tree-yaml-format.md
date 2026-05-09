---
id: 1778362000-canonical-yaml-schema-document
title: Tree YAML Format
status: shipped
author: Starscream
created: 2026-05-09
reviewed_by: Starscream
---

## Summary

A tree is a YAML file at `.abtree/trees/<slug>.yaml` (project) or `~/.abtree/trees/<slug>.yaml` (user-global). Slug = filename without `.yaml`, kebab-case, must match the document's `name` field. The YAML defines the workflow's structure — execution semantics live in the tick engine; this document is the static source of truth.

## Requirements

- Top-level fields: `name`, `version`, `description?`, `state?`, `tree`. Anything else fails validation.
- Slug naming: kebab-case in the filename and in `name`; the two must match.
- Node names (composites and actions): PascalCase with underscores; render as spaces in mermaid output.
- Three composite node types: `sequence`, `selector`, `parallel`. One leaf type: `action`. One placeholder type: ref (a `{ $ref: string }` object — never authored as `type: ref`, only emitted by the loader for unresolved cycles).
- Each composite has `children: []` (non-empty). Each action has `steps: []` (non-empty).
- Steps are `{ evaluate: <expr> }` or `{ instruct: <prose> }` — exactly one key per step.
- Any composite or action can carry `retries: N` (positive integer). The runtime resets the node's internal state and re-ticks on failure, up to N times.
- Any node may be a `$ref` reference to another node — relative file path, absolute path, or URL. The loader resolves non-cyclic refs at execution-create time and inlines them into the snapshot. Cyclic refs are preserved literally as `{ $ref: "..." }` and surface a clean failure if ticked.
- `state.local` defines initial `$LOCAL` keys for new executions; `null` is acceptable for slots actions will populate.
- `state.global` defines `$GLOBAL` values; the runtime treats string values as instructions for the agent to fetch the value at runtime.

## Technical Approach

### Top-level shape

```yaml
name: <kebab-case slug, must match filename>
version: <semver>
description: <one line>
state:
  local:
    <var>: null            # filled by actions during the run
  global:
    <var>: <literal | instruction string>
tree:
  type: sequence           # almost always a sequence at the root
  name: <PascalCase_With_Underscores>
  children: [...]
```

### Node shapes

**Composite:**
```yaml
type: sequence | selector | parallel
name: <PascalCase>
retries?: <positive integer>
children: [...]
```

**Action:**
```yaml
type: action
name: <PascalCase>
retries?: <positive integer>
steps:
  - evaluate: <semantic boolean expression>
  - instruct: <free-form prose>
```

**Ref placeholder (loader-emitted, not authored):**
```yaml
$ref: <path or URL or JSON pointer>
```

### Step semantics

Steps run in order within an action. An `evaluate` returns true/false (the agent reads it, judges, calls `abtree eval`); a true result advances the cursor past the evaluate, a false result fails the action. An `instruct` is performed by the agent (the agent does the work, optionally writes to `$LOCAL`, calls `abtree submit`). Either step can be the first step of an action; convention is `evaluate → instruct → ...`.

### Composite semantics

| Type | Semantics |
|---|---|
| `sequence` | Run children top to bottom. All must succeed. First failure aborts. |
| `selector` | Run children top to bottom until one succeeds. If all fail, the selector fails. |
| `parallel` | Run all children. All must succeed. First failure aborts. |

### Retries

When a node with `retries: N` returns failure, the runtime:

1. Checks the internal retry counter for the node's path.
2. If it's `< N`, increments the counter, wipes the runtime bookkeeping for the node and its descendants (`node_status`, `step_index` keys whose path begins with the node's), and re-ticks the node from a clean slate.
3. After N retries are consumed, the failure propagates to the parent normally.

User state in `$LOCAL` (counters, drafts, review notes) persists across retries — that's the feedback channel between attempts. Internal state is wiped.

### `$ref`

Resolution uses [`@apidevtools/json-schema-ref-parser`](https://github.com/APIDevTools/json-schema-ref-parser) with `circular: 'ignore'`. Non-cyclic references are fully expanded; cyclic edges remain as `{ $ref: "..." }` placeholders in the snapshot.

A fragment file is a single node — it does NOT carry top-level `name` / `version` / `state` keys. It IS the value at the position where the `$ref` lives.

The merged tree is written into the execution's `snapshot` at execution-create time. Editing a fragment after that does not affect existing executions; only new executions pick up the change.

### Validation

The `validateTreeFile` function in `src/validate.ts` enforces:
- Required top-level fields (`name`, `version`, `tree`).
- Optional `state` shape (`local` and `global` must be objects when present).
- Recursive `validateNode`: type/name required, type ∈ allowed values, composites have children, actions have steps. `$ref` placeholders pass through unvalidated (the resolver is responsible).
- `parseRetries`: optional, positive integer.

A malformed tree is rejected at `abtree tree list` (silently dropped) or at `abtree execution create` (loud error).

## Affected Systems

- `src/types.ts` — `AbtNode`, `NormalizedNode`, `RefNode`, `NormalizedRefNode`, `ActionNode.retries?`, `CompositeNode.retries?`, `RuntimeState`.
- `src/validate.ts` — `validateNode`, `parseRetries`, `normalizeNode`.
- `src/tree.ts` — `loadTree` (uses `$RefParser`), `tickNode`, `maybeRetry`.
- `.abtree/trees/*.yaml` — every shipped tree.

## Acceptance Criteria

- A minimal tree (single action with one instruct) passes validation and creates an execution.
- All four node types listed by `abtree tree list`.
- Composite nodes with `retries: N` retry on failure exactly N times.
- `$ref` to a sibling file resolves and produces a flat snapshot.
- A cyclic `$ref` does not stack-overflow at execution-create; ticking the cyclic edge returns `{ status: "failure" }`.
- Validation rejects: missing fields, unknown node types, empty children/steps, non-positive `retries`.

## Risks & Considerations

- **Slug-vs-name drift.** Filename and `name` field must match. `listTreeSlugs` uses the filename; `loadTree` uses both. Mismatches cause confusing "tree not found" errors. Validated implicitly by convention; not enforced.
- **`$ref` parser dependencies.** ref-parser uses dynamic imports in some paths. Verified to bundle into the `bun build --compile` binary; if a future version breaks bundling, the fallback is to hand-roll a minimal $ref resolver.
- **Tree YAML is the only source of truth.** No tree-level versioning beyond the `version` field; no migration path for breaking changes to the schema. Acceptable while the schema is small and pre-1.0.

## Open Questions

None. Schema is stable for current use cases.
