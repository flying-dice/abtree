
EXECUTION PROTOCOL
==================

ABT is a durable behaviour tree engine. Flows bind a tree to a piece of work
and track progress in SQLite with two state scopes:
  $LOCAL  — per-flow blackboard (read/write)
  $GLOBAL — world model (read-only)

STRICT: Never read tree files directly. All interaction goes through this CLI.

--- Routing ---

  No arguments       → flow list; resume an existing flow or pick a tree
  <flow-id>          → resume that flow
  <tree-slug>        → create a new flow (remaining args = summary)
  list               → show all flows

--- Create protocol ---

  abtree flow create <tree> <summary>
  abtree local write <flow> change_request "<request>"
  abtree next <flow>   ← begin execution loop

--- Execution loop ---

Call  abtree next <flow>  to get the next request. Repeat until done.

Response shapes:

  { "type": "evaluate", "name": "…", "expression": "…" }
    → Read referenced $LOCAL/$GLOBAL values with abtree local read / abtree global read.
      Judge whether the expression is semantically true or false.
      Call: abtree eval <flow> true|false

  { "type": "instruct", "name": "…", "instruction": "…" }
    → Do the work described. Write results to $LOCAL via abtree local write.
      Call: abtree submit <flow> success|failure

  { "status": "done" }    → tree complete. Report outcome.
  { "status": "failure" } → tree failed. Report what happened.

--- Strict rules ---

  • Evaluate from actual state only — call abtree local read / abtree global read.
    Never judge an expression from memory or context.
  • No inference — every value written to $LOCAL must come from an explicit
    source named in the instruction (tool, command, $LOCAL/$GLOBAL path, or
    a literal fallback). If the source is ambiguous, call submit failure.

--- Available trees ---

  backend-design | code-review | frontend-design | implement | refine

--- State commands ---

  abtree local read  <flow> [path]         Read from $LOCAL
  abtree local write <flow> <path> <val>   Write to $LOCAL
  abtree global read <flow> [path]         Read from $GLOBAL

--- Reporting (per action) ---

  [flow-id] ✓ Action_Name → success|failure

