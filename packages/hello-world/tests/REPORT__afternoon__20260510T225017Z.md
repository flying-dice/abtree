# Test report — Afternoon — 12:00–17:00 falls through to Afternoon_Greeting

**Tree:** hello-world
**Spec:** .abtree/trees/hello-world/TEST__afternoon.yaml
**Target execution:** test-tree-run-afternoon-12-00-17-00-fall__hello-world__1
**Overall:** PASS

## Final $LOCAL

| key | value |
|---|---|
| time_of_day | "afternoon" |
| greeting | "Good afternoon, John Doe — hope your day is going well." |

## Assertions

| Name | Expected | Actual | Pass |
|---|---|---|---|
| status | done | done | ✓ |
| local.time_of_day | afternoon | afternoon | ✓ |
| local.greeting | starts with "Good afternoon" | "Good afternoon, John Doe — hope your day is going well." | ✓ |

## Trace

```mermaid
---
title: "test-tree run: Afternoon — 12:00–17:00 falls through (complete)"
---
flowchart TD
    Hello_World{{"Hello World\n[sequence]"}}
    0_Determine_Time["Determine Time\n[action]"]
    Hello_World --> 0_Determine_Time
    style 0_Determine_Time fill:#4ade80,stroke:#16a34a,color:#052e16
    0_Choose_Greeting{{"Choose Greeting\n[selector]"}}
    Hello_World --> 0_Choose_Greeting
    style 0_Choose_Greeting fill:#4ade80,stroke:#16a34a,color:#052e16
    0_1_Morning_Greeting["Morning Greeting\n[action]"]
    0_Choose_Greeting --> 0_1_Morning_Greeting
    style 0_1_Morning_Greeting fill:#f87171,stroke:#dc2626,color:#450a0a
    0_1_Afternoon_Greeting["Afternoon Greeting\n[action]"]
    0_Choose_Greeting --> 0_1_Afternoon_Greeting
    style 0_1_Afternoon_Greeting fill:#4ade80,stroke:#16a34a,color:#052e16
    0_1_Evening_Greeting["Evening Greeting\n[action]"]
    0_Choose_Greeting --> 0_1_Evening_Greeting
    0_1_Default_Greeting["Default Greeting\n[action]"]
    0_Choose_Greeting --> 0_1_Default_Greeting
```
