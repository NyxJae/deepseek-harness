# Goal background-aware continuation and external guidance development plan

English | [中文](tasks.zh.md)

Status: `in-progress` (A and B implemented; full acceptance pending)

Requirements: [`requirements.md`](requirements.md)

Design: [`design.md`](design.md)

## Phase 0: approval and baseline

- [ ] Confirm that the two requirements remain independent: A modifies the built-in `goal-round-driver`, and B uses `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance`.
- [ ] Record `git status --short --branch` before implementation without overwriting the user's existing changes.
- [ ] Preserve baseline behavior for the goal driver, Jobs, subagents, and goal-tool snapshots.

## Phase 1: implement A's background-work gate

### 1.1 Job observation

- [x] Add an exact-owner background-work query to `packages/goal/goal-round-driver/src/index.ts`.
- [x] Add an exact Agent-lifecycle query such as `hasActive(owner: Agent)` to `packages/jobs/jobs/src/index.ts`; implement it in `packages/jobs/jobs-local/src/index.ts` using the existing exact-owner active count, and add Jobs tests and API documentation.
- [ ] Update `packages/goal/goal-round-driver/package.json` with the `@deepseek-ai/dsh-jobs`, `@deepseek-ai/dsh-subagent`, and `@deepseek-ai/dsh-scope` peer/dev dependencies required by the source imports, and verify the source/lib boundary.
- [x] Add complete public JSDoc to the Jobs Service Definition and implementation: exact Agent-object identity, `running`/`stopping` only, terminal `reported` exclusion, return value, and no same-SessionId replacement match.
- [x] Keep the Jobs provider optional through `ctx.get('jobs')`.
- [x] Count only exact-owner `running`/`stopping` Jobs; terminal Jobs do not block Goal Rounds.
- [x] Register `onJobsChanged` through `ctx.inject(['jobs'], jobsCtx => ...)` in the driver-owned child injection; ignore `owner === undefined` and other owners, and do not create an observer when the optional provider is absent.

### 1.2 Continuable-subagent observation

- [x] Add a public synchronous read-only `hasPendingContinuations(parent: Agent)` query to `packages/subagent/subagent/src/index.ts` and its continuation manager; define it as exact-parent direct-child live Activation only, with managerless, cold-persisted, and exact-parent-replacement behavior documented.
- [x] Have the goal driver listen to `subagent/start`/`subagent/end` only to request reevaluation, using an ordinary function and `carrierKeyOf(this)`; test Activation removal before settlement/end, parent ownership release after end, and one-shot lifecycle noise.
- [x] Dispose all listeners and pending drive work during Agent disposal, driver disposal, manager teardown, and any later manual reload; define provider-missing and query-error behavior without converting errors into no work.

### 1.3 Admission and races

- [x] Add the background gate before creating a reservation.
- [x] Recheck the same gate during `agent/pre-step` reservation validation.
- [x] If background work appears between checks, use the existing stale path without blocking the goal, counting a Round, or requesting the model.
- [ ] Cover completion-before-notice ordering and no direct observer model call; test running, stopping even when `reported` is true, terminal `reported: false`, terminal `reported: true`, unowned work, other-owner work, same-SessionId replacement, reservation-to-pre-step work, continuable start/end, settlement-before-end, one-shot lifecycle noise, cold persisted child, and goal-only compositions without Jobs/subagent providers.

## Phase 2: implement B's external plugin

### 2.1 External package

- [x] Create `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance\package.json`.
- [x] Create `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance\index.mjs` exporting `name`, `inject`, and `apply`.
- [x] Create the external plugin README covering triggers, message source, profile mounting, and limitations.
- [x] Limit the plugin to the exact live main-session check (`ctx.agents.get(agent.id) === agent` and `agent.session.header.parentSession === undefined`) and derive direct-human input from the current turn record; add a child-session regression whose initial prompt has `source.kind === 'user'`.

### 2.2 Dynamic guidance

- [x] Follow `packages/context/time-context/src/index.ts` and register an effect-owned `agent/pre-step` listener.
- [x] Implement no-goal, paused, blocked, and active + disarmed text; do not append for active + armed or complete in the first version.
- [x] Append one `dsh-goal-guidance` plugin `UserMessage` with `form: 'snapshot'`, deduplicated per turn.
- [x] Do not mutate goals, create a separate turn, or append guidance for a background-result/plugin-notice-only step; test proposed-message scanning and exact source fields.

## Phase 3: profile and artifact composition

- [x] Add the external plugin `link:` dependency to `C:\Users\HJ\.dsh\profiles\web\package.json`.
- [x] Insert one `goal-guidance` row into `C:\Users\HJ\.dsh\profiles\web\cordis.patch.yml`.
- [x] Keep the current Web-profile `hmr` row disabled; do not add HMR roots in this change, and record manual activation/reload without restarting the protected DSH Web Node process.
- [x] When dependencies change, run `pnpm install` in the Web profile and update its `pnpm-lock.yaml` so the lockfile and resolver links agree with the patch.
- [x] Run `dsh --profile web --dump-config` and confirm one built-in driver and one external guidance implementation.

## Phase 4: tests and model-visible output

- [ ] Extend `packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` real Loop harness for Jobs and continuable subagents.
- [ ] Add regressions for running/stopping Jobs, terminal Jobs not blocking, exact-owner replacement, continuable activity, settlement-before-end ordering, and completion notice delivery.
- [x] Add the reservation-to-pre-step background-work race regression.
- [ ] Test the external plugin through a real Loader composition, including missing goal service/projection failure, main-session filtering, continuable child initial prompts, plugin notices, background results, rejection, cancellation, duplicate inputs, and disposal.
- [ ] Update `apps/cli/tests/profiles/acp/tests/goal.expected.e2e.ts` and its artifacts for A's shipped-profile background wait/no-extra-Round/after-delivery behavior.
- [ ] Use the headless goal snapshot fixture for A only when it mounts Jobs and continuable-subagent providers; add the mandatory Web-owned scenario `apps/web/tests/goal-guidance.e2e.ts` and owner-local `snapshots/web/goal-guidance/` artifacts for B.
- [ ] Assert that A/B add runtime queries and ordinary plugin `UserMessage` records only; they do not add `SessionEventMap` members or Agent Loop protocol changes, so TypeScript/Python SDK expected outputs remain unchanged unless that boundary changes.

## Phase 5: documentation and acceptance

- [x] Update `packages/goal/goal-round-driver/README.md` and `README.zh.md` with the background-wait gate.
- [x] Update the Jobs and Subagent package READMEs with the new public query contracts and terminal/continuable semantics.
- [x] After source JSDoc changes, regenerate the Cordis API catalog and subsystem projections; never hand-edit generated API/type-equivalent fragments.
- [x] Update the existing implemented Same-session goal-round driver Agent Note and its Chinese counterpart with the shipped background-work decision; refresh its pairing record.
- [ ] Run focused tests, snapshot replay, Web-owner snapshot checks, and `dsh --profile web --dump-config`.
- [ ] Run `pnpm run test:docs`, `pnpm run doc-sync`, and `git diff --check`.
- [ ] Record commands, results, unresolved questions, and the manual-reload requirement; keep `status.yaml` `proposed` or `in-progress` until complete.

## Delivery order

1. Implement and verify B's external plugin before A, so the independent model-guidance path is validated without changing the built-in driver.
2. Implement and verify A after B, then refresh shared package documentation and generated catalogs.
3. Keep the change `in-progress` until the remaining Loader, snapshot, and repository-gate evidence is available; do not archive an unfinished or unevidenced change.
