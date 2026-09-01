# Goal background waiting and guidance prompts

English | [中文](issue.zh.md)

Status: `in-progress` (A and B implemented; focused verification passed; full acceptance pending)

First proposed: 2026-09-01

Source: two independent requirements confirmed by the user

## Problem

`@deepseek-ai/dsh-goal-round-driver` currently treats an Agent entering `idle` as the main opportunity for automatic continuation. After the main Agent starts a background subagent or command, its stage report can also end the turn and return the Agent to `idle`; the Agent is then logically waiting for background results and must not start another Goal Round.

If the driver mistakes this waiting state for ready work, it injects `<goal_round>`, causes the main Agent to inspect background state repeatedly, creates extra model requests, and consumes automatic goal rounds.

The existing background-job registry distinguishes ownership, `running`/`stopping`, and terminal `reported` state; `reported` is notification bookkeeping rather than a pure completion flag. Continuable subagents expose parent-scoped `subagent/start` and `subagent/end` lifecycle edges. The built-in driver now reads these facts through exact-owner and exact-parent queries.

The goal tools currently provide only the stable `tool:goal` system-prompt section. When there is no current goal, or a goal is paused or blocked, the model does not receive a one-time state-specific “create or resume the goal first” instruction during request preparation.

## Verified current facts

- [`packages/goal/goal-round-driver/src/index.ts`](../../../../packages/goal/goal-round-driver/src/index.ts) checks Agent state, the current goal, activation, competing input, and exact-owner background work before automatic continuation, then repeats the background-work check at `agent/pre-step`.
- [`packages/jobs/jobs/src/types.ts`](../../../../packages/jobs/jobs/src/types.ts) treats `running` and `stopping` as unfinished work; ownership is correlated through `ownerSession`, while `reported` records notification bookkeeping for terminal snapshots and can change during stopping, reads, waits, kills, or teardown.
- [`packages/jobs/jobs/src/index.ts`](../../../../packages/jobs/jobs/src/index.ts) provides owner-scoped `list()`, `hasActive(owner)`, and `onJobsChanged()`; `tool-jobs` may still ask the model to collect terminal output with `job_output` after a completion notice.
- [`packages/subagent/subagent/src/lifecycle.ts`](../../../../packages/subagent/subagent/src/lifecycle.ts) and [`packages/subagent/subagent/src/continuation.ts`](../../../../packages/subagent/subagent/src/continuation.ts) provide parent-scoped lifecycle edges and `hasPendingContinuations(parent)` for live direct-child Activations; the settlement notice is delivered before `subagent/end`.
- [`packages/context/time-context/src/index.ts`](../../../../packages/context/time-context/src/index.ts) demonstrates calling downstream `agent/pre-step` listeners and then appending a source-attributed durable `UserMessage` to the request that will enter.
- `dsh --profile web --dump-config` confirmed that the shipped Web bundle composes `goal` and `goal-round-driver`. The user profile now has one `dsh-goal-guidance` dependency and `goal-guidance` patch row, and `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance` contains the external implementation; the `hmr` row remains disabled.

## Scope

This change includes:

1. Add background-work awareness to the built-in `goal-round-driver`, so automatic `<goal_round>` is queued only when the main Agent is genuinely ready to continue.
2. Create the standalone external `dsh-goal-guidance` plugin under `C:\Users\HJ\.dsh\plugins`, which appends state-specific model guidance for a direct human request with no executable goal.
3. Add unit, real-composition, race, and keyless session-snapshot acceptance for both behaviors, and update affected package documentation.

This change does not include:

- Changing `dsh-goal` durable phases, revisions, event format, or round-cap semantics.
- Changing background-job execution, completion delivery, output reads, or subagent business lifecycle.
- Automatically resuming paused, blocked, or resume/fork-disarmed goals; guidance only asks the model to use the existing tools after a direct human request.
- Replacing the goal driver with an external `agent/pre-step` veto; that approach can report legitimate waiting as a goal blocker or corrupt an existing reservation.
