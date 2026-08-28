# Agent Note: Mobile sidebar uses an overlay drawer

Status: implemented

English | [中文](2026-08-24-mobile-sidebar-drawer.zh.md)

## Problem

The narrow AppFrame previously reserved the desktop sidebar's 56px rail, leaving the conversation surface permanently inset on phone-sized frames. The rail also exposed navigation controls that compete with the conversation's limited width.

## Decision

`AppFrame` selects overlay mode below `SIDEBAR_AUTO_COLLAPSE`. `computeColumns()` resolves the sidebar to zero grid width in that mode, so the conversation and details tracks use the full frame. The `sidebar` owner share carries `mobile`, and passes zero width while closed or the clamped preferred drawer width while open.

`SidebarRoot` keeps its child slots mounted in the closed state, renders a 44px branded trigger at the safe-area-aware top-left, and renders the open state as a fixed drawer above the conversation. The expanded brand row closes the drawer or desktop sidebar; the separate New Session row starts a Session. A fixed backdrop closes the mobile drawer on click, and Escape closes it from the keyboard. Opening from the trigger focuses the first enabled drawer control; an initial or responsive mobile-open state preserves the document's current focus because it has no opener; every close returns focus to the visible trigger before the drawer subtree becomes hidden. The desktop 56px rail and desktop resize behavior remain unchanged. The conversation header reserves the trigger's left-side footprint on narrow frames.


## Alternatives considered

**Keep the 56px mobile rail.** Rejected because it permanently removes usable conversation width and leaves several controls visible when the requested mobile affordance is one icon.

**Shift the conversation when the mobile sidebar opens.** Rejected because the selected behavior is a drawer above the content; opening the navigation must not change the conversation's width or scroll geometry.

**Render a generic trigger in AppFrame.** Rejected because the brand mark is a sidebar-owned slot and deployments may replace it; the sidebar shell must render the trigger from the same mark slot as its desktop identity.

## Consequences

The closed mobile conversation uses the full frame width. Opening navigation adds a drawer and backdrop without changing the conversation track, and the drawer has no resize handle. The sidebar browser entry stays mounted while closed, so its local query and browsing state survive the drawer toggle; wide-only chrome may still unmount according to the existing shell transition. Focus moves into the drawer on open and back to its trigger on close. The drawer is capped at the viewport width minus 24px and includes safe-area padding.

## Testing

The layout solver, AppFrame owner contract, SidebarRoot drawer behavior, desktop/mobile brand actions, focus restoration, CSS geometry, pointer scrollbar behavior, and conversation header spacing are covered by the focused client test set. The sidebar and conversation client bundles are rebuilt as part of the repository build.
