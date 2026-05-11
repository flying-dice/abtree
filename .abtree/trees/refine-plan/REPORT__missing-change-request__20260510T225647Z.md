# Test report — No change_request seeded → workflow fails at the Understand_Intent gate

**Tree:** refine-plan
**Spec:** .abtree/trees/refine-plan/TEST__missing-change-request.yaml
**Target execution:** test-tree-run-no-change-request-seeded__refine-plan__1
**Overall:** PASS

## Final $LOCAL

| key | value |
|---|---|
| change_request | null |
| intent_analysis | null |
| draft_path | null |
| plan_path | null |
| codeowner_approved | null |
| mr_url | null |

## Assertions

| Name | Expected | Actual | Pass |
|---|---|---|---|
| status | failure | failure | ✓ |
| local.change_request | null | null | ✓ |
| local.intent_analysis | null | null | ✓ |
| local.draft_path | null | null | ✓ |
| local.plan_path | null | null | ✓ |
| local.codeowner_approved | null | null | ✓ |
| local.mr_url | null | null | ✓ |
| files.plans_drafts_dir.contains_files_for_this_execution | false | false (no draft was written; Write_Draft never fired) | ✓ |

## Trace

```mermaid
---
title: "test-tree run: no change_request seeded (failed)"
---
flowchart TD
    Refine_Plan_Workflow{{"Refine Plan Workflow\n[sequence]"}}
    0_Understand_Intent["Understand Intent\n[action]"]
    Refine_Plan_Workflow --> 0_Understand_Intent
    style 0_Understand_Intent fill:#f87171,stroke:#dc2626,color:#450a0a
    0_Write_Draft["Write Draft\n[action]"]
    Refine_Plan_Workflow --> 0_Write_Draft
    0_Critique_Draft["Critique Draft\n[action]"]
    Refine_Plan_Workflow --> 0_Critique_Draft
    0_Save_Plan["Save Plan\n[action]"]
    Refine_Plan_Workflow --> 0_Save_Plan
    0_Codeowner_Approval{{"Codeowner Approval\n[selector]"}}
    Refine_Plan_Workflow --> 0_Codeowner_Approval
    0_4_Approve_In_Session["Approve In Session\n[action]"]
    0_Codeowner_Approval --> 0_4_Approve_In_Session
    0_4_Open_MR_For_Codeowner["Open MR For Codeowner\n[action]"]
    0_Codeowner_Approval --> 0_4_Open_MR_For_Codeowner
```
