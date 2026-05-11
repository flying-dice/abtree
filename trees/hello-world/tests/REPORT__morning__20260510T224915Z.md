# Test report — Morning — before noon picks Morning_Greeting

**Tree:** hello-world
**Spec:** .abtree/trees/hello-world/TEST__morning.yaml
**Target execution:** test-tree-run-morning-before-noon-picks-__hello-world__1
**Overall:** PASS

## Final $LOCAL

| key | value |
|---|---|
| time_of_day | "morning" |
| greeting | "Good morning, John Doe! Hope today brings something great." |

## Assertions

| Name | Expected | Actual | Pass |
|---|---|---|---|
| status | done | done | ✓ |
| local.time_of_day | morning | morning | ✓ |
| local.greeting | starts with "Good morning" | "Good morning, John Doe! Hope today brings something great." | ✓ |

## Trace

```mermaid
---
title: "test-tree run: Morning — before noon picks Morning_Greeting (complete)"
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
    style 0_1_Morning_Greeting fill:#4ade80,stroke:#16a34a,color:#052e16
    0_1_Afternoon_Greeting["Afternoon Greeting\n[action]"]
    0_Choose_Greeting --> 0_1_Afternoon_Greeting
    0_1_Evening_Greeting["Evening Greeting\n[action]"]
    0_Choose_Greeting --> 0_1_Evening_Greeting
    0_1_Default_Greeting["Default Greeting\n[action]"]
    0_Choose_Greeting --> 0_1_Default_Greeting
```
