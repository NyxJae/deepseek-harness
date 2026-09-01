# Agent Note: Integrate local-use onto upstream alpha.2

Status: proposed

English | [中文](2026-08-31-local-use-upstream-alpha2-integration.zh.md)

## Problem

The official `upstream/master` and local `master` point to `0a53fb55bea101816fa226bb964ae2bed71c343b` (`dsh-v0.1.2-alpha.2`). The self-use branch `local-use` points to `1db349583f7f73f4e0dbaa3aeb61a258d510d6c0`, has two local commits after the alpha.1 common ancestor `cd5ef8148158c3a752a658978873241fdf8e2bbc`, and is 234 official commits behind the new base.

The official update changes the Session Remote error/result model, Client session behavior, agent-preset roster, settings content, connection recovery presentation, package versions, generated Typert output, and expected Web output. A mechanical merge would combine obsolete local interfaces with the new architecture and would restore the deleted General-settings `AgentPresetRow`. The simulated merge already reports architectural conflicts in Session Controller Client files, test fakes, settings layout, settings expected output, and the deleted preset row.

The local branch also contains independent capabilities that official alpha.2 does not replace: durable local Markdown images, the enhanced image lightbox, the mobile sidebar drawer, responsive settings layout, keyboard focus ownership, and viewport-safe model selection. These behaviors need selective migration rather than whole-commit replay. The current working tree has an unrelated modification in `.agents/skills/dsh-plugin-development/evals/evals.json`, and `backup/local-use` still points to `f4da3d7ac513cd11a8ccdb6b35f1e7d13dacfa4c`; the integration must not alter or accidentally publish that working-tree change.

## Proposal

Implementation starts only after direct user approval. The integration uses official alpha.2 as the source tree and first-parent history, treats the existing `local-use` commits as a read-only source of desired behavior, and manually ports only the accepted capabilities. It does not merge conflicted hunks mechanically and does not restore a local implementation when the official implementation already provides the required behavior.

### Completion objective

1. Produce a reviewed integration head whose first-parent base is the latest approved `upstream/master` and whose tree contains the accepted local-use capabilities on official APIs and product structure.
2. Preserve durable local Markdown images, the shared image lightbox improvements, mobile sidebar overlay behavior, responsive settings behavior, missing keyboard-focus behavior, and viewport-safe model-menu placement.
3. Keep official `RemoteError` / `RemoteResult`, current Client session behavior, agent-preset roster, settings content, connection recovery indicator, package versions, dependency decisions, and generated-file ownership authoritative.
4. Do not restore `AgentPresetRow` or another duplicate General-settings preset entry; only compatible responsive roster-card styling may move onto the official preset section.
5. Keep `.agents/skills/dsh-plugin-development/evals/evals.json` byte-identical to its pre-integration working-tree content and exclude it from every integration commit.
6. Complete focused tests, required keyless snapshots and SDK projections, built Web verification, authenticated GUI verification, and a fresh independent review before branch cutover.
7. Require a new user confirmation before every commit, ancestry merge, local branch cutover, or push; never push this self-use integration to `origin` unless a later request explicitly changes the target.

### Fixed baseline

| Fact | Planned value |
|---|---|
| Official source | `upstream/master` and `master` at `0a53fb55bea101816fa226bb964ae2bed71c343b` |
| Local behavior source | `local-use` at `1db349583f7f73f4e0dbaa3aeb61a258d510d6c0` |
| Common ancestor | `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| Divergence at planning time | 234 official commits and 2 local commits |
| Private backup state | `backup/local-use` at `f4da3d7ac513cd11a8ccdb6b35f1e7d13dacfa4c` |
| Protected working-tree change | `.agents/skills/dsh-plugin-development/evals/evals.json` |
| Integration worktree | `worktrees/local-use-upstream-alpha2/` |
| Integration branch | `integrate/local-use-upstream-alpha2` |

The execution preflight fetches `upstream` again and compares these values. If `upstream/master` has moved, implementation stops before creating code changes, updates this baseline and the conflict analysis, and asks the user to approve the revised target.

### Feature decisions

| Area | Decision | Authority and required result |
|---|---|---|
| Session Remote results and errors | Adopt official, then extend | Retain official `RemoteResult`, `RemoteError`, `isRemoteFailure()`, and domain-prefixed failure codes; add local-image behavior without `ClientResult`, legacy Typert failures, or old error names. |
| Durable local Markdown images | Retain and adapt | Preserve the behavior owned by [Local Markdown images in authenticated Web chat](../../implemented/feature/2026-08-29-web-local-markdown-images.md), ported onto current Session Controller and generated Remote APIs. |
| Image lightbox | Retain if official lacks equivalent behavior | Preserve zoom, pan, touch, keyboard, focus, scroll-lock, safe-area, and cleanup behavior through the current `ui-attachment` component structure. |
| Mobile sidebar drawer | Retain and adapt | Preserve [Mobile sidebar uses an overlay drawer](../../implemented/feature/2026-08-24-mobile-sidebar-drawer.md) without replacing official sidebar slots or desktop behavior. |
| Responsive settings layout | Retain missing behavior only | Use official settings DOM, labels, section roster, connection indicator, and content as the base; add only responsive layout that remains absent. |
| Dialog and menu focus | Retain missing behavior only | Keep official focus behavior where equivalent; add only the unresolved focus trap, nested-overlay Escape ownership, directional menu navigation, and opener restoration. |
| Model-menu viewport fit | Retain if still absent | Preserve [Model menu stays inside the viewport](../../implemented/feature/2026-08-24-model-menu-viewport-fit.md) on top of the official model-selection implementation. |
| General preset row | Drop | Accept the official deletion of `AgentPresetRow`; port compatible CSS only to the official `AgentPresetSection` and roster cards. |
| Versions, dependencies, lockfile, generated output | Adopt official, regenerate local additions | Never restore alpha.1 package versions or lockfile entries; add a dependency only when the retained implementation requires it and no official dependency already owns the function. |

### Worktree and history strategy

1. Record the current branch, ref values, `git status --short --branch`, and `git hash-object` for the modified eval file. Keep the existing checkout on `local-use`; do not stash, stage, reset, or edit its unrelated change.
2. Create `integrate/local-use-upstream-alpha2` from the verified `master` tip in `worktrees/local-use-upstream-alpha2/`. All product code, test, generated-output, and documentation work occurs in that worktree.
3. Inspect the two local commits and their complete diff from the common ancestor. Use them as source material only; do not cherry-pick either commit wholesale.
4. Port one functional unit at a time onto official files, preserving official names, package roles, event/error conventions, locale ownership, and generated-file ownership.
5. Before each commit, present the exact diff, proposed message, included paths, checks, and excluded eval file to the user. A general approval to implement does not authorize a later commit or push.
6. After all functional commits, documentation, verification, and independent review pass, propose a content-neutral ancestry merge with old `local-use` as the second parent. `git merge -s ours local-use` is used only to make the reviewed integration head a descendant of both official alpha.2 and the old local line; its first-parent tree must remain byte-identical and the user must approve that merge commit separately.
7. Verify the ancestry merge with an empty first-parent tree diff, two expected parents, `master` as an ancestor, and old `local-use` as an ancestor. This merge must not hide unresolved feature work or substitute for porting and tests.
8. Advance the local `local-use` ref only when the existing checkout can fast-forward without altering the eval change. If the official baseline changed that path or Git would overwrite it, stop and ask the user to preserve or commit the unrelated edit first. A future push to `backup/local-use` must be an ordinary fast-forward, separately approved and verified with `git ls-remote`; no raw or lease-protected force push is expected.

This strategy preserves official first-parent history and prior local ancestry without asking Git to combine obsolete local file contents. It remains consistent with [Native GitHub stacks and optional PR rebases](../../implemented/process/2026-08-02-native-github-stacks-and-optional-rebases.md); the integration is not a PR stack, and no GitHub object is created by this plan.

### Phase 0: preflight and port inventory

- Fetch `upstream --prune`, verify `master == upstream/master`, and rerun ancestry, divergence, `git cherry -v`, and `git merge-tree --write-tree` analysis. Record any changed conflict set before code work.
- Re-read root and package instructions, `docs/architecture.md`, `docs/testing.md`, the current alpha.2 package manifests, generated-file owners, and the implemented Agent Notes linked by this proposal from inside the integration worktree.
- Produce a port matrix for every file changed by the two local commits: `retain`, `adapt`, `drop`, or `already official`. Each retained row names its official destination, tests, snapshots, and documentation owner.
- Confirm that the integration worktree is clean, the source checkout still has only the known eval modification, and no HMR or protected-process action is needed for static implementation.

### Phase 1: responsive shell and mobile navigation

- Port the overlay layout through `packages/client/ui-layout/src/client/AppFrame.tsx` and `packages/client/ui-layout/src/client/columns.ts`, using official layout state and owner types.
- Port the drawer, backdrop, mobile trigger, Escape handling, focus entry/restoration, safe-area sizing, and desktop/mobile split through `packages/client/ui-sidebar/src/client/SidebarRoot.tsx` and its owned CSS.
- Update a conversation-header spacing owner only if the official alpha.2 header still overlaps the mobile trigger; do not add a new layout store or duplicate sidebar state.
- Update the focused layout/sidebar suites, including `columns.client.spec.ts`, `app-frame.client.spec.tsx`, `sidebar-root.client.spec.tsx`, and CSS behavior checks. Preserve desktop rail and resize behavior.

### Phase 2: settings, preset roster, and focus ownership

- Start from official `packages/client/ui-settings-general/src/client/SettingsRoot.tsx` and `SettingsRoot.module.css`. Preserve the official settings section order, labels, `ConnectionIndicator`, close behavior, and roster content before adding the narrow-screen title, horizontal section navigation, safe-area sizing, and single-column option layouts.
- Compare official dialog and menu keyboard behavior with the local implementation. Port only missing focus-on-open, modal Tab containment, nested dialog/menu Escape ownership, ArrowUp/ArrowDown/Home/End navigation, disabled-item skipping, and opener restoration into the current owner, including `packages/client/ui-primitives/src/Menu.tsx` when that primitive still owns the behavior.
- Accept the upstream deletion of `packages/client/ui-agent-preset/src/client/AgentPresetRow.module.css`. Do not re-create `AgentPresetRow` or the old General-settings entry. Adapt any still-useful responsive card rules to `AgentPresetSection.module.css` and official roster components.
- Update `settings-root.client.spec.tsx`, settings component tests, menu primitive tests, preset section tests, `apps/web/tests/settings-chrome.e2e.ts`, and the two affected settings expected-output files from official alpha.2 content.

### Phase 3: model menu and shared image viewer

- Compare the official `ModelSelect` positioning behavior before porting. If viewport clamping is still absent, add measured fixed placement, above/below selection, resize handling, and capture-phase scroll updates in `packages/client/ui-model-selection/src/client/ModelSelect.tsx` and its CSS without changing model catalog or selection state.
- Port the shared lightbox through `packages/client/ui-attachment/src/ImageLightbox.tsx`, its owned CSS, and `MessageImages.tsx`. Keep URL ownership with the existing attachment/session cache and avoid a second preview store.
- Preserve pointer-centered wheel zoom, bounded pan, pinch and single-pointer gestures, double-click zoom, keyboard controls, focus trap/restoration, background scroll locking, resize reset/clamping, safe-area controls, and cleanup.
- Update `model-select.client.spec.tsx`, `image-lightbox.client.spec.tsx`, and `message-image.client.spec.tsx`, including geometry, keyboard, pointer, touch, resize, and disposal cases.

### Phase 4: Host and Session protocol for local Markdown images

- Port `packages/api/session-controller/src/markdown-images.ts` as a Session-owned resolver that validates the recorded assistant occurrence before filesystem access, reads through `ctx.fs`, saves through the attachment service, appends one durable `assistant/markdown-image` mapping, and remains idempotent and single-flight per occurrence.
- Extend `types.ts`, `index.ts`, `commands.ts`, and `invariant.ts` with the mapping event, request/value types, configuration, Remote method, event-specific attachment authorization, and relational invariant. Keep `SESSION_FORMAT_VERSION` unchanged unless alpha.2's current event rules prove a structural format change is required.
- Adapt `src/client/contract/session.ts` and `src/client/sessions/session.ts` to official `RemoteResult` and `isRemoteFailure()` behavior. Do not reintroduce `ClientResult`, `RpcResponse`, `RemoteStreamError`, `RpcId`, `TypertRemoteFailure`, or old `attachment-error` codes.
- Use current official domain-prefixed error codes and `RemoteError` construction. Preserve `disabled` as the shipped default, `workspaces` as the narrow policy, and `host` only in the explicit local deployment profile; do not expose a public filesystem route or broaden Web authority checks.
- Follow current log-event and export JSDoc rules: `assistant/markdown-image` carries no `@mode`, `MarkdownImageOccurrence` has an export contract, and `extractMarkdownImages` documents its `text` parameter and return value.
- Regenerate current Typert Remote artifacts through their owning generator rather than hand-editing generated files. Adapt `tests/fake-api.client.ts` and `tests/test-remote.ts` to the official generated protocol.
- Port and update `markdown-images.host.spec.ts`, `markdown-images-resolver.host.spec.ts`, `commands-queue-attachment.host.spec.ts`, Client contract tests, invariant tests, and transport tests for official failure values, replay, authorization, concurrency, cancellation, and disposal.

### Phase 5: Client projection and Markdown rendering

- Extend `packages/client/ui-chat/src/client/conversation-nodes/assistant.ts` to project durable mappings from Session events and `AssistantMarkdown.tsx` to resolve only finalized local image occurrences with localized loading, retry, and failure states.
- Extend `packages/client/ui-primitives/src/markdown/render.tsx` and `MarkdownText.tsx` with a Cordis-free occurrence resolver and document-order indexing. Remote HTTP(S) images must retain direct rendering, streaming local images must remain inert fallback text, and surrounding Markdown must remain in the same AST render pass.
- Route successful mappings through the existing historical attachment cache and `session.attachment` Blob URL path so refresh, reconnect, Session switching, and source-file deletion replay stored bytes.
- Update Markdown parser/render tests, Chat event-projection tests, Chat view tests, localization dictionaries, and attachment presentation tests. Add negative coverage for raw HTML, `data:` URLs, unsupported protocols/types, mismatched ordinals, and sibling-image partial failure.

### Phase 6: generated outputs, snapshots, and decision records

- Update the existing implemented Agent Notes that still own the retained behaviors when alpha.2 changes paths, types, verification, or deployment facts. Do not duplicate their rationale in this integration note.
- Keep this note under `proposed/process/` while work is incomplete. After the reviewed tree ships locally, rewrite it in present tense, replace proposal/acceptance sections with the implemented decision and consequences, move the complete triplet to `implemented/process/`, repair links, and re-record translation pairing.
- Regenerate affected Typert output, Cordis/config documentation, event producer-consumer references, and other derivatives only through their owners. Review every generated diff; do not carry alpha.1 package versions or stale lockfile resolutions into the integration.
- Classify `SessionResolveMarkdownImageRequest` and `SessionResolveMarkdownImageValue` under the current Cordis catalog type-link owner, then regenerate the Cordis catalog, Cordis inspect catalog, Client catalog, config catalog, and persistence catalog. These outputs are observably stale on the pre-integration `local-use` tree and must return to generated-owner consistency.
- Because `SessionEventMap` gains or reintroduces a durable event on the alpha.2 base, update the required TypeScript SDK and Python SDK expected projections in the same change and run their owning checks.
- Add or update a keyless recorded-session Web scenario that exercises the retained local-image presentation from a controlled workspace fixture. Update owner-local settings expected output for official roster/content plus the retained responsive behavior. Refresh expected artifacts only after reviewing the observed delta.

### Phase 7: local verification

The minimum focused unit set covers Session Controller Markdown resolution and attachment authorization; Chat projection and settled Markdown rendering; layout/sidebar columns and focus; settings/preset/menu behavior; model-menu geometry; and lightbox input, focus, resize, and cleanup. Test files are selected from the current alpha.2 tree after the port matrix is final, with the local suites named in the preceding phases as the initial set.

Run `pnpm run build:lib:host`, `pnpm run build:lib:client`, `pnpm run build:web`, and `pnpm run typecheck` after generated Remote and Client changes settle. Run the focused Vitest files during each phase, then the affected Web expected-output suite, the targeted keyless snapshot scenario, SDK projection checks, `pnpm run test:docs`, `pnpm run doc-sync`, `pnpm run lint`, and `git diff --check` once on the integrated diff.

The documentation-site symlink escape test must pass in an environment that can create test symlinks. A Windows `EPERM` from missing symlink privilege is recorded as an environment limitation and rerun on a capable host or CI; it does not authorize skipping the test or treating unrelated product changes as its fix.

Before any push, invoke `dsh-pre-push-checks` against the final outgoing diff to select any additional required checks. Do not default to repository-wide `test:coverage`, exhaustive platform runs, or `check:windows-wine`; add them only when the changed files, a failing focused test, or an explicit user request makes them necessary.

### Phase 8: built runtime and browser verification

- Verify whether `pnpm run dev:web` is already running from this checkout before relying on Client HMR. Do not start a replacement DSH server and do not stop or restart any Node process.
- Rebuild affected Host and Client artifacts. Refresh the existing GUI at `http://127.0.0.1:3079`; the Vite shell is not treated as a standalone replacement application.
- Host-side Session Controller changes require the protected DSH Web process to load new artifacts. Ask the user to restart it, then verify the existing URL, process profile, plugin composition, and resolved package paths. The goal remains incomplete until this runtime handoff occurs.
- Verify desktop and narrow layouts at representative widths, including 1440×900, 390×844, and 320×568. Check mobile sidebar geometry and focus, settings navigation and roster, model-menu viewport margins, nested menu/dialog keyboard ownership, and the image lightbox's keyboard, wheel, drag, pinch, scroll-lock, and focus lifecycle.
- Resolve a real local PNG/JPEG/WebP/GIF through authenticated Chat, refresh the Session, delete or rename the source, and verify replay still uses stored bytes. Verify one refused path or unsupported file shows a localized retryable failure while a successful sibling remains visible; verify HTTP(S) images remain browser-loaded.
- Save browser screenshots and the observable operation log as verification evidence outside product source. If a later request creates a PR with GUI changes, record the required GIF from the real reviewed server before creating that PR.

### Phase 9: independent review and correction

A fresh independent subagent reviews the complete diff after tests and browser evidence exist. The review checks the approved scope, official architecture preservation, event durability and attachment authorization, error-code migration, focus and gesture cleanup, locale ownership, generated-output ownership, obsolete preset-row absence, snapshot coverage, and unintended alpha.1 residue. A frontend design review checks the responsive and interaction evidence against the retained behavior.

Every blocking finding is fixed in its introducing functional unit and receives the narrow affected checks again. The final review report must state `PASS` with no unresolved blocker before branch cutover; a partial review, code-only self-report, or passing compilation is insufficient completion evidence.

### Proposed commit boundaries

| Unit | Intended content | Proposed message family |
|---|---|---|
| Responsive shell | Layout columns, mobile sidebar, settings responsive structure, official roster-compatible CSS, focused tests and owned notes | `feat(web): port responsive local-use shell refinements` |
| Interaction refinements | Menu/dialog focus behavior, model-menu viewport placement, image lightbox behavior, focused tests and owned notes | `feat(web): port local-use interaction refinements` |
| Durable local images | Session event/resolver/Remote API, Client projection/rendering, attachments, tests, snapshots, SDK projections, config/docs | `feat(web): port durable local Markdown images` |
| Integration record | Final current-state integration note, remaining generated/doc synchronization, verification record | `docs: record local-use alpha.2 integration` |
| Ancestry merge | Tree-neutral second-parent merge of the old local line after all prior units pass | `merge: retain prior local-use ancestry` |

These are review units, not pre-authorized commits. The exact split and messages are shown again with the final diff, and each `git commit` requires a new direct confirmation.

### Pause conditions

- `upstream/master` moves before implementation starts or introduces a different conflict set.
- A retained capability requires replacing an official alpha.2 architecture rather than extending its documented owner.
- The Session event change requires a format or migration decision beyond the existing fail-closed version-0 event policy.
- The protected Web process must restart, the existing GUI cannot load the new Host artifacts, or authenticated runtime evidence cannot be collected autonomously.
- Advancing the checked-out `local-use` branch would overwrite or reinterpret the unrelated eval modification.
- A required generator, snapshot, focused test, or independent review remains failing for a systemic reason that needs a broader design decision.

At any pause condition, preserve the clean integration worktree and evidence, report the exact blocker, and ask the user to choose between the viable next paths. Do not hide it with compatibility code, skipped verification, a force update, or a replacement server.

## Alternatives considered

**Merge `master` directly into the old `local-use` tree and resolve only reported conflicts.** Rejected because Git would also auto-merge many non-conflicting alpha.1 local hunks, including behavior that needs semantic comparison with official alpha.2. The resulting tree would require a complete audit anyway and would make obsolete local architecture harder to identify.

**Rebase or cherry-pick both local commits onto alpha.2.** Rejected because the commits combine independent UI and Session protocol changes and encode obsolete Client result types, error codes, settings DOM, preset entry points, and expected output. Whole-commit replay gives the wrong unit of review.

**Use official alpha.2 and drop all local behavior.** Rejected because official alpha.2 does not provide the deployment's durable local Markdown images or all retained mobile, focus, menu-placement, and image-inspection behavior.

**Restore the deleted General-settings preset row.** Rejected because official alpha.2 deliberately owns preset selection through the roster. A second General-settings entry would duplicate state presentation and preserve a deleted component model.

**Rewrite `local-use` to the integration head and force-push the private branch.** Rejected as the default because a content-neutral ancestry merge can preserve both histories and allow ordinary fast-forward publication. A history rewrite remains unnecessary unless later evidence invalidates that ancestry strategy and the user explicitly approves a revised plan.

## Acceptance criteria

- The final integration head has the approved official `master` tip and old `local-use` tip as ancestors, with official alpha.2 on the first-parent line and no unreviewed merge content.
- The final tree contains no restored `AgentPresetRow`, no duplicate preset control, no `ClientResult`/legacy Remote adapter, no stale alpha.1 package version, and no old attachment failure code introduced by the local port.
- Local Markdown images validate the recorded occurrence before filesystem access, use configured `disabled`/`workspaces`/`host` policy, persist a durable attachment mapping, authorize only the mapped attachment field, and replay stored bytes after source deletion without changing model-visible assistant text.
- Remote HTTP(S) images, streaming Markdown, unsupported inputs, partial sibling failures, retry, idempotency, concurrency, cancellation, and disposal retain the documented behavior.
- Mobile sidebar, responsive settings, official preset roster, model-menu placement, modal/menu keyboard behavior, and image lightbox interactions pass focused unit tests and built browser verification at desktop and narrow widths.
- Official connection recovery presentation, section content, locale ownership, package dependencies, generated-file ownership, and desktop behavior remain intact.
- Required keyless Web/session snapshots and both TypeScript and Python SDK projections cover the durable event and visible behavior; every expected-output change is reviewed against official alpha.2 content.
- Host and Client libraries, the Web bundle, typecheck, selected unit/Web/snapshot checks, documentation checks, lint, and `git diff --check` pass with recorded commands and outputs.
- The existing DSH GUI loads the reviewed built artifacts after the user-owned process restart, and authenticated local-image replay plus responsive interaction evidence is captured from `http://127.0.0.1:3079`.
- A fresh independent review reports `PASS` with no unresolved blocker, and any finding has matching correction evidence.
- `.agents/skills/dsh-plugin-development/evals/evals.json` has the same working-tree blob hash and diff before and after integration, is absent from integration commits, and is not included in a push.
- `git status`, change-scope output, and final diff contain only approved integration files and the separately preserved pre-existing eval modification.
- No commit, ancestry merge, local branch cutover, push, PR, Node-process restart, or replacement server occurs without its required user decision.
- If publication is later approved, only `backup/local-use` is updated by verified fast-forward unless the user explicitly chooses another remote and branch.

## Risks

The official branch can move while the work is planned or underway. Starting from a stale base would repeat conflict analysis and browser evidence, while silently replacing an in-progress base would discard a reviewable checkpoint. The preflight stops on movement; later movement is handled only after the current approved checkpoint and another user decision.

The local Markdown image event crosses Session durability, Remote generation, attachment authorization, Client projection, snapshots, and SDK projections. A narrow UI-only port could compile while breaking replay or external consumers, so the complete event path and both SDK expected outputs are mandatory.

Responsive and focus code can accidentally override official alpha.2 product changes that do not appear as textual conflicts. Each UI phase starts from official DOM and state ownership, compares behavior, and ports only a measured gap; stale snapshots are never treated as the product source of truth.

The `host` image policy intentionally grants an authenticated Web principal access to copy any readable supported image into a Session. The shipped default remains `disabled`, and `host` stays explicit to the local deployment. Broadening authority, adding a public file route, or relaxing browser authentication is outside this plan.

A tree-neutral ancestry merge is safe only after the desired tree already exists and passes review. Using it earlier would conceal missing local behavior. The merge therefore has its own approval, empty-tree-diff check, parent check, and ancestry check.

The protected DSH Web process cannot be restarted by the agent. Host integration can reach a tested and built state but cannot satisfy runtime acceptance until the user performs the restart; the goal pauses rather than claiming completion from source tests alone.
