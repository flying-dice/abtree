# abtree

Abtree is an agentic, progressively disclosed behavioural tree toolkit. Create expressive behaviour trees to steer your agents with coarse or fine instructions. abtree aims to bring the structural reliability of robotics and AAA game AI to the agentic stack, giving you deterministic control over simple and complex workflows.

**One CLI to Rule the Workflow**
**• Agent-First Design:** Native CLI & MCP server build for your agent.
**• Durable Execution:** Resumable flows that persist across sessions via SQLite storage.
**• Progressive Disclosure:** Agents only see the next step when they reach it, eliminating "instruction fatigue."
**• Platform Agnostic:** Works seamlessly with any agentic framework or platform.

## What’s different about Behaviour Trees?
While modern LLMs are capable of following Markdown-based instructions, two fundamental issues often emerge. **Instruction Fatigue** and **Non-Determinism**. When instructions become too dense, agents lose focus, when decision-making is left entirely to the model, workflows can feel random.
Behaviour Trees solve this by providing a formal logic layer. Long used in video games and robotics to manage complex AI actors, they provide a modular way to build tasks that are both scalable and predictable.
## The 3 Core Elements of a Tree
abtree strips away the complexity of BTs to focus on three functional components:
 **State**, **Branches**, and **Actions**.
### 1. State
All behaviour trees are stateful by design. Instead of leaving agents relying on a shifting conversation window, abtree separates and manages state in two distinct scopes:
* **Local ($LOCAL):** The internal workflow state. These are variable containers for data generated during the run (e.g., a generated ID or a confidence score).
* **World ($GLOBAL):** The external environment. These are instructions on how the agent should observe or query the current environment (e.g., checking a database or reading a sensor). You do not "set" world state; you observe its reality.
### 2. Branches
Branches define the flow of execution. They allow you to model complex logic through simple parent-child relationships:
* **Sequence:** Executes children in order. If any child fails, the sequence aborts. This is used for linear dependencies.
* **Selector:** Executes children until one succeeds. This is the primary tool for fallback logic and decision-making.
* **Parallel:** Executes all children simultaneously. If any child fails, the entire branch is considered failed.
### 3. Actions
Actions are the "leaves" of the tree—the actual work being done. Every action in abtree consists of two parts:
* **Instruction:** The specific task for the agent to perform.
* **Evaluate:** An invariant rule that must be met for the action to succeed. Success is not "guessed"; it is verified against this rule.

By using this hierarchy, the result of every action propagates up the tree. This ensures that an agent cannot move to a "Goodbye" step if a "Quality" step failed to meet its invariant. Lets see it in action:

```yaml
workflow: time_aware_greeter
name: Dynamic Greeting Protocol

state:
  local:
    current_hour: null
  global:
    check_time: "Execute `date +%H` to get the current hour in 24-hour format."

type: sequence
children:
  - type: action
    name: initialize_time
    instruction: "Use $GLOBAL.check_time to determine the hour and save to $LOCAL.current_hour."
    evaluate: "$LOCAL.current_hour is not null"

  - name: select_greeting
    type: selector
    children:
      - type: action
        name: morning_greet
        instruction: "If $LOCAL.current_hour is between 05 and 11, say 'Good morning!'"
        evaluate: "$LOCAL.current_hour >= 5 and $LOCAL.current_hour < 12"

      - type: action
        name: afternoon_greet
        instruction: "If $LOCAL.current_hour is between 12 and 17, say 'Good afternoon!'"
        evaluate: "$LOCAL.current_hour >= 12 and $LOCAL.current_hour < 18"

      - type: action
        name: evening_greet
        instruction: "Say 'Good evening!'"
        evaluate: "$LOCAL.current_hour >= 18 or $LOCAL.current_hour < 5"

  - type: action
    name: farewell
    instruction: "Wave goodbye to the user."
    evaluate: "Terminal contains 👋"
```

Sitting as a separate coordination layer, **abtree** functions as the structural backbone for agentic sessions, distinct from standard prompts or skills. It operates via a YAML spec and a CLI/MCP server to enforce a strict "start at the root" protocol, progressively disclosing instructions only after the agent satisfies specific evaluation invariants. This keeps the LLM on rails by preventing instruction fatigue and "jumping ahead," while a local SQLite database snapshots the workflow and persists state. The result is a durable execution environment where trees can grow to unbounded size, allowing for granular control and predictable resumption across sessions.

## Explore the Ecosystem
* **Examples Repository:** Check out our [Examples Repo] to see production-ready **development workflows** and hardware-control trees.
* **Workflow-Builder Skill:** Use this skill to help your agent collaboratively design and iterate on new tree specs.
* **Workflow-Runner Skill:** Equip your agent with the ability to navigate trees, persist state, and enforce invariants across sessions.

**Don't leave your agent's success to chance.** Use the proven logic of behavior trees to build reliable, resumable workflows.

**On the Roadmap: Dynamic Planning & Utility Scoring**
While **abtree** currently excels at structured, deterministic workflows, we are expanding toward more autonomous reasoning. Future updates will introduce **GOAP (Goal-Oriented Action Planning)** and **Utility AI** layers. This will allow the platform to move beyond fixed branches and more into dynamic prioritisation and reasoning. 