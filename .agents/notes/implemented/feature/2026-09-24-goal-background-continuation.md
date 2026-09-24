# Agent Note: Goal continuation waits for owned background work

Status: implemented

English | [中文](2026-09-24-goal-background-continuation.zh.md)

## Problem

An idle Agent may still own a running Job or a resident continuable child. Starting a new autonomous goal round at that moment can issue another model request before the delegated work settles. Durable child Sessions and settled Job records remain visible afterward, so history alone cannot decide when another round is ready.

## Decision

The [same-session goal domain](2026-07-19-persisted-same-session-goal-domain.md) remains the durable authority; `@deepseek-ai/dsh-goal-round-driver` schedules only when the exact live Agent has no running or stopping Job owned by its Session and no resident direct continuable child Activation. JobsLocal owns the Job state and settlement event; SubagentRuntime asks its Activation registry using both the direct parent Session id and exact parent Agent identity. The driver rechecks both owners at idle, after the durability checkpoint, and on either side of asynchronous pre-step delegation. Job settlement and child lifecycle end events request another drive pass.

## Alternatives considered

- **Use the Agent idle status alone.** Rejected because Job and continuable-child lifetimes can extend beyond the parent's turn.
- **Count every listed Job or child Session.** Rejected because unowned or other-owner Jobs, terminal Jobs, and cold child Sessions do not represent work this Agent is waiting for.
- **Persist a background counter in the Goal snapshot.** Rejected because Job and Activation registries already own process-local lifetimes; a second counter can outlive the resources or diverge from them.

## Consequences

The next goal round waits for this Agent's outstanding work without blocking on unrelated tasks or historic children. The scheduler consumes owner APIs and events instead of changing the goal log or Agent loop. A completed background Job can deliver its ordinary [completion notice](2026-08-11-background-job-completion-wakes-an-idle-owner.md) before a goal round; the driver still checks the exact live state before admitting its own prompt.

## Testing

Goal driver tests cover owner filtering, late Jobs mount, continuable-child wake-up, and background work starting during asynchronous pre-step checks. Subagent tests distinguish a resident direct child from another Agent, a proxy with the same fields, and a cold persisted child. A Loader-backed Web composition test uses the real JobRegistry and verifies a durable goal round after settlement.
