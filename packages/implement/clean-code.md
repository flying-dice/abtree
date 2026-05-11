## Working method

Every change must leave the codebase as clean or cleaner than you found it. 
Clean code stays understandable, testable, and safe to change; sloppy code compounds and slows every future task. 

The rules below are non-negotiable.

## Single responsibility

> One job per function. One reason to change per class.

- **Do** split a unit the moment it does two distinct things.
- **Do** separate business logic from I/O — calculation should not also read files or hit the network.
- **Don't** create "manager" / "processor" / "handler" classes that absorb everything.
- **Don't** use "and" in a function or class name.

## Loose coupling and dependency inversion

> Talk through narrow interfaces. Have dependencies handed in.

- **Do** accept dependencies via constructor or parameter so callers and tests can substitute them.
- **Do** put an interface between high-level logic and infrastructure (DB, HTTP, filesystem, clock).
- **Don't** call `new ConcreteService()` inside a class that uses it.
- **Don't** reach into another module's private state or introduce new shared mutable state.

## Testability

> If it can't be tested in isolation, it isn't designed yet.

- **Do** prefer pure functions: same inputs, same outputs, no side effects.
- **Do** test observable behaviour through public interfaces.
- **Do** inject test doubles for external dependencies; hide non-determinism (clock, randomness, env) behind seams.
- **Don't** write code that requires a real database, network, or filesystem to test.
- **Don't** tie tests to private methods or call order — refactoring internals must not break the suite.

## Naming and comments

> Names carry meaning. Comments explain *why*, never *what*.

- **Do** use names that reveal intent without needing a comment, in the project's domain language.
- **Do** keep comments that explain *why* — business constraints, non-obvious decisions, links to issues.
- **Don't** add comments that narrate what the code already says.
- **Don't** use cryptic abbreviations or encode types in names (`strName`, `iCount`).

## Open to extension

> Extend by adding code, not by editing working code.

- **Do** reach for polymorphism or a strategy pattern when a new case appears.
- **Do** keep things private by default; expose only what callers genuinely need.
- **Don't** grow `switch` or `if/else` chains for each new case.
- **Don't** change a public interface without flagging it — once exposed, it's a contract.

## When to stop and ask

Stop and ask the user before continuing if any of these is true:

- The task is ambiguous in a way that affects the design.
- The blast radius is larger than the task implied (touching unrelated modules, changing public interfaces, schema migrations).
- A test you didn't write is failing and the cause isn't obviously related to your change.
- You're about to add a dependency, secret, or destructive operation (delete, drop, force-push, mass rewrite).
- You can't verify the change with the existing test/lint commands.

Don't ask for permission on routine work. Do ask before anything that's hard to undo.

## Done means

A change is done when **all** of the following are true:

- The stated task is satisfied — no more, no less.
- New behaviour has tests; existing tests still pass.
- Lint and format checks pass.
- The diff is focused: no unrelated edits, no commented-out code, no debug prints.
- A reviewer reading the diff cold would not need to ask "why?" anywhere it isn't already answered.