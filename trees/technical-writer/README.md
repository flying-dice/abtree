# @abtree/technical-writer

Take a documentation goal, ground it in the repo's styleguide, find or build a home in the docs tree, write to it, and gate-check structure / flow / atomicity. Up to three write/review passes (one initial + two retries) before surfacing failure to the human.

![tree](./tree.svg)

## Run it

Paste this brief into Claude Code, ChatGPT, or any shell-capable agent. Replace `<documentation goal>` with what you want documented:

```text
Install and drive the @abtree/technical-writer workflow against this repo:

  npm i --save-dev @abtree/technical-writer
  abtree --help
  abtree execution create ./node_modules/@abtree/technical-writer "Document <documentation goal> in docs/"

Step through every prompt with `abtree next`, `abtree eval`, and
`abtree submit` until status: done.
```

## Install and run

See [Using a tree](https://abtree.sh/guide/using-trees) for the long-form walkthrough. `<pkg>` for this tree is `@abtree/technical-writer`.
