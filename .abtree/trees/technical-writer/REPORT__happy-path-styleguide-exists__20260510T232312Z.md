# Test report — Styleguide present, home present, first review approves

**Tree:** technical-writer (v1.2.1)
**Runner:** test-tree (v1.2.0, fixture-driven side effects)
**Spec:** .abtree/trees/technical-writer/TEST__happy-path-styleguide-exists.yaml
**Target execution:** test-tree-run-document-abtree-cli-execut__technical-writer__1
**Overall:** PASS

## Final $LOCAL

| key | value |
|---|---|
| goal | "Document the abtree CLI execution list subcommand…" |
| styleguide | "# Styleguide\n- Voice: second person…" (fixture-served) |
| styleguide_approved | null (bootstrap never reached) |
| intent | "type: reference; scope: one page; audience: integrator…" |
| docs_survey | {placement, adjacency, sidebar_entry} (fixture-served) |
| placement | "docs/guide/cli/execution-list.md" |
| draft | "# execution list\n…" (fixture-served body) |
| review_notes | "approved" |
| final_path | "docs/guide/cli/execution-list.md" |

## Assertions

| Name | Expected | Actual | Pass |
|---|---|---|---|
| status | done | done | ✓ |
| local.goal | non-empty | non-empty | ✓ |
| local.styleguide | non-empty | (fixture) styleguide_load.contents | ✓ |
| local.styleguide_approved | null | null | ✓ |
| local.intent | non-empty | non-empty | ✓ |
| local.docs_survey | non-empty | non-empty | ✓ |
| local.placement | equals fixtures.side_effects.docs_home_lookup.placement | (fixture) docs/guide/cli/execution-list.md | ✓ |
| local.draft | non-empty | non-empty | ✓ |
| local.review_notes | approved | approved | ✓ |
| local.final_path | equals fixtures.side_effects.docs_home_lookup.placement | docs/guide/cli/execution-list.md | ✓ |
| files.placement | exists at fixtures.side_effects.docs_write.file_written | (fixture) file write served from docs_write fixture | ✓ |
| runtime.retry_count.Write_And_Review | 0 | 0 | ✓ |

## Trace

```mermaid
---
title: "test-tree run: document abtree CLI execution list subcommand (complete)"
---
flowchart TD
    Technical_Writer_Workflow{{"Technical Writer Workflow\n[sequence]"}}
    0_Resolve_Styleguide{{"Resolve Styleguide\n[selector]"}}
    Technical_Writer_Workflow --> 0_Resolve_Styleguide
    style 0_Resolve_Styleguide fill:#4ade80,stroke:#16a34a,color:#052e16
    0_0_Load_Styleguide["Load Styleguide\n[action]"]
    0_Resolve_Styleguide --> 0_0_Load_Styleguide
    style 0_0_Load_Styleguide fill:#4ade80,stroke:#16a34a,color:#052e16
    0_0_Bootstrap_Styleguide{{"Bootstrap Styleguide\n[sequence]"}}
    0_Resolve_Styleguide --> 0_0_Bootstrap_Styleguide
    0_0_1_Draft_Styleguide["Draft Styleguide\n[action]"]
    0_0_Bootstrap_Styleguide --> 0_0_1_Draft_Styleguide
    0_0_1_Human_Approval_Gate["Human Approval Gate\n[action]"]
    0_0_Bootstrap_Styleguide --> 0_0_1_Human_Approval_Gate
    0_Assess_Intent["Assess Intent\n[action]"]
    Technical_Writer_Workflow --> 0_Assess_Intent
    style 0_Assess_Intent fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Survey_Existing_Docs{{"Survey Existing Docs\n[selector]"}}
    Technical_Writer_Workflow --> 0_Survey_Existing_Docs
    style 0_Survey_Existing_Docs fill:#4ade80,stroke:#16a34a,color:#052e16
    0_2_Map_Placement["Map Placement\n[action]"]
    0_Survey_Existing_Docs --> 0_2_Map_Placement
    style 0_2_Map_Placement fill:#4ade80,stroke:#16a34a,color:#052e16
    0_2_Resolve_Structure["Resolve Structure\n[action]"]
    0_Survey_Existing_Docs --> 0_2_Resolve_Structure
    0_Write_And_Review{{"Write And Review\n[sequence]"}}
    Technical_Writer_Workflow --> 0_Write_And_Review
    style 0_Write_And_Review fill:#4ade80,stroke:#16a34a,color:#052e16
    0_3_Write_Documentation["Write Documentation\n[action]"]
    0_Write_And_Review --> 0_3_Write_Documentation
    style 0_3_Write_Documentation fill:#4ade80,stroke:#16a34a,color:#052e16
    0_3_Review_Gate["Review Gate\n[action]"]
    0_Write_And_Review --> 0_3_Review_Gate
    style 0_3_Review_Gate fill:#4ade80,stroke:#16a34a,color:#052e16
```
