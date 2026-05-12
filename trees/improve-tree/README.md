# @abtree/improve-tree

Score the effectiveness of a tree using evidence from one of its sessions, find improvements in parallel, draft a plan in `plans/`, then commit and push.

![tree](./tree.svg)

## Run it

Paste this brief into Claude Code, ChatGPT, or any shell-capable agent. Replace `<path-to-tree>` with the tree under improvement (e.g. `trees/my-tree`) and `<execution-id>` with the session you want to learn from:

```text
Install the npm package @abtree/improve-tree, then drive the workflow against this repo:

  abtree --help
  abtree execution create ./node_modules/@abtree/improve-tree "Improve <path-to-tree> tree by analysing .abtree/executions/<execution-id>.json"
```

## Install and run

See [Using a tree](https://abtree.sh/guide/using-trees) for the long-form walkthrough. `<pkg>` for this tree is `@abtree/improve-tree`.
