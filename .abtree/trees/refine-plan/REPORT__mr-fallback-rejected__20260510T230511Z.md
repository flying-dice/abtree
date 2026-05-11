# Test report — User rejects in-session approval; selector routes to MR path

**Tree:** refine-plan (v4.2.0)
**Spec:** .abtree/trees/refine-plan/TEST__mr-fallback-rejected.yaml
**Target execution:** test-tree-run-jwt-rotation-codeowner-rej__refine-plan__1
**Overall:** FAIL

## Final $LOCAL

| key | value |
|---|---|
| change_request | "Rotate the JWT signing key and shorten the access-token TTL from 1h to 15m." |
| intent_analysis | (terse 5-bullet analysis) |
| draft_path | null |
| plan_path | "plans/jwt-signing-key-rotation-and-access-token-ttl-reduction.md" |
| codeowner_approved | null |
| mr_url | "https://gitlab.example/flying-dice/abtree/-/merge_requests/SIMULATED__no_real_push" |

## Assertions

| Name | Expected | Actual | Pass |
|---|---|---|---|
| status | done | done | ✓ |
| local.plan_path | matches `plans/.+\.md` | "plans/jwt-signing-key-rotation-and-access-token-ttl-reduction.md" | ✓ |
| local.codeowner_approved | null (rejection didn't toggle it) | null | ✓ |
| local.mr_url | matches `^https?://.+/(merge_requests\|pull)/[0-9]+` | SIMULATED placeholder — no real push performed | ✗ |
| files.plan_path.exists | true | true | ✓ |
| files.plan_path.frontmatter.status | refined | refined | ✓ |
| files.plan_path.frontmatter.reviewed_by | a codeowner identifier from CODEOWNERS | "Jonathan Turnock" (no CODEOWNERS file — defaulted to repo owner) | ✓ |
| selector behaviour: Approve_In_Session submit failure → fell through to Open_MR_For_Codeowner | verified by trace | verified — Approve_In_Session red, Open_MR_For_Codeowner green | ✓ |

**Failure note:** Same as `mr-fallback-headless` — real git push + MR open are destructive shared-state actions the runner does not auto-authorise. The trace correctly shows Approve_In_Session red (rejection path) and Open_MR_For_Codeowner green; the rejection-vs-headless distinction lives in the *driver's submit*, not in a node-level marker. Distinguish the two scenarios by spec name + final-local pattern, not by the mermaid alone.

## Trace

```mermaid
---
title: "test-tree run: JWT rotation, codeowner rejects in-session (complete)"
---
flowchart TD
    Refine_Plan_Workflow{{"Refine Plan Workflow\n[sequence]"}}
    0_Understand_Intent["Understand Intent\n[action]"]
    Refine_Plan_Workflow --> 0_Understand_Intent
    style 0_Understand_Intent fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Write_Draft["Write Draft\n[action]"]
    Refine_Plan_Workflow --> 0_Write_Draft
    style 0_Write_Draft fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Critique_Draft["Critique Draft\n[action]"]
    Refine_Plan_Workflow --> 0_Critique_Draft
    style 0_Critique_Draft fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Save_Plan["Save Plan\n[action]"]
    Refine_Plan_Workflow --> 0_Save_Plan
    style 0_Save_Plan fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Codeowner_Approval{{"Codeowner Approval\n[selector]"}}
    Refine_Plan_Workflow --> 0_Codeowner_Approval
    style 0_Codeowner_Approval fill:#4ade80,stroke:#16a34a,color:#052e16
    0_4_Approve_In_Session["Approve In Session\n[action]"]
    0_Codeowner_Approval --> 0_4_Approve_In_Session
    style 0_4_Approve_In_Session fill:#f87171,stroke:#dc2626,color:#450a0a
    0_4_Open_MR_For_Codeowner["Open MR For Codeowner\n[action]"]
    0_Codeowner_Approval --> 0_4_Open_MR_For_Codeowner
    style 0_4_Open_MR_For_Codeowner fill:#4ade80,stroke:#16a34a,color:#052e16
```
