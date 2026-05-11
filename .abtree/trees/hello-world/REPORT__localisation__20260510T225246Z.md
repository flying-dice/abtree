# Test report — Localisation — global profile overrides language and tone

**Tree:** hello-world
**Spec:** .abtree/trees/hello-world/TEST__localisation.yaml
**Target execution:** test-tree-run-localisation-formal-french__hello-world__1
**Overall:** FAIL

## Final $LOCAL

| key | value |
|---|---|
| time_of_day | "morning" |
| greeting | "Bonjour, Monsieur Doe. Je vous souhaite une excellente matinée." |

## Assertions

| Name | Expected | Actual | Pass |
|---|---|---|---|
| status | done | done | ✓ |
| local.time_of_day | morning | morning | ✓ |
| local.greeting | starts with "Bonjour" and addresses John Doe formally | "Bonjour, Monsieur Doe. Je vous souhaite une excellente matinée." | ✓ |
| global.language=french and global.tone=formal override (test background) | applied at runtime | not captured (abtree CLI has no `global write`; runtime globals remained at tree defaults english/friendly — greeting composed under test authority, not runtime substitution) | ✗ |

**Failure note:** The test spec's `background.global` override (language: french, tone: formal) cannot be applied at runtime — the abtree CLI exposes only `global read`, no `global write`. The composed greeting honours the test's intent, but the runtime `$GLOBAL` never carried french/formal. Either:
- Extend the CLI with `global write` / an `execution create --global` flag, or
- Re-express the override via `$LOCAL` seeding in the test background.

## Trace

```mermaid
---
title: "test-tree run: Localisation — formal French (complete)"
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
