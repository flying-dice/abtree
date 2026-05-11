# Test report — handleOrder is split cleanly on the first refactor pass

**Tree:** ./TREE.yaml
**Spec:** tests/clean-on-first-pass.yaml
**Target execution:** test-handleorder-is-split-cleanly-on-the__abtree-example-tree__1
**Overall:** PASS

## Final $LOCAL

| Key | Value |
|-----|-------|
| violations |  |
| top_violation | null |
| has_critical_violations | false |
| srp_report | ./SRP_REPORT.md |
| chosen_violation | tests/fixtures/handler.ts: handleOrder mixes routing, validation, pricing, persistence, notificat... |
| refactor_complete | true |
| refactor_summary | Split tests/fixtures/handler.ts into single-responsibility modules:
- handler.validation.ts — inp... |
| review_report | No high-signal issues found in the handleOrder split. |

## Assertions

| Name | Expected | Actual | Pass |
|------|----------|--------|------|
| status | done | done | ✓ |
| local.chosen_violation | starts with tests/fixtures/handler.ts | tests/fixtures/handler.ts: handleOrder mixes ro... | ✓ |
| local.refactor_complete | true | true | ✓ |
| local.refactor_summary | non-empty | Split tests/fixtures/handler.ts into single-res... | ✓ |
| local.has_critical_violations | false | false | ✓ |
| local.review_report | non-empty | No high-signal issues found in the handleOrder ... | ✓ |

## Trace

```mermaid
---
title: "Test: handleOrder is split cleanly on the first refactor pass (complete)"
---
flowchart TD
    Top{{"Top
[sequence]"}}
    0_Score_SRP["Score SRP
[action]"]
    Top --> 0_Score_SRP
    style 0_Score_SRP fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Await_Choice["Await Choice
[action]"]
    Top --> 0_Await_Choice
    style 0_Await_Choice fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Refactor_Loop{{"Refactor Loop
[sequence]"}}
    Top --> 0_Refactor_Loop
    style 0_Refactor_Loop fill:#4ade80,stroke:#16a34a,color:#052e16
    0_2_Refactor["Refactor
[action]"]
    0_Refactor_Loop --> 0_2_Refactor
    style 0_2_Refactor fill:#4ade80,stroke:#16a34a,color:#052e16
    0_2_Score_SRP["Score SRP
[action]"]
    0_Refactor_Loop --> 0_2_Score_SRP
    style 0_2_Score_SRP fill:#4ade80,stroke:#16a34a,color:#052e16
    0_2_Verify_Resolved["Verify Resolved
[action]"]
    0_Refactor_Loop --> 0_2_Verify_Resolved
    style 0_2_Verify_Resolved fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Final_Code_Review["Final Code Review
[action]"]
    Top --> 0_Final_Code_Review
    style 0_Final_Code_Review fill:#4ade80,stroke:#16a34a,color:#052e16
```
