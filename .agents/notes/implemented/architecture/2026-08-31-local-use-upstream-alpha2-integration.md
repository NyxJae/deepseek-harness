# Agent Note: Selective local-use integration on upstream alpha.2

Status: implemented

English | [中文](2026-08-31-local-use-upstream-alpha2-integration.zh.md)

## Problem

The local-use branch contains useful responsive UI and local Markdown image behavior, but its two commits were based on the pre-alpha.2 common ancestor. Applying those commits wholesale would reintroduce superseded Remote failure types, stale Session Controller contracts, removed preset components, and pre-alpha.2 settings ownership into the official architecture.

## Decision

The integration branch is rebuilt on official `upstream/master` at `dsh-v0.1.2-alpha.2`, and local-use behavior is ported by capability rather than by ancestry. The alpha.2 Session Controller, Typert protocol, preset roster, settings DOM, generated artifacts, and package versions remain authoritative.

The responsive Web changes extend the alpha.2 AppFrame, sidebar, menu, model-selection, settings, language, appearance, agent-preset, and conversation styles without recreating removed components or moving business state into presentation components. Mobile drawers and menus retain focus ownership, Escape handling, safe-area spacing, and the official separate New Session and collapse actions. The client composition follows [dynamic client render and attachment ownership](2026-08-17-dynamic-client-render-and-attachment-ownership.md).

The image presentation changes keep attachment ownership in the existing conversation slots. A single message image can render inline, and the document lightbox owns fit, bounded zoom, wheel and pointer gestures, touch pinch and pan, keyboard controls, focus trapping, opener restoration, and background scroll locking. Localized labels remain in the owning dictionaries. These additions extend the durable attachment behavior in [Web multimodal image input and durable attachments](../feature/2026-07-22-web-multimodal-image-input-and-durable-attachments.md) without changing its message-content rule.

Local Markdown images use an explicit Session Controller policy: `disabled` by default, `workspaces` for registered Workspace roots, or `host` for the active filesystem provider's supported readable images. The Host first proves that the requested message, text block, and Markdown occurrence exist, then reads and normalizes the file through `ctx.fs`, admits it through the attachment service, and appends an `assistant/markdown-image` mapping event. The mapping is log-only and does not alter model-visible assistant text or token accounting. Client Chat state folds the event, resolves settled occurrences through the authenticated attachment path, keeps disabled destinations as authored alt text without a Remote request, and keeps refused or failed enabled occurrences retryable. This is the local-file extension to the [remote Markdown image policy](../feature/2026-07-30-web-remote-markdown-images.md), which continues to own absolute HTTP(S) destinations.

The resolver and its client method use alpha.2 `RemoteError` and `RemoteResult` semantics. Idempotency, single-flight resolution, cancellation, disposal, workspace containment, media and size checks, and the relational invariant connecting the mapping to its earlier Assistant Markdown occurrence are owned by the Session Controller. Persistence, Cordis, Client, and documentation catalogs are regenerated from their source owners.

## Alternatives considered

**Merge the local-use commits directly.** This would preserve ancestry but also revive pre-alpha.2 contracts and removed architecture, forcing compatibility shims at every affected package boundary.

**Downgrade the official API to the local branch's failure and Session types.** This would make one feature compile at the cost of diverging from the upstream wire protocol and every generated Remote consumer.

**Resolve local Markdown images only as transient browser URLs.** This would avoid a durable event but would make replay depend on the source file and bypass the existing authenticated attachment path.

**Put local image bytes or source paths into Assistant message text.** This would change model-visible or persisted message content and would violate the separation between assistant text and presentation-only attachment mappings; the durable message-content rule remains owned by [Web multimodal image input and durable attachments](../feature/2026-07-22-web-multimodal-image-input-and-durable-attachments.md).

**Recreate removed alpha.2 UI components to fit the old local styles.** This would duplicate official ownership and leave future preset or settings changes with two competing component contracts.

## Consequences

The integration preserves the official alpha.2 architecture and keeps local behavior isolated to explicit extension points. The new mapping event is a durable and generated protocol surface, so Session event vocabulary, Remote declarations, SDK-facing projections, invariants, tests, catalogs, and documentation must stay synchronized.

Local Markdown resolution is opt-in and source-file deletion does not invalidate an already admitted attachment. A process failure after attachment publication but before the mapping event can leave an unreferenced object until reference-aware collection exists. The `host` policy intentionally grants the active filesystem provider's readable-image scope; `workspaces` is the narrower option.

Focused Host, Client, attachment, Markdown, Chat, and conversation tests cover the changed paths. The integration remains uncommitted and does not change `master`, `upstream/master`, or the protected source-checkout evaluation file.
