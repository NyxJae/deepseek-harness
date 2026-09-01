# AGENTS.md — Active changes

English | [中文](AGENTS.zh.md)

## Scope and ownership

This directory stores unfinished cross-package requirements, target designs, development tasks, and verification records. Each change uses its own subdirectory, whose `AGENTS.md` narrows file ownership and status rules.

Current change: [`goal-background-aware-continuation`](active/goal-background-aware-continuation/requirements.md).

## Rules

- Active-change documents describe target state or verified current facts; unmerged behavior must be marked `proposed` or “not implemented”.
- Keep requirements, design, tasks, and verification records linked; preserve code paths, profile paths, and commands verbatim.
- Do not move a change to archive before it is complete; after implementation, synchronize current behavior with the nearest package README, subsystem page, and required Agent Note.
- Documentation checks are `pnpm run test:docs`, `pnpm run doc-sync`, and `git diff --check`; report only commands actually run.
