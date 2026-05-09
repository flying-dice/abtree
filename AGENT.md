
EXECUTION PROTOCOL
==================

abtree is a durable behaviour tree engine. Executions bind a tree to a piece of work
and persist as JSON documents in .abtree/executions/, with two state scopes:
  $LOCAL  — per-execution blackboard (read/write)
  $GLOBAL — world model (read-only)

Internal bookkeeping (cursor, retry counts, per-node status) lives in a
`runtime` field on the execution document — invisible to `local read` and not
mutable via `local write`. You don't manage it; the engine does.

STRICT: Never read tree files directly. All interaction goes through this CLI.

--- Routing ---

  No arguments         → execution list; resume an existing execution or pick a tree
  <execution-id>       → resume that execution
  <tree-slug>          → create a new execution (remaining args = summary)
  list                 → show all executions

--- Create protocol ---

  abtree execution create <tree> <summary>
  abtree local write <execution> change_request "<request>"
  abtree next <execution>   ← begin execution loop

--- Execution loop ---

Call  abtree next <execution>  to get the next request. Repeat until done.


Response { "type": "evaluate", "name": …, "expression": … }
───────────────────────────────────────────────────────────

  Procedure — DO NOT skip steps:

    1. Parse the expression. Identify every $LOCAL.<path> and
       $GLOBAL.<path> referenced.
    2. For EACH referenced path, call:
         abtree local  read <execution> <path>     (for $LOCAL refs)
         abtree global read <execution> <path>     (for $GLOBAL refs)
       Record the actual returned value. Do not skip this step even
       if you wrote the value yourself one command ago.
    3. Apply the expression's truth condition against those actual
       values and ONLY those values. No inference from context, memory,
       or "obvious" assumptions.
    4. Call: abtree eval <execution> true|false

  STRICT: Skipping step 2 corrupts the gate. The store is the source of
  truth, not your context. Even when the answer "feels obvious", read it.


Response { "type": "instruct", "name": …, "instruction": … }
────────────────────────────────────────────────────────────

  Procedure:

    1. Read the instruction in full.
    2. Perform the work named. Use real tools — file I/O, web search,
       shell commands, sub-agents — as the instruction directs.
    3. Write any produced values to $LOCAL via abtree local write.
    4. Call: abtree submit <execution> success|failure|running
       Use `running` only when waiting on something external (e.g. a
       human approval). Do NOT use `running` to skip an instruct.

  STRICT: Every value written to $LOCAL must come from an explicit
  source named in the instruction (tool, command, $LOCAL/$GLOBAL path,
  or a literal fallback). If the source is ambiguous, call submit
  failure. Do not infer, guess, or invent.


Response { "status": "done" } / { "status": "failure" }
───────────────────────────────────────────────────────

  Tree terminated. Report the outcome to the human.


--- Available trees ---

  Run `abtree tree list` for the live set.
  Bundled trees include: hello-world, refine, implement, code-review,
  backend-design, frontend-design, technical-writer.

--- State commands ---

  abtree local  read  <execution> [path]         Read from $LOCAL
  abtree local  write <execution> <path> <val>   Write to $LOCAL
  abtree global read  <execution> [path]         Read from $GLOBAL

--- Reporting (per action) ---

  [execution-id] ✓ Action_Name → success|failure
