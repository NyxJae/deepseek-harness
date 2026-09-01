# Goal background-aware continuation and external guidance verification record

English | [中文](verification.zh.md)

Status: `in-progress` (A and B implemented; focused verification passed; full acceptance pending)

Requirements: [`requirements.md`](requirements.md)

Design: [`design.md`](design.md)

Tasks: [`tasks.md`](tasks.md)

## Completed research evidence

| Item | Evidence | Conclusion |
|---|---|---|
| Web profile composition | `dsh --profile web --dump-config` | The shipped Web bundle includes `goal` and `goal-round-driver`; the user profile now has one `dsh-goal-guidance` dependency and `goal-guidance` patch row, the external directory contains the implementation, and the `hmr` row is disabled. |
| Background Job state | `packages/jobs/jobs/src/types.ts`, `packages/jobs/jobs/src/index.ts`, `packages/jobs/jobs-local/src/index.ts` | Owner, `running`/`stopping`, terminal `reported`, and `onJobsChanged()` remain the lifecycle facts; `hasActive(owner)` now reports exact-owner live work only, and terminal Jobs do not count. |
| Continuable subagents | `packages/subagent/subagent/src/lifecycle.ts`, `src/continuation.ts`, and continuation tests | Parent-scoped `subagent/start`/`subagent/end` exist; settlement notification precedes `subagent/end`; `hasPendingContinuations(parent)` now reports exact-parent direct-child live Activation only. |
| Dynamic context injection | `packages/context/time-context/src/index.ts` | `agent/pre-step` appends a source-attributed durable `UserMessage` after downstream admission. |
| Current worktree | `git status --short --branch` | User changes exist; this change has not overwritten them. |

## Current implementation status

- The built-in source now includes the background-work gate; external B remains implemented.
- The external plugin directory and entry exist; the Web profile dependency, patch row, and lockfile are updated.
- `pnpm install`, `pnpm run gen-cordis-catalog`, the four-package focused Vitest run (226 tests), the external `node --check`/import/smoke checks, and `dsh --profile web --dump-config` passed; no protected Web Node process was restarted.
- Real Loader behavior, model-visible Web snapshots, completion-notice ordering, broad cross-owner/cold-child coverage, and full repository gates remain pending; the full gates were intentionally not run.
## Executed focused verification

- `pnpm install` — exit 0; workspace dependencies and lockfile were synchronized; no Node process restart.
- `pnpm run gen-cordis-catalog` — exit 0; 97 artifacts computed, 5 generated files written, 2 pair records refreshed.
- `pnpm exec vitest run packages/jobs/jobs/tests/service.spec.ts packages/jobs/jobs-local/tests/jobs.spec.ts packages/subagent/subagent/tests/continuation.spec.ts packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` — exit 0; 4 files and 226 tests passed.
- External plugin checks — `node --check index.mjs`, direct ESM import, and `C:\Users\HJ\.dsh\.temp\goal-guidance-smoke.mjs` all passed earlier; profile `pnpm install` and `pnpm dsh --profile web --dump-config` also exited 0.
- No protected DSH Web Node process was stopped or restarted; HMR remains disabled and activation requires a user-owned reload/restart.
## Pending acceptance

### A: automatic continuation

- [x] Existing Goal Rounds remain unchanged when no background work exists.
- [x] An exact-owner Job in `running`/`stopping` prevents a new Goal Round, including `stopping` with `reported: true`; a same-SessionId replacement does not match the older owner.
- [ ] A terminal owner Job does not block for either `reported: false` or `reported: true`; when `onJobsChanged` precedes the completion notice, the final admission remains stale without a model request, Round increment, or blocker, and the notice follows the existing delivery path.
- [ ] A true `hasPendingContinuations` result covers only an exact-parent direct-child live Activation; a cold persisted child does not block, Activation removal precedes settlement/end, and settlement retains the existing delivery order.
- [x] Background work appearing after reservation and before pre-step is discarded safely without blocking, counting, or requesting the model.
- [ ] Other-owner and unowned work does not block or create a cross-Agent evaluation.
- [x] Agent/driver teardown leaves no listener, reservation, or later round.

### B: external guidance

- [x] A direct-human request with no goal appends one creation guidance message.
- [x] Paused, blocked, and active + disarmed states append the correct resume guidance.
- [x] Active + armed, complete, plugin-notice, and background-result-only steps append nothing.
- [x] The same turn does not duplicate guidance; rejection, cancellation, and disposal append nothing.
- [ ] Message source, durable record, and replay output are stable.
- [ ] Unloading the external plugin stops guidance without changing the built-in goal/tool packages.
- [ ] A continuable child with a `source.kind === 'user'` initial prompt receives no main-session guidance; complete + direct human input leaves `create_goal` available through the existing policy.

### Documentation and composition

- [x] `dsh --profile web --dump-config` shows the expected built-in driver and one external guidance implementation.
- [ ] Keyless session snapshots prove that waiting for background work adds no extra Goal Round and that B's Web-owned scenario records guidance source, deduplication, notification-only omission, and state branches.
- [ ] `pnpm run test:docs` passes.
- [ ] `pnpm run doc-sync` passes.
- [ ] `git diff --check` passes, and the final record states that HMR remains disabled and activation requires manual user-owned reload.

## Post-implementation record format

For each executed command, record the exact command, exit result, profile/artifact paths, and whether a restart occurred. Leave failed, skipped, or user-owned steps unchecked rather than describing them as passing.
