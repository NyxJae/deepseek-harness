# Goal background-aware continuation and external guidance design

English | [中文](design.zh.md)

Status: `in-progress` (A and B implemented; full acceptance pending)

Related requirements: [`requirements.md`](requirements.md)

## 1. Design conclusion

This change keeps the existing ownership split between the goal domain and model-facing consumers:

- A directly modifies the built-in `@deepseek-ai/dsh-goal-round-driver`, because that plugin alone decides when an automatic `<goal_round>` is queued and admitted; there is no current public veto point that an external plugin can use without turning legitimate waiting into a blocker.
- B creates the external `dsh-goal-guidance`, because it is dynamic model guidance and does not need to change goal state or tool authority; it lives under `C:\Users\HJ\.dsh\plugins` and is composed by the Web profile.

Do not implement A as an external listener that rejects an already queued Goal Round in `agent/pre-step`. The built-in driver uses rejected reservations in its termination and recovery paths, so an external listener cannot reliably distinguish background waiting from an actual Goal Round failure. Do not emulate waiting with external `pause`/`resume`, because that changes durable phase, revision, and user-visible state.

## 2. A: background-work detection

### 2.1 Job registry query

Add an owner-exact read-only query to the `@deepseek-ai/dsh-jobs` Service Definition, for example `hasActive(owner: Agent): boolean`, and implement it in `LocalJobRegistry` by reusing its exact-owner active count:

```text
function hasOutstandingOwnedJob(agent: Agent): boolean {
  const jobs = ctx.get('jobs')
  return jobs?.hasActive(agent) ?? false
}
```

`hasActive(owner)` compares the exact Agent object, counts only `running` and `stopping`, and returns false for terminal Jobs regardless of `reported`; a same-SessionId replacement therefore cannot observe an older Agent lifecycle's Job.

Use `ctx.get('jobs')` only for admission reads. Register `onJobsChanged` through a child injection owned by the driver fiber; ignore `owner === undefined`, and request reevaluation only for an existing state whose Agent object is the exact owner. Do not create state for another owner or let an unowned change drive every Agent. A missing Jobs provider leaves the gate false and creates no observer.

### 2.2 Continuable-subagent query

Continuable subagents do not use a Job wrapper, so add a public synchronous read-only query to `ctx.subagents`, for example `hasPendingContinuations(parent: Agent): boolean`, and read it as `ctx.get('subagents')?.hasPendingContinuations(agent) ?? false`.

- The query returns true exactly while a live Activation for a direct child of that exact Agent exists; a managerless provider and a persisted but not materialized child return false. An Activation created before `subagent/start` is included, and an exact parent replacement does not match an older Activation.
- A parent-scoped `subagent/start` listener requests another driver evaluation; the matching `subagent/end` listener does the same. These events wake reevaluation and do not maintain a second lifecycle source.
- The manager removes the Activation before delivering the settlement notice and publishing `subagent/end`, then releases parent ownership. The query must therefore be false in the end listener and cannot be derived only from `ownedChildren`.
- If an installed provider query throws, the driver surfaces the error through its existing error path rather than treating it as no work. The driver fiber removes these listeners during disposal and waits for its existing driver teardown.

Use the existing `carrierKeyOf(this)` to identify the event's exact parent without adding a parent field to the `SubagentRunInfo` wire payload. Do not inspect the continuation manager's private `activations`, and do not treat `listChildren().activity` as an exact residency query. The public query supplies the current state after a reload, so a listener that starts mid-lifecycle cannot miss an active child.

A one-shot subagent may also emit `subagent/start` and `subagent/end`, but its background path remains governed by the exact-owner Job query; the query counts only continuable live Activations, so lifecycle noise is ignored and no Goal Round is duplicated.

### 2.3 Driver condition and wakeup

Add `hasOutstandingBackgroundWork` to the existing `readyToDrive` checks and read it again during reservation admission and pre-step revalidation:

```text
readyToDrive
  = existing agent/goal/competing/stopping checks
  && !hasOutstandingBackgroundWork(agent)
```

`ctx.jobs.onJobsChanged` is registered through the driver-owned child injection described above. `subagent/start` and `subagent/end` request the existing drive evaluation only after resolving their carrier parent and existing Agent state; they do not call the model, `followup`, or goal mutations. Existing Job completion listeners continue to decide whether a result is injected into next-step, opens next-turn, or stays quiet.

If background work appears after a reservation, the pre-step check follows the existing stale-reservation recovery path: remove or reject the Goal message, preserve other claimed or newly queued input, release the attempt, and wait for background delivery or another external wakeup. It does not call `goals.block()`, because waiting is a scheduling condition rather than a durable blocker.

Job settlement can notify `onJobsChanged` before the completion listener emits its terminal notice. The driver may observe no active Job and request an evaluation, but the notice becomes competing input before pre-step admission; the final check must leave the reservation stale without a model request, Round increment, or blocker for both terminal `reported: false` and `reported: true`.

### 2.4 Terminal and lifecycle boundaries

- A Job in `completed`, `failed`, or `killed` is no longer ongoing background work; existing jobs control completion notice delivery, output reads, and `reported` updates.
- A continuable child blocks only while `hasPendingContinuations(parent)` is true; the query is false after the manager removes the live Activation before settlement notice and `subagent/end`, while the manager's delivery order remains authoritative.
- When the current Agent is disposed, the driver removes its associations and creates no reservation for the invalid lifecycle.
- During teardown, new admission closes first, existing driver work follows its current cancellation/wait path, and observers cannot request a new drive after teardown.

## 3. B: external `dsh-goal-guidance`

### 3.1 Package and profile

Directory:

```text
C:\Users\HJ\.dsh\plugins\dsh-goal-guidance\
  package.json
  index.mjs
  README.md
```

Use the direct ESM form of the existing `dsh-soul` plugin: export `name`, `inject`, and `apply`; do not add it to the repository `packages/` aggregate or modify a shipped package. `package.json` declares only the runtime Cordis, Agent, goal, and LLM construction dependencies; the profile links the package to this absolute path.

The Web profile needs to:

1. Add a `dsh-goal-guidance` `link:` dependency to `C:\Users\HJ\.dsh\profiles\web\package.json`.
2. Add one `goal-guidance` row to the `insert` section of `C:\Users\HJ\.dsh\profiles\web\cordis.patch.yml`.
3. Keep the current `hmr` row disabled; do not add a HMR root in this change. Verify activation through `dump-config` and require a user-owned manual process reload after dependency or patch changes. A future HMR change must restate the complete row configuration and add exact built-artifact roots for both the built-in driver and external entry.
4. Run `dsh --profile web --dump-config` and confirm that only one external implementation is mounted.

The change does not add this plugin to built-in `standard` or `ptc` preset files. A guidance step requires `ctx.agents.get(agent.id) === agent` and `agent.session.header.parentSession === undefined`; `ctx.agents.roots()` alone is insufficient because a continuable child can be a runtime root while retaining durable parent lineage.

### 3.2 Pre-step data flow

The plugin registers an effect-owned `agent/pre-step` listener following `time-context`:

1. Call `next()` and retain its `kind`, `messages`, `startsRequestSeries`, and rejection result.
2. Return unchanged when the decision rejects, the signal is aborted, or the Agent fails the exact live-main-session check (`ctx.agents.get(agent.id) === agent` and `agent.session.header.parentSession === undefined`).
3. Inspect the durable suffix of the current open turn and the proposed `decision.messages` for a direct human message; a `source.kind === 'user'` message in a child session is not direct human input.
4. Read `ctx.goals.get(agent)` and map `undefined`, `paused`, `blocked`, and `active + disarmed` to their state-specific guidance.
5. Check whether the current turn already contains a `dsh-goal-guidance` snapshot; do not append a duplicate.
6. Create a `UserMessage` with this source:

```text
{
  kind: 'plugin',
  plugin: 'dsh-goal-guidance',
  form: 'snapshot',
  sections: [{ name: 'goal-guidance', text }],
}
```

7. Return `{ ...decision, messages: [...decision.messages, guidance] }`.

The message is persisted with the other `user/message` events when the Agent loop accepts the step, so it does not create a separate wakeup or turn. Deduplication scans from the current `turn/start`, so a plugin reload cannot repeat a prompt merely because an in-memory WeakMap was lost.

### 3.3 Text policy

Use stable task language for the model with these branches:

- No goal: decide whether the direct human request is a long-running completion objective; if so, call `create_goal`, otherwise handle it as an ordinary single-turn task.
- Paused: call `get_goal` and then `update_goal(resume)` only when the direct human requests continuation of the existing objective.
- Blocked: inspect whether the blocker is resolved; do not resume or add a blocker merely because work is difficult.
- Active + disarmed: explain that explicit rearming after resume/fork needs a direct human continuation request.
- Active + armed and complete: do not append dynamic guidance in the first version. `complete` does not resume; a new long-running direct request remains eligible for the existing `create_goal` policy to create a replacement goal.

The text must not expose `ctx.goals`, Jobs, reservations, RPC, or profile terminology to the model, and it must not perform a mutation. Existing goal-tool authority checks remain the only execution-time constraint.

## 4. Testing and documentation design

### 4.1 A focused tests

Extend the real Agent Loop harness in `packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts`:

- Mount a real `LocalJobRegistry` and controller, and use deferred `done` promises to test `running`, `stopping`, and terminal Jobs that do not block; assert the settlement-before-completion-notice race with terminal `reported: false` and `reported: true`.
- Mount or simulate a real continuable subagent and verify exact direct-child live Activation, the pre-`start` materialization case, the removal-before-settlement/end ordering, and same-SessionId parent replacement.
- Cover a background-work race after reservation and before pre-step.
- Cover other-owner and unowned Jobs not blocking.
- Cover listener disposal and no later drive.

Do not use sleep or model polling in focused tests; use deferred promises, lifecycle events, and existing quiescence signals such as `whenIdle()`.

### 4.2 B focused tests

Use the external plugin's real Loader composition rather than only a hand-built `ctx.plugin` fixture, and cover:

- direct-human input with no goal, paused, blocked, and active + disarmed states, including text and snapshot source;
- no message for active + armed, complete, plugin notices, or background-result-only steps, plus no duplicate within a turn;
- no message for a continuable child whose initial prompt has `source.kind === 'user'`, and no message after pre-step rejection or cancellation;
- missing goal service or projection failure retains fail-loud behavior, and listener removal after dispose;
- no extra turn and no goal mutation from appending guidance.

### 4.3 Composition and snapshots

The model-visible A/B behavior requires keyless recorded-session snapshot updates:

- A shipped-profile keyless session snapshot in `apps/cli/tests/profiles/acp/tests/goal.expected.e2e.ts` and its `goal-expected` artifacts covers background wait, no extra Round, and continuation after delivery.
- The headless goal fixture in `apps/cli/tests/profiles/headless/goal.cordis.snapshot.yml` proves A only when the fixture actually mounts Jobs and continuable-subagent providers.
- Add a Web-owned keyless scenario at `apps/web/tests/goal-guidance.e2e.ts` with its owner-local `snapshots/web/goal-guidance/` artifacts; it must record guidance source, same-turn deduplication, notification/background-only omission, and `complete`/`active + disarmed` branches.
- Do not treat an ACP or headless snapshot as evidence for B, because B is mounted only by the Web profile.

Implementation adds runtime queries and ordinary plugin `UserMessage` records but no `SessionEventMap` member or Agent Loop protocol change; therefore it does not trigger TypeScript/Python SDK projection synchronization. If that boundary changes, add the corresponding expected outputs.

After implementation, update [`packages/goal/goal-round-driver/README.md`](../../../../packages/goal/goal-round-driver/README.md) and the external plugin README; update `dsh-goal` or `tool-goal` only if their current behavior actually changes. A non-trivial built-in code change also needs a new or updated bug-fix Agent Note in the same change.

## 5. Runtime verification

After implementation:

1. Run A/B focused tests and real-composition tests.
2. Run keyless snapshot replay and verify that waiting for background work adds no Goal Round and that continuation resumes after delivery.
3. In the Web profile, run `pnpm install` only when profile dependencies changed, then run `dsh --profile web --dump-config`.
4. Verify the exact profile resolution path of the external entry.
5. HMR is not part of this change because the current Web profile `hmr` row is disabled. Verify manual reload/activation only; a future HMR change must restate the complete row and exact built-artifact roots before claiming live updates.
6. Run documentation and worktree checks.
