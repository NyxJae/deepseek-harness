# Agent Note: Local Markdown images in authenticated Web chat

Status: implemented

English | [中文](2026-08-29-web-local-markdown-images.zh.md)

## Problem

An assistant can use ordinary Markdown image syntax to name a screenshot, chart, or other image on the DSH host, but a browser connected through loopback or `dsh.nyxjae.xyz` cannot read that host file through a `file:` URL, an absolute operating-system path, or a relative path.

The existing durable attachment path transports admitted bytes through the authenticated Session API and renders browser Blob URLs. Local Markdown images need the same durable representation, and the existing image viewer needs inspection controls for large screenshots and charts.

## Decision

Finalized Assistant Markdown local image occurrences enter an opt-in Host resolver. The resolver validates the addressed Session message, reads an accepted local target through the Host filesystem provider, stores normalized bytes through the attachment service, and appends a log-only `assistant/markdown-image` mapping. Chat replaces the matching AST occurrence with the existing durable message-image presentation without changing the assistant text sent to providers.

The resolver accepts PNG, JPEG, WebP, and GIF destinations in standard Markdown. It handles `file:` URLs, absolute paths, and paths relative to the Session `cwd`. Remote HTTP(S) images retain direct browser loading. Raw HTML, `data:` URLs, unsupported schemes, and non-image files do not use this resolver. Streaming Markdown keeps local destinations as inert fallback text until the assistant message is finalized.

### Authorization and path policy

`api-session-controller` exposes `localMarkdownImages.mode`, with `disabled` as the default. `disabled` performs no local-image work, `workspaces` requires provider-owned containment under a registered Workspace root, and `host` allows any regular supported image that the active filesystem provider can read. The user Web profile selects `host`; the Web process remains on `127.0.0.1` and trusts exactly `dsh.nyxjae.xyz` as its non-loopback authority.

The Host uses `ctx.fs.resolve`, `stat`, `contains`, and bounded `readBytes`. It never parses the opaque `FsTarget.targetKey` and never exposes a public filesystem route or operating-system file handle. Existing Host, Origin, Fetch-Metadata, and authority-bound browser authentication checks continue to protect `/api` and WebSocket access.

```yaml
localMarkdownImages:
  mode: host
```

### Durable resolution and replay

Each occurrence is addressed by `sessionId`, assistant `messageId`, text-block index, image ordinal, and the authored destination. The Host reparses the recorded assistant text with GFM and math extensions, uses document order with first-definition-wins reference resolution, and rejects a mismatched occurrence before filesystem access. The Client behavior method adds its Session identity before calling generated `session.resolveMarkdownImage` Remote code.

The Host saves the image before appending the mapping event. The event-specific attachment authorization arm checks only `data.attachment` on `assistant/markdown-image`, so `session.attachment` can read a mapped reference without granting access to unrelated event fields. The mapping is excluded from provider requests, token accounting, compaction input, and KV Cache identity.

Resolution is idempotent and single-flight per occurrence. Same-process append failure retains the saved reference for retry without rereading the source. Disposal rejects new work and waits for active admissions. A crash between content-addressed publication and event persistence can leave an unreferenced deduplicated object; reference-aware garbage collection remains deferred.

### Chat rendering

`ui-chat` folds mapping events into Assistant state and supplies a settled-only Markdown image resolver to `ui-primitives`. The resolver replaces only the matching AST image node, keeps surrounding Markdown in one render pass, and sends the resulting attachment through the existing `HistoricalImageCache` to `session.attachment` Blob URL path. Refresh, reconnect, Session switching, and history replay therefore use stored bytes even after the source file changes or disappears.

A missing file, refused path, unsupported image, or admission failure affects only its occurrence. Chat shows a localized loading state or retryable failure control, and successful sibling images remain visible. Streaming never requests a local file.

### Image viewer

`ui-attachment` upgrades the existing `ImageLightbox`, so structured attachments and local Markdown images share one viewer. The body-portal viewer provides zoom-in, zoom-out, fit/reset, close, pointer-centered wheel zoom, bounded grab-to-pan, touch pinch and one-finger pan, double-click zoom, `+`, `-`, `0`, Escape, focus trapping, opener restoration, background-scroll locking, resize handling, safe-area placement, and localized accessible labels.

The viewer owns pointer capture, transient gesture state, and cleanup. Every zoom and pan update is clamped to the viewport, and opening a new image starts at fit scale. The viewer receives the existing Blob or preview URL and does not create a second URL owner or public image host.

### Package ownership and deployment

The behavior stays in three Cordis plugins plus one Cordis-free Markdown callback:

| Owner | Responsibility |
|---|---|
| `@deepseek-ai/dsh-api-session-controller` | Configuration, filesystem policy, durable admission, mapping event, attachment authorization, invariant, and Host Remote method. |
| `@deepseek-ai/dsh-client-ui-chat` | Occurrence classification, Session-scoped recovery, Assistant mapping projection, loading/error states, and Chat rendering. |
| `@deepseek-ai/dsh-client-ui-attachment` | Shared zoom-and-pan viewer, controls, gestures, focus lifecycle, safe-area styling, and component presentation. |
| `@deepseek-ai/dsh-client-ui-primitives` | Settled-only AST image replacement callback with no Cordis or Session dependency. |

The Web bundle keeps local image mode disabled by default. The user profile enables `host` and configures the exact public authority; the reverse proxy must preserve that Host for page, `/api`, and WebSocket requests. No change is made to `agent-loop`, `client-connection`, or the public API trust model.

### Testing

Focused Host, Client, and component suites cover parser order, reference images, local-path policy, durable mapping, authorization, invariant rejection, retries, concurrency, streaming fallback, Chat projection, Lightbox keyboard/focus behavior, wheel zoom, pointer drag, touch pinch, resize, and cleanup. The final feature regression run passed 35 test files and 380 tests.

`build:lib`, `build:web`, `test:docs`, changed-directory Oxlint, the relevant face-specific typechecks, `git diff --check`, and the composed Web profile dump passed. The protected Web process was not restarted in this change, so authenticated loopback rendering, public-authority rendering, source-deletion replay, and desktop/mobile screenshot evidence remain a manual post-restart verification step.

## Alternatives considered

**Let the browser load `file:` URLs directly.** A remote browser resolves that URL against its own machine and security policy, so it cannot transport DSH Host bytes through a VPS.

**Expose a static Host filesystem route or use an image host.** A second route would duplicate path authorization and lifetime rules, while an image host would add network publication, credentials, and cleanup. Durable Session attachments reuse existing validation, authorization, replay, and Blob URL handling.

**Trust every non-loopback authority or remove `/api` trust checks.** Session operations can execute tools, so arbitrary authority trust would widen a sensitive carrier. Exact `dsh.nyxjae.xyz` trust preserves the existing deployment rule.

**Read the source path on every render.** History would change when a file is overwritten and fail when it is deleted. A durable attachment reference makes the first successful read the stable replay snapshot.

**Rewrite the assistant message or change `agent-loop`.** Replacing Markdown with an `ImageBlock` would alter model-visible content and expand the core loop. A log-only mapping keeps provider output unchanged.

**Restrict the deployment to registered Workspaces.** That is the narrower supported mode, but `host` is required for this deployment's purpose of sending any readable local image. The wider authority is explicit in configuration.

## Consequences

Authenticated Web Chat can display supported local Markdown images without a public file route or image host, and later clients can replay the stored image after the source changes or is deleted. The mapping is visible only as a log-only event and does not change model input.

`host` mode gives an authenticated Web principal access to copy any readable supported image into a Session, so profiles that do not accept that authority should keep the mode disabled. Attachment validation limits bytes, dimensions, pixels, and media types; normalization may change the stored master shown by the viewer.

A failed or crash-lost mapping append can leave a deduplicated object without a reference. Same-process retry reuses the object, while reference-aware garbage collection is deferred. Large images consume browser decode memory, and the shared viewer limits transform state and releases no URL outside the existing Session or draft owner.
