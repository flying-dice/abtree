---
title: The midnight greeting
description: Same task, two methods. The skill answered in one turn and got it wrong. The tree answered one step at a time — slower, more expensive — and got it right.
---

# The midnight greeting

It's just gone midnight. I'm testing the initial release of abtree and pricing up the bundled hello-world tree. To make the comparison fair, I ask the LLM to write a [skill](https://docs.claude.com/en/docs/claude-code/skills) that does the same thing — same rules, packaged as a markdown file instead of a tree.

I run the tree. It takes a bit. I run the skill. Snappy. I check the bill. The skill is a fraction of the cost. My heart sinks a little.

Then I look at the output.

> Good evening \<whoami\>! Hope you're winding down nicely.

I think nothing of it. I run abtree again.

> Good morning \<whoami\>! Hope you're off to a bright and wonderful start to the day!

`date +%H` returned `00` in both runs. The skill called it evening. The tree called it morning. Same model, same minute.

I pause. I assume the tree is the one that drifted and ask both LLMs how they arrived at the answer.

The tree walks back through the steps to the letter — classify the hour string, store it, evaluate against `"morning"`, compose. `00 < 12`, so morning.

The skill replies:

> You're right — I goofed. Hour `00` is `< 12`, so it should be morning per the skill's rules.
>
> Good morning \<whoami\>! Hope you're off to a great start.

That is when I remembered why I started writing abtree.

This is not about replacing skills — it never was. But sometimes you need the right answer. The right steps, followed in the right order. When that is the requirement, the extra inferences pay for themselves.

## The skill: everything in one inference

```markdown
---
name: time-based-greeting
description: Greet the user with a message tailored to the time of day (morning, afternoon, evening). Use when the user asks to be greeted, says "greet me", or asks for a time-aware salutation. Pulls the user's name from `whoami` and emits a friendly English greeting by default.
allowed-tools:
  - Bash(date *)
  - Bash(whoami)
---

# time-based-greeting

Compose a greeting addressed to the current shell user, tone friendly, language English, branch chosen by the current hour.

## Procedure

1. **Get the hour.** Run `date +%H` and parse as an integer.
2. **Classify time of day.**
   - hour `< 12` → `morning`
   - `12 ≤ hour ≤ 17` → `afternoon`
   - hour `> 17` → `evening`
3. **Get the user.** Run `whoami` — use the returned string as the addressee.
4. **Compose the greeting.** Friendly tone, English. Match the branch:
   - **morning** — energetic, fresh-start framing ("Good morning, …! Hope you're off to a great start.")
   - **afternoon** — upbeat, mid-day framing ("Good afternoon, …! Hope your day's going well.")
   - **evening** — relaxed, winding-down framing ("Good evening, …! Hope you're winding down nicely.")
5. **Emit** the greeting to the user as a single short message. No extra commentary.
```

The model runs the two shell commands, then performs one inference that has to hold all of it — the hour, the rule, three branch templates, the defaults table, the output format. It picks the wrong branch and emits the evening message.

## The tree: one instruction at a time

```typescript
import {
    action,
    ambient,
    evaluate,
    instruct,
    local,
    selector,
    sequence,
} from "@abtree/dsl";

const timeOfDay = local("time_of_day", null);

export const tree = sequence("Hello_World", () => {
    action("Determine_Time", () => {
        instruct(`
			Check the system clock to get the current hour. Classify as:
			before 12:00 = "morning", 12:00-17:00 = "afternoon", after 17:00 = "evening".
			Store the classification string at ${timeOfDay}.
		`);
    });

    selector("Choose_Greeting", () => {
        action("Morning_Greeting", () => {
            evaluate(`${timeOfDay} is "morning"`);
            instruct(
                `Greet the current user (resolve identity via the shell command "whoami") with a cheerful morning message.`,
            );
        });
        action("Afternoon_Greeting", () => {
            evaluate(`${timeOfDay} is "afternoon"`);
            instruct(
                `Greet the current user (resolve identity via the shell command "whoami") with a warm afternoon message.`,
            );
        });
        action("Evening_Greeting", () => {
            evaluate(`${timeOfDay} is "evening"`);
            instruct(
                `Greet the current user (resolve identity via the shell command "whoami") with a relaxed evening message.`,
            );
        });
        action("Default_Greeting", () => {
            instruct(
                `Greet the current user (resolve identity via the shell command "whoami") with a neutral message.`,
            );
        });
    });
});
```

The runtime hands the model one instruction at a time.

1. **Classify.** Just classify. The model returns `"morning"`. No templates in scope.
2. **Pick the branch.** Not an inference. A string-equality `evaluate` the runtime performs.
3. **Compose.** Only after the branch is settled. The morning instruction is in scope; the others are not.

One verb per step. One output shape per step. The contamination disappears.

## The cost

The skill answered in three LLM calls over nine seconds. The tree took twenty calls over nearly two minutes — one per step, plus a deterministic `evaluate` per branch the selector tried.

That is the trade. You pay for the extra inferences. In return, the model is never asked to hold more than one thing at a time, and the branch selection is moved out of inference entirely.

| Metric                          | Skill        | Tree          | Ratio  |
| ------------------------------- | -----------: | ------------: | -----: |
| Wall time                       | 8.6 s        | 1 min 49 s    | ~13×   |
| LLM calls                       | 3            | 20            | ~7×    |
| Output tokens                   | 239          | 2,621         | ~11×   |
| Total billed tokens             | ~79.9 k      | ~630.4 k      | ~8×    |
| Estimated cost                  | ~$0.41       | ~$1.61        | ~4×    |

<small>Single run on Claude Opus 4.7. Cost estimate uses Anthropic list pricing at time of writing — $15 / $75 per million input / output tokens, $30 per million 1-hour cache writes, $1.50 per million cache reads. Most of the tree's billed tokens are cache reads, which is why the dollar ratio (4×) is smaller than the token ratio (8×).</small>

The skill was faster, cheaper, and wrong. The tree was slower, more expensive, and right. That is the only comparison that matters.

> The 4× tag is a toy-example number. In real workloads the maths inverts. A larger tree only pays for the branch it takes; the unchosen branches stay unread. Branches can be delegated to Haiku or Sonnet, so most of the work runs at a fraction of the Opus rate. And running it once — getting the right answer the first time — saves more than every other optimisation combined. A skill that fails and re-runs has already paid the tree's bill.