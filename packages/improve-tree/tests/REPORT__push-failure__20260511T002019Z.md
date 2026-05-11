# Test report — Push fails with no upstream — workflow surfaces the error and ends in failure

**Tree:** improve-tree (v1.0.0)
**Runner:** test-tree (v1.2.0, fixture-driven side effects)
**Spec:** .abtree/trees/improve-tree/TEST__push-failure.yaml
**Target execution:** test-push-failure-hello-world-default-no__improve-tree__1
**Overall:** PASS

## Final $LOCAL

| key | value |
|---|---|
| session_ref | "test-tree-run-default-unclassifiable-tim__hello-world__1" |
| tree_slug | "hello-world" |
| session_evidence | { nodes_reached: [4], nodes_failed: [], local_keys_null: [], local_keys_populated: [time_of_day, greeting] } |
| effectiveness_score | { score: 0.78, observations: [] } |
| improvements | [reword Default_Greeting] |
| plan_path | "plans/2026-05-11-improve-hello-world.md" |
| commit_sha | null |

## Assertions

| Name | Expected | Actual | Pass |
|---|---|---|---|
| status | failure | failure | ✓ |
| local.tree_slug | hello-world | hello-world | ✓ |
| local.effectiveness_score | non-empty | non-empty (score 0.78) | ✓ |
| local.improvements | non-empty | non-empty (1 item) | ✓ |
| local.plan_path | plans/2026-05-11-improve-hello-world.md | plans/2026-05-11-improve-hello-world.md | ✓ |
| local.commit_sha | null | null | ✓ |
| files.plan_path.exists | true | (fixture) true | ✓ |
| files.plan_path.frontmatter.status | draft | (fixture) draft | ✓ |
| git.committed_locally | true | (fixture) true | ✓ |
| git.pushed | false | (fixture) false | ✓ |

## Trace

```mermaid
---
title: "test-push-failure hello-world default no upstream (failed)"
---
flowchart TD
    Improve_Tree_Workflow{{"Improve Tree Workflow\n[sequence]"}}
    0_Identify_Target["Identify Target\n[action]"]
    Improve_Tree_Workflow --> 0_Identify_Target
    style 0_Identify_Target fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Score_And_Find{{"Score And Find\n[parallel]"}}
    Improve_Tree_Workflow --> 0_Score_And_Find
    style 0_Score_And_Find fill:#4ade80,stroke:#16a34a,color:#052e16
    0_1_Score_Effectiveness["Score Effectiveness\n[action]"]
    0_Score_And_Find --> 0_1_Score_Effectiveness
    style 0_1_Score_Effectiveness fill:#4ade80,stroke:#16a34a,color:#052e16
    0_1_Find_Improvements["Find Improvements\n[action]"]
    0_Score_And_Find --> 0_1_Find_Improvements
    style 0_1_Find_Improvements fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Draft_Plan["Draft Plan\n[action]"]
    Improve_Tree_Workflow --> 0_Draft_Plan
    style 0_Draft_Plan fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Commit_And_Push["Commit And Push\n[action]"]
    Improve_Tree_Workflow --> 0_Commit_And_Push
    style 0_Commit_And_Push fill:#f87171,stroke:#dc2626,color:#450a0a
```
