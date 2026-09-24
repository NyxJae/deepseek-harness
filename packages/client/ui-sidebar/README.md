---
description: "Sidebar shell plugin for the dsh web client: brand collapse, separate New Session action, desktop rail, narrow-screen drawer, and bottom-pinned Settings seat."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-sidebar

English | [中文](README.zh.md)

## Summary

The dsh web sidebar identifies the build, browses Workspaces and Sessions, opens Settings, and creates New Sessions with the available Workspace. Desktop navigation collapses to a 56px rail. Below 1024px, a trigger opens a fixed drawer over the main view while the sidebar grid track stays at zero. The Settings entry stays bottom-pinned, and idle scrollbars do not move rows. Deployments can replace the brand mark and name.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The sidebar is the navigation shell: users see the brand, browse Workspaces and Sessions, start new sessions, and reach Settings. Feature plugins fill its seats — ui-workspace fills `sidebar.workspaces`, ui-settings registers the trigger row and settings panel at `sidebar.settings`.

### Brand and New Session

The expanded brand row renders `sidebar.brand.mark` and `sidebar.brand.name` as independent single slots; the collapsed desktop rail reuses the mark slot. Without occupants, the shell uses the fish mark and a localized local-build label. A complete build stacks a code badge below the label as `version[-commit][-dirty]`, using `DSH_CLIENT_VERSION`, the optional 7-character `DSH_CLIENT_COMMIT_HASH`, and `DSH_CLIENT_GIT_DIRTY=true`; missing version metadata omits the badge. Outside macOS, the expanded brand button collapses the sidebar. On macOS, the logo row remains a window-drag surface. The separate New Session control targets the explicit Workspace used by a scoped action, otherwise the current Session's Workspace, otherwise the most recently active Workspace; when none exists it clears into the blank New Session page.

### Global panel entries

Plugins add an icon component to the root-scoped `sidebar.panellist` list with an `id`, optional `order`, and a string or locale-aware `label`. The same id addresses the component registered in the layout's root-scoped `main` keyed slot; selecting a missing main entry throws without changing the current selection. The label supplies plain visible text, the accessible name, and the collapsed tooltip. Each row reads its own selected state through `usePanelInfo`; moving DOM focus to search or a directory picker does not change the displayed panel or its selected row. With no registrations, neither the list nor spacing for it is rendered. The shipped composition registers no example panel.

### Collapse behavior

The top expand button hosts the optional, non-interactive `sidebar.toggle.badge` slot while collapsed. Its occupant supplies status and tooltip content without adding another action or changing the button's navigation behavior.

On desktop, a live collapse fades the expanded content at its current width and moves the upper controls into the 56px rail on the same transition. A page that starts collapsed renders the rail statically, and reduced-motion mode disables both transitions. Below 1024px, the sidebar grid track stays at zero in both states. Opening the drawer moves focus into it; an Escape not consumed by a nested overlay, or a backdrop click, closes it and restores focus to the trigger. The bottom-pinned `sidebar.settings` control shares the desktop fade timing but has no horizontal translation.

On Windows Electron, `html[data-windows-titlebar]` fixes the sidebar toggle in the caption's top-left corner in both states, aligned with New Session's left edge only when expanded. The expanded brand sits below the caption and above New Session, with 8px of extra space above that button. Collapsing hides the brand and sidebar content and places New Session between the sidebar toggle and the Desktop-owned menus. The sidebar sets the root `--dsh-windows-menu-start` to 84px when collapsed; the Desktop preload uses it to position its menu after New Session and defaults to 48px when expanded. Caption icon buttons use centered 16px glyphs in 28px circular controls and exclude themselves from the window drag region. The sidebar toggle and New Session bubbles open below the caption, where the Desktop-owned menu text cannot cover them; an occupying `sidebar.toggle.badge` chooses its own bubble side.

### macOS desktop

Under `html[data-platform='darwin']` (set only by the desktop preload), the expanded column has a 52px top strip that clears the hiddenInset traffic lights and carries the collapse toggle. The frame's drag band (`ui-layout` `.leadingBand`) covers the strip, and the logo row below extends that drag surface; the separate New Session button starts sessions. A collapsed wide column is hidden rather than rendered as a rail. The package registers `HeaderLeadingControls` into the frame's `shell.leading` window-chrome seat; the frame mounts its open-sidebar and New Session controls beside the traffic lights only while a wide column is hidden. Narrow frames use the SidebarRoot drawer trigger. Rationale and the window-integration contract: the [macOS hidden-titlebar Agent Note](../../../.agents/notes/implemented/feature/2026-09-13-macos-hidden-titlebar-vibrancy.md).

### Scrollbars

Scrollbars in the column are a pointer affordance: the shell rebinds the scrollbar indirection to `transparent` whenever the pointer is outside the column and keeps the thumb drawn for 2s after the pointer leaves, so a list nobody is pointing at carries no bar. The reservation that keeps rows from moving belongs to the scrolling region (ui-workspace), so revealing a thumb never reflows.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The shell is pure composition: `SidebarRootComponentProps` composes the layout owner share, the global `useSessions` and `useWorkspaces` hooks, the declared brand, the `sidebar.workspaces` and `sidebar.settings` child slots, and injected navigation callbacks. Panel entries and their optional titles use the same composition path. Panel metadata is derived from list registrations and locale changes; selection belongs to the layout store.

### Slot discipline

Declaration-aware `slots.inject()` lets a replacing package activate before or after the sidebar. The foot is the `sidebar.settings` seat: the sidebar renders only the bottom-pinned layout slot and shares its column state (`wide`). The `/client` exports are the plugin body (`apply`/`inject`) plus the contract types only; SidebarRoot, the row components, and the tree derivation remain package-internal behind the slot registration.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

These pages cover the surfaces that fill the shell's seats and the composition model.

- [ui-workspace](../ui-workspace/README.md) — the Workspace and Session browser rendered into `sidebar.workspaces`.
- [ui-settings](../ui-settings/README.md) — the settings domain base registering the trigger row at `sidebar.settings`.
- [ui-layout](../ui-layout/README.md) — the layout owner whose rail and column state the collapse uses.
- [ui-theme](../ui-theme/README.md) — the scrollbar token indirection the shell rebinds.
- [Slot system standard](../../../.agents/notes/implemented/architecture/2026-07-22-slot-type-chain-implementation.md) — the composition model behind the seats.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side UI plugin layer that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define what the shell owns versus what its occupants own; they are current package constraints.

- **Session state-dot rendering is owned by ui-workspace** — no done/error notification sources are available to this shell.
- **Workspace browser behavior is composition-owned** — grouping, ordering, search, and row state belong to ui-workspace, not this shell.
- **"New task completed" unread marking is local viewing state** — completion-time > last-seen never reaches the host.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. Panel metadata is a read-only presentation projection of the Slot registry and locale, with no independent write API. The registry owns entry identity and disposal; this package's assembly tests assert the projection after registration and locale notifications settle. The shell owns no separate navigation state to reconcile with those sources.
