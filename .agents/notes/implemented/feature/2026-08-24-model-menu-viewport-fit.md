# Agent Note: Model menu stays inside the viewport

Status: implemented

English | [中文](2026-08-24-model-menu-viewport-fit.zh.md)

## Problem

The composer model trigger can sit well inside the viewport rather than at its right edge. An absolutely positioned menu aligned to the trigger wrapper therefore used the wrapper's right edge as its card edge; on a 320px frame the 250px root menu started at x=-49 and was clipped by the viewport.

## Decision

`ModelSelect` renders its open menu as a fixed viewport surface. After the menu paints, it measures the trigger and menu rectangles, clamps the horizontal position to a 12px viewport margin, prefers the space above the trigger, and falls below it when the upper position does not fit. Resize and capture-phase scroll listeners recompute the position while the menu is open. The menu remains in the component subtree, so outside-click and keyboard ownership do not change.

## Alternatives considered

**Increase the wrapper width or align the menu to the composer edge.** Rejected because the composer trigger's layout position varies by mode and available controls; changing the wrapper would alter the input row instead of solving the popup placement.

**Use a fixed mobile-only CSS offset.** Rejected because the overflow depends on the measured trigger position and menu pane width, and the same issue can occur in an intermediate viewport or after a resize.

## Consequences

The two-level model and effort panes keep their existing content, keyboard behavior, and width caps. Their fixed surface is now independent of ancestor clipping and remains at least 12px from each viewport edge; tall panes continue to use the existing internal scroll cap.

## Testing

The model-selection component suite covers the two-level interactions, rejection handling, and a 320px geometry case where the trigger is offset right and the menu must resolve to x=12. The client watcher rebuilds the affected bundle, and the assembled Web GUI can verify the same rectangle against the live menu.
