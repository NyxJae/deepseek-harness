# Agent Note: Settings modal keyboard focus ownership

Status: implemented

English | [中文](2026-08-26-settings-modal-keyboard-focus.zh.md)

## Problem

The Settings dialog exposed `aria-modal="true"` while focus could remain in the conversation or move to controls outside the dialog. Its selector menus opened without moving focus to an option, so keyboard users could not reliably inspect or choose a setting with the arrow keys.

## Decision

`SettingsRoot` retains the Settings trigger ref and restores focus to it after every panel close. `SettingsPanel` focuses its close control when mounted, traps Tab and Shift+Tab within the visible dialog controls, and handles Escape in the capture phase so a nested menu or dialog owns its own dismissal first. Nested menu and dialog targets are excluded from the parent handler.

The shared `Menu` primitive records the opener, focuses the selected or first enabled menu item when opened, and supports ArrowUp, ArrowDown, Home, and End while skipping disabled items. Escape and Tab close the menu and restore focus to its opener; native button activation continues to perform selection.

## Alternatives considered

**Leave focus behavior to the browser's document order.** Rejected because an `aria-modal` dialog must keep keyboard interaction inside the active task and return the user to its opener.

**Add keyboard handlers separately to each Settings selector.** Rejected because all selectors use the shared `Menu` primitive and would otherwise duplicate focus, navigation, and restoration rules.

**Use a new focus-management dependency.** Rejected because the existing React and DOM primitives cover this bounded modal/menu behavior without adding a runtime dependency.

## Consequences

Settings retains the existing slot contract and overlay structure while keyboard focus follows the active modal layer. Menu consumers gain one consistent keyboard path across Settings and other selectors. A nested menu or dialog must stop its own Escape event before the parent overlay responds; callers that render a custom overlay outside these roles must provide equivalent ownership.
