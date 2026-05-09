
EXECUTION PROTOCOL
==================

abtree is a durable behaviour tree engine. Flows bind a tree to a piece of work
and persist as JSON documents in .abtree/flows/, with two state scopes:
  $LOCAL  — per-flow blackboard (read/write)
  $GLOBAL — world model (read-only)

Internal bookkeeping (cursor, retry counts, per-node status) lives in a
`runtime` field on the flow document — invisible to `local read` and not
mutable via `local write`. You don't manage it; the engine does.

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


Response { "type": "evaluate", "name": …, "expression": … }
───────────────────────────────────────────────────────────

  Procedure — DO NOT skip steps:

    1. Parse the expression. Identify every $LOCAL.<path> and
       $GLOBAL.<path> referenced.
    2. For EACH referenced path, call:
         abtree local  read <flow> <path>     (for $LOCAL refs)
         abtree global read <flow> <path>     (for $GLOBAL refs)
       Record the actual returned value. Do not skip this step even
       if you wrote the value yourself one command ago.
    3. Apply the expression's truth condition against those actual
       values and ONLY those values. No inference from context, memory,
       or "obvious" assumptions.
    4. Call: abtree eval <flow> true|false

  STRICT: Skipping step 2 corrupts the gate. The store is the source of
  truth, not your context. Even when the answer "feels obvious", read it.


Response { "type": "instruct", "name": …, "instruction": … }
────────────────────────────────────────────────────────────

  Procedure:

    1. Read the instruction in full.
    2. Perform the work named. Use real tools — file I/O, web search,
       shell commands, sub-agents — as the instruction directs.
    3. Write any produced values to $LOCAL via abtree local write.
    4. Call: abtree submit <flow> success|failure|running
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

  abtree local  read  <flow> [path]         Read from $LOCAL
  abtree local  write <flow> <path> <val>   Write to $LOCAL
  abtree global read  <flow> [path]         Read from $GLOBAL

--- Reporting (per action) ---

  [flow-id] ✓ Action_Name → success|failure
