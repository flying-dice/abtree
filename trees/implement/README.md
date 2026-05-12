# @abtree/implement

Implement an approved plan with complexity-gated architectural review, following the clean-code rules in `clean-code.md`.

![tree](./tree.svg)

## Run it

Paste this brief into Claude Code, ChatGPT, or any shell-capable agent. Replace `<plan-name>` with the filename of an approved plan in `plans/`:

```text
Install and drive the @abtree/implement workflow:

  npm i --save-dev @abtree/implement
  abtree --help
  abtree execution create ./node_modules/@abtree/implement "Implement plans/<plan-name>.md"

Step through every prompt with `abtree next`, `abtree eval`, and
`abtree submit` until status: done.
```

## Install and run

See [Using a tree](https://abtree.sh/guide/using-trees) for the long-form walkthrough. `<pkg>` for this tree is `@abtree/implement`.
