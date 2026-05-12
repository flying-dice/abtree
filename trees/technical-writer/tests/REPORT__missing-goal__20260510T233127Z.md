# Test report — No goal seeded → Resolve_Styleguide selector exhausts both branches and the workflow fails

**Tree:** technical-writer (v1.2.1)
**Runner:** test-tree (v1.2.0, fixture-driven side effects)
**Spec:** .abtree/trees/technical-writer/TEST__missing-goal.yaml
**Target execution:** test-tree-run-missing-goal-both-resolve-__technical-writer__1
**Overall:** PASS

## Final $LOCAL

| key | value |
|---|---|
| goal | null |
| styleguide | null |
| styleguide_approved | null |
| intent | null |
| docs_survey | null |
| placement | null |
| draft | null |
| review_notes | null |
| final_path | null |

## Assertions

| Name | Expected | Actual | Pass |
|---|---|---|---|
| status | failure | failure | ✓ |
| local.goal | null | null | ✓ |
| local.styleguide | null | null | ✓ |
| local.styleguide_approved | null | null | ✓ |
| local.intent | null | null | ✓ |
| local.docs_survey | null | null | ✓ |
| local.placement | null | null | ✓ |
| local.draft | null | null | ✓ |
| local.review_notes | null | null | ✓ |
| local.final_path | null | null | ✓ |
| files.STYLEGUIDE.md.modified_during_run | false | false (bootstrap never wrote) | ✓ |
| runtime.retry_count.Write_And_Review | 0 | 0 | ✓ |

**Trace highlight:** Both Load_Styleguide and Bootstrap_Styleguide are red, so Resolve_Styleguide is red, the parent sequence aborts on the first failing child, and the downstream nodes (Assess_Intent, Survey_Existing_Docs, Write_And_Review) are never visited. Exactly the gate behaviour the spec asserts.

## Trace

```mermaid
---
title: "test-tree run: missing goal — both Resolve_Styleguide branches gate-fail (failed)"
---
flowchart TD
    Technical_Writer_Workflow{{"Technical Writer Workflow\n[sequence]"}}
    0_Resolve_Styleguide{{"Resolve Styleguide\n[selector]"}}
    Technical_Writer_Workflow --> 0_Resolve_Styleguide
    style 0_Resolve_Styleguide fill:#f87171,stroke:#dc2626,color:#450a0a
    0_0_Load_Styleguide["Load Styleguide\n[action]"]
    0_Resolve_Styleguide --> 0_0_Load_Styleguide
    style 0_0_Load_Styleguide fill:#f87171,stroke:#dc2626,color:#450a0a
    0_0_Bootstrap_Styleguide{{"Bootstrap Styleguide\n[sequence]"}}
    0_Resolve_Styleguide --> 0_0_Bootstrap_Styleguide
    style 0_0_Bootstrap_Styleguide fill:#f87171,stroke:#dc2626,color:#450a0a
    0_0_1_Draft_Styleguide["Draft Styleguide\n[action]"]
    0_0_Bootstrap_Styleguide --> 0_0_1_Draft_Styleguide
    style 0_0_1_Draft_Styleguide fill:#f87171,stroke:#dc2626,color:#450a0a
    0_0_1_Human_Approval_Gate["Human Approval Gate\n[action]"]
    0_0_Bootstrap_Styleguide --> 0_0_1_Human_Approval_Gate
    0_Assess_Intent["Assess Intent\n[action]"]
    Technical_Writer_Workflow --> 0_Assess_Intent
    0_Survey_Existing_Docs{{"Survey Existing Docs\n[selector]"}}
    Technical_Writer_Workflow --> 0_Survey_Existing_Docs
    0_2_Map_Placement["Map Placement\n[action]"]
    0_Survey_Existing_Docs --> 0_2_Map_Placement
    0_2_Resolve_Structure["Resolve Structure\n[action]"]
    0_Survey_Existing_Docs --> 0_2_Resolve_Structure
    0_Write_And_Review{{"Write And Review\n[sequence]"}}
    Technical_Writer_Workflow --> 0_Write_And_Review
    0_3_Write_Documentation["Write Documentation\n[action]"]
    0_Write_And_Review --> 0_3_Write_Documentation
    0_3_Review_Gate["Review Gate\n[action]"]
    0_Write_And_Review --> 0_3_Review_Gate
```
