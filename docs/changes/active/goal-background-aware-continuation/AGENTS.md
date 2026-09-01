# AGENTS.md — Goal background-aware continuation

English | [中文](AGENTS.zh.md)

## Scope

This directory records two goal change tracks: suppressing automatic `<goal_round>` while background work is pending, and the goal guidance prompt supplied by `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance`. Both tracks are implemented; A is in the built-in driver and B is in the external plugin.

## File ownership

- `issue.md`: problem and confirmed scope.
- `requirements.md`: required user, model, and lifecycle behavior.
- `design.md`: target implementation, data flow, races, and rejected alternatives.
- `tasks.md`: dependency-ordered development plan and file inventory.
- `verification.md`: research evidence and post-implementation acceptance record.
- `status.yaml`: the only status source for this change.

## Current status

The change is `in-progress`; external B (`dsh-goal-guidance`) is implemented and mounted in the Web profile, and built-in A is implemented in the fork. Documents must keep the remaining full-acceptance gaps explicit.

## First reads

Read the repository root [`AGENTS.md`](../../../../AGENTS.md), [`docs/AGENTS.md`](../../../AGENTS.md), and [`packages/AGENTS.md`](../../../../packages/AGENTS.md), then read this change's `requirements.md` and `design.md`.

## Verification

After document edits, run `pnpm run test:docs`, `pnpm run doc-sync`, and `git diff --check`; during implementation, run the focused tests and profile checks in `tasks.md`. Do not restart the protected dsh Web Node process.
