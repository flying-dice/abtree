---
title: Motivation
description: >-
  What abtree replaces (monolithic skill files), what it is not
  (an orchestration framework), and why durable execution matters.
---

# Motivation

## What abtree replaces

If you give an AI agent a large skill file — a `CLAUDE.md`, a system prompt, a
long markdown playbook — you are handing it a document and hoping it follows it
consistently. It won't. It will skip steps it thinks it remembers, confuse the
order of operations, and interpret the same instruction differently on every run.
The file grows as you try to compensate. The problem worsens.

abtree replaces the skill file with a YAML behaviour tree. Instead of handing
the agent the whole document, the runtime hands it one step at a time, verifies
the result, and advances the cursor. The agent never sees what's coming next.

**Before abtree**
> A 400-line `CLAUDE.md` your agent reads once and interprets differently every
> run, with no record of where it got to.

**After abtree**
> A YAML tree your agent follows one step at a time, cursor persisted to disk
> after every step. Kill the process, restart the agent — it resumes exactly
> where it left off.

## What abtree is not

abtree is not a workflow orchestration framework. It does not compete with
LangGraph, Temporal, or multi-agent platforms. If you need distributed
workers, event-driven pipelines, or production observability infrastructure,
those tools are the right fit.

abtree solves one problem: the large, ambiguously-ordered skill file your agent
follows inconsistently.

## Why durable execution matters

Every execution persists as a JSON document on disk. The cursor, the state, the
progress through the tree — all of it is written after every single step. There
is no in-memory state that can be lost.

This matters because agent tasks are interrupted. A coding task hits a wall. A
step needs human approval. The process is killed. Without durability, you
restart from scratch. With abtree, the next `abtree next` picks up exactly
where the agent left off — no infrastructure, no database, no queue. Just a
file on disk.
