# Goal background-aware continuation and state guidance requirements

English | [中文](requirements.zh.md)

Status: `in-progress` (A and B implemented; full acceptance pending)

Related issue: [`issue.md`](issue.md)

Target design: [`design.md`](design.md)

Development plan: [`tasks.md`](tasks.md)

Acceptance record: [`verification.md`](verification.md)

## 1. Goal

Reduce useless Goal Rounds while the main Agent waits for background work, and direct a model toward the correct create or resume action when a direct human request needs long-running progress but no executable goal exists.

The two requirements have independent triggers and owners:

- **Requirement A: suppress automatic continuation during background work**, owned by the built-in `@deepseek-ai/dsh-goal-round-driver`.
- **Requirement B: inject goal-state guidance**, owned by the external `dsh-goal-guidance` plugin at `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance`.

## 2. Requirement A: suppress automatic `<goal_round>` during background work

### A-1. Automatic continuation admission

The driver may inject or queue `<goal_round>` only when every condition below is true:

```text
Agent.status === 'idle'
&& currentGoal.phase === 'active'
&& currentGoal.activation === 'armed'
&& !competingQueued
&& !hasOutstandingBackgroundWork(agent)
```

The driver's existing stop, Agent identity, reservation, checkpoint, and teardown conditions remain in force.

### A-2. Definition of background work

`hasOutstandingBackgroundWork(agent)` counts only work owned by that exact Agent lifecycle, or continuable children whose parent relationship points to that Agent. It does not count work owned by another Agent or work without an owner.

It includes at least:

- `ctx.get('jobs')?.hasActive(agent) ?? false` returning true for a Job owned by the exact Agent object; `hasActive` compares object identity and counts only `running` and `stopping`, so an older Job with the same SessionId does not match a replacement Agent.
- `ctx.get('subagents')?.hasPendingContinuations(agent) ?? false` returning true only for a live Activation of a direct child of that exact Agent; a missing provider/manager and a persisted but not materialized child return false, while an Activation created before `subagent/start` is included. An exact parent replacement does not match an older Activation.
- If an optional provider is missing, its query contributes false; if an installed provider query throws, the driver surfaces the error through its existing error path instead of treating it as no work.

A terminal Job is not ongoing background work. Completion notices, output reads, and `reported` updates remain the responsibility of the existing jobs control surface and do not decide Goal Round admission.

### A-3. Waiting behavior

When background work exists, the main Agent may end its current turn with an ordinary stage report, but the driver must not:

- Inject or queue another `<goal_round>`.
- Create another model request.
- Increase the goal's `roundsStarted`.
- Change the goal to `paused`, `blocked`, or `complete`.

Background results continue through the existing jobs/subagent delivery paths and may wake the main Agent. After all background work ends, the next genuinely idle boundary may resume automatic continuation; terminal Job notification and output collection do not change the Goal Round admission rule.

### A-4. Race handling

The driver must recheck background work at both points:

1. Before creating the next round reservation.
2. During `agent/pre-step` reservation validation, immediately before the model request enters.

If background work appears between these checks, the reservation must follow the existing stale/not-admitted path. It must not send a model request, increment the Round count, or write a blocker to the goal. Temporarily removed non-goal input must follow the existing restoration path.

### A-5. Lifecycle and isolation

- A background-state change requests another driver evaluation instead of polling the model or using a timer.
- Register `onJobsChanged` through a child injection owned by the driver fiber; ignore `owner === undefined`, and request reevaluation only for an existing state whose Agent object is the exact owner. Do not create state for another owner or use an unowned change to drive every Agent.
- Reloading the driver must not miss existing active work and incorrectly continue; the driver uses the exact Job query and the live continuable-activity query for the new evaluation.
- Teardown continues to close admission, cancel or await Goal Rounds, and dispose background observers according to the existing lifecycle rules.

## 3. Requirement B: external goal-state guidance prompt

### B-1. External ownership

Create the plugin independently at:

```text
C:\Users\HJ\.dsh\plugins\dsh-goal-guidance
```

Mount it through a Web-profile `package.json` dependency and `cordis.patch.yml` insertion. Do not modify the built-in `dsh-goal` or `dsh-tool-goal` source for this guidance.

### B-2. Trigger timing

When an Agent is about to enter a model step, the external plugin follows the `time-context` `agent/pre-step` pattern:

- Call downstream listeners first.
- Append guidance only to a decision that will enter.
- Do not call `followup()`, `steer()`, or another `agent.inject()`, so the plugin does not wake the Agent or create a separate turn.
- Append at most one goal-guidance message per turn.

The first version triggers only when the open turn for a main Agent contains a direct human message. A background result, subagent report, Goal Round, or other plugin notification that wakes the Agent alone does not trigger the guidance. The listener must require `ctx.agents.get(agent.id) === agent` and `agent.session.header.parentSession === undefined`; `ctx.agents.roots()` alone is insufficient because a continuable child can be a runtime root. A child-session `source.kind === 'user'` message is not direct human input for this plugin.

### B-3. Non-executable goal states

The first version generates state-specific guidance as follows:

| Current state | Guidance |
|---|---|
| No current goal | If the direct human request is a long-running completion objective, call `create_goal` first; do not create a goal for a small single-turn task. |
| `paused` | If the direct human request asks to continue the same objective, call `get_goal`, then `update_goal(resume)` with the exact `goal_id` and `revision`; do not resume without that intent. |
| `blocked` | Read the blocker first; try `resume` with the exact ref only when the direct human request indicates that the blocker is resolved or asks to continue; do not treat difficulty or uncertainty as a new blocker. |
| `active + disarmed` | Explain that the goal exists but automatic continuation is not armed; when the direct human explicitly asks to continue, read the exact ref and call `resume`. |
| `complete` | Do not send recovery guidance in the first version; existing tool policy continues to allow a long-running new request to create a replacement goal. |

### B-4. Guidance content

The guidance is task language for the model and does not expose UI, RPC, plugin-composition, or internal scheduling terms. It states at least that:

- The current state has no executable goal; the model is not required to create or resume one unconditionally.
- Only a long-running completion objective should create a goal; routine single-turn work should not.
- `get_goal` must precede a goal update, using the exact `goal_id` and `revision`.
- A paused, blocked, or disarmed goal must not resume only because a plugin notification arrived; direct human continuation intent is required.
- The guidance itself does not mean that a goal was created, resumed, or completed.

The guidance message uses a plugin source with `form: 'snapshot'` and a section name, and is stored in the session's `user/message` record so model-visible content is replayable.

### B-5. Deduplication and failure

- Deduplication derives from the current turn's durable session record and the messages about to enter; it does not depend on an unreplayable global singleton.
- A rejected pre-step, an aborted signal, or an Agent that fails the exact live-main-session check receives no guidance; inspect both the current turn's durable suffix and the proposed `decision.messages` before accepting direct-human input.
- A valid projection with no current goal is normal; projection corruption, missing dependencies, and other service failures retain existing fail-loud behavior instead of being presented as no goal.

## 4. Shared acceptance criteria

### A scenarios

1. An active + armed goal with no background work keeps the existing automatic continuation.
2. A running Job prevents a new Goal Round after the Agent's ordinary stage report.
3. A terminal Job does not block because of its `reported` value; completion notification and output collection retain the existing jobs behavior.
4. A continuable child between `subagent/start` and `subagent/end` prevents a new Goal Round, while settlement notification still reaches the parent through the existing path.
5. Background work appearing after reservation and before pre-step causes the Goal Round to be discarded without blocking, counting, or requesting the model.
6. Jobs owned by another Agent and unowned Jobs do not affect the current Agent.
7. After all background work ends, the next genuinely idle boundary resumes automatic continuation.
8. Plugin unload, Agent disposal, and cancellation leave no observer, reservation, or later automatic round.
9. A Job settlement that signals `onJobsChanged` before the completion notice is tested with terminal `reported: false` and `reported: true`; neither case sends a model request, increments the Round count, or writes a blocker, and the notice is still delivered.

### B scenarios

1. A direct human request entering an Agent with no goal produces at most one creation guidance message in the next model request.
2. Later tool steps in the same turn do not append the guidance again.
3. `paused`, `blocked`, and `active + disarmed` produce their corresponding guidance; `active + armed` does not; `complete` does not in the first version.
4. A step woken only by a plugin notification or background result does not produce guidance.
5. Guidance does not open an extra turn, mutate goal revision/phase, or call a goal mutation itself.
6. After the external plugin is unloaded, no guidance is appended; the built-in goal and tool packages remain unchanged.
7. A Web-owned keyless session snapshot records the guidance source, same-turn deduplication, notification-only omission, and `complete`/`active + disarmed` branches.

## 5. Non-goals

- Do not change GoalService persistence format, state transitions, or CAS rules.
- Do not introduce token, time, or currency budgets.
- Do not let the model bypass the existing direct-human permission checks of the goal tools.
- Do not resend dynamic goal state on every request through a static system-prompt section.
- Do not replace owner-scoped lifecycle facts with polling `job_list`, `list_agents`, or model self-inspection.
