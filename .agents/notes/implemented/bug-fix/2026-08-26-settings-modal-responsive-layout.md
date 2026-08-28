# Agent Note: Settings modal responsive layout

Status: implemented

English | [中文](2026-08-26-settings-modal-responsive-layout.zh.md)

## Problem

The Settings dialog used a fixed 188px navigation rail beside a content column. At narrow viewport widths, the remaining column was too small for preference descriptions, provider actions, and model controls. Flex items compressed Chinese text to one character per line and allowed action labels to wrap or overlap.

## Decision

`@deepseek-ai/dsh-client-ui-settings-general` renders one shared header for the title, optional document action, and close control. The desktop panel keeps a 188px navigation rail and a scrollable content column. At widths up to 640px, the panel uses the full available safe-area width, moves navigation below the header into a horizontally scrollable row, and gives the content column the remaining height.

Feature-owned preference rows keep their desktop layout above the breakpoint. On narrow panels they stack the description and selector, remove the desktop-only text inset, and keep selector labels on one line. Appearance choices wrap into usable columns.

Models settings keep provider identity and actions together, prevent button labels from wrapping, and stack model fields before their icon actions on narrow panels. Plugin tabs and agent-preset cards use the same width-constrained, scrollable or single-column behavior.

The breakpoint is implemented in the owning CSS Modules. The layout does not add a viewport store, change settings state ownership, or alter the settings slot contract.

## Alternatives considered

**Keep the desktop rail and shrink it on mobile.** Rejected because the rail would continue to consume space needed by descriptions and provider controls, leaving the same failure at smaller widths.

**Allow every preference row to remain horizontal and only add `overflow-wrap`.** Rejected because the selector and action controls would still compete with the text, and wrapping control labels makes them harder to scan and activate.

**Create a separate mobile settings route.** Rejected because it would duplicate the slot projection, close behavior, and section lifecycle for a presentation-only difference.

## Consequences

Desktop settings retain the existing navigation rail, shared settings sections, and scroll ownership. Narrow settings expose all sections through a top navigation row; a long section list scrolls horizontally without widening the dialog. Feature rows become taller on mobile, so the options column remains the only vertical scrollport. No runtime or wire changes are required.
