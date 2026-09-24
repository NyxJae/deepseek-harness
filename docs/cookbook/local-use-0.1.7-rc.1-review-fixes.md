# local-use 0.1.7-rc.1 integration verification

English | [中文](local-use-0.1.7-rc.1-review-fixes.zh.md)

This cookbook verifies the DSH 0.1.7-rc.1 integration worktree for `local-use`. Use current RC1 source to determine package and API ownership; the [dsh-plugin-development Skill](../../.agents/skills/dsh-plugin-development/references/local-use-upstream-integration.md) owns the general upstream-sync procedure.

## Starting point

1. In the project's `.worktree/local-use-0.1.7-rc.1-integration`, inspect `git status --short --branch` and the upstream refs. Preserve the user's changes in the root `local-use` checkout. The user manages Web ports `3079`/`3080`; tests use an isolated profile and assigned port.
2. Take the official RC1 source as authority for current package and API ownership. Local Markdown images use the official resolver; `ui-primitives/ImageLightbox` owns original-image preview. Goal uses the current Jobs query and event APIs.

## Behavior and ownership

1. The mobile drawer listens for Escape on `document`, Settings listens on `window`, and Menu consumes the key in its own listener. The browser may run microtasks between those native listener stages. Sidebar reads `event.defaultPrevented` in the next task, closes the drawer only if the key remains unconsumed, and cancels pending timers on unmount. Focus enters the drawer and returns to the trigger when it closes. See the [Sidebar README](../../packages/client/ui-sidebar/README.md) for the behavior owner.
2. `apps/web/tests/expected/file-upload-round/image-preview.expected.md` records the stable ARIA output for the Trajectory preview at 125% zoom; `snapshots/web/file-upload-round/session.v3.jsonl` remains the committed replay input. Generate the golden through the complete `file-upload-round.e2e.ts` scenario and review its content.
3. `computeColumns(viewport, sidebar, rightbar, collapsedWidth)` keeps RC1's numeric fourth argument. `AppFrame` supplies the zero-track policy for mobile, macOS, and Windows title bars; the column solver computes widths only.
4. `SubagentRuntime.hasPendingContinuations(parent)` is a public Host query consumed across packages by Goal. It uses exact parent Agent identity and counts resident direct continuable children, not one-shot runs or cold Sessions. The existing README, unit tests, and generated catalog record that behavior.
5. The project's `dsh-plugin-development` Skill comes from seven committed files in `origin/local-use`. Root `AGENTS.md` retains the local rules for a complete build after syncing upstream and protected Web ports.

## Verification steps

1. Run `pnpm run build`, then `pnpm exec vitest run packages/client/ui-layout/tests/columns.client.spec.ts packages/client/ui-sidebar/tests/sidebar-root.client.spec.tsx`. Check default and zero-width tracks, unconsumed Escape, repeated keypresses, and timer cancellation on unmount.
2. With `DSH_SNAPSHOT=replay`, run the mobile overlay case in `apps/web/tests/settings-chrome.e2e.ts`: the first Escape closes only Settings, an open Menu consumes its own Escape, and subsequent presses close the drawer and restore trigger focus. Compare narrow-screen captures before and after closing Settings.
3. On supported Linux CI, run `apps/web/tests/file-upload-round.e2e.ts` and the complete `pnpm run test:web` under `DSH_SNAPSHOT=replay`. Confirm the new ARIA golden replays with the committed V3 Session. On Windows, the persisted Session may retain an escaped tool-argument path, causing the final comparison to fail after all eight browser assertions pass; symlink creation may also return `EPERM`. Keep the original failures and use the Linux gate for these cross-platform results.
4. Run `pnpm run test:gui`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run doc-sync`, and `git diff --check` against the final diff. Record platform-specific failures without changing product security settings to make the checks pass.
5. Review the worktree and final diff. Obtain user approval separately for every commit and push. After review, the Linux gates, ancestry, and the root worktree state are verified, the user decides whether to fast-forward `local-use` to the integrated result.
