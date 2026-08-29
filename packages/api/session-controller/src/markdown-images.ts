/** Host-side admission and durable mapping for local Assistant Markdown images. */

import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { AttachmentError } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-fs'
import { TypertRemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import type * as Md from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-math'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { SessionMarkdownImageMapping, SessionResolveMarkdownImageRequest, SessionResolveMarkdownImageValue } from './types.ts'
import type { ApiSessionAgentController } from './agent.ts'

const IMAGE_MEDIA_TYPES: Readonly<Record<string, ImageMediaType>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/** One image node in the settled Markdown document order. */
interface MarkdownNode {
  readonly type: string
  readonly children?: readonly MarkdownNode[]
  readonly identifier?: string
  readonly url?: string
  readonly alt?: string | null
}
export interface MarkdownImageOccurrence {
  readonly index: number
  readonly destination: string
  readonly alt: string
}

/** Local Markdown image admission mode. */
export type LocalMarkdownImagesMode = 'disabled' | 'workspaces' | 'host'

/** Configuration consumed by {@link SessionMarkdownImageResolver}. */
export interface LocalMarkdownImagesConfig {
  readonly mode: LocalMarkdownImagesMode
}

/**
 * Resolves one local Markdown image into the durable attachment store and
 * records the mapping after the attachment has been published.
 */
export class SessionMarkdownImageResolver {
  private readonly inflight = new Map<string, Promise<SessionResolveMarkdownImageValue>>()
  private readonly pending = new Map<string, PendingMapping>()
  private disposed = false

  /**
   * @param ctx - Host context providing filesystem, attachment, Session, and Workspace services.
   * @param agents - Agent activation owner used to append mapping events to cold Sessions.
   * @param config - Deployment mode for local Markdown images.
   */
  constructor(
    private readonly ctx: Context,
    private readonly agents: ApiSessionAgentController,
    private readonly config: LocalMarkdownImagesConfig,
  ) {
    ctx.effect(() => async () => {
      this.disposed = true
      await Promise.allSettled([...this.inflight.values()])
      this.inflight.clear()
      this.pending.clear()
    }, 'session-controller.markdown-images')
  }

  /**
   * Resolve one addressed local image and append its durable mapping.
   * @param request - Session, Assistant message, text block, image ordinal, and destination.
   * @param signal - caller cancellation signal.
   * @returns the committed mapping.
   */
  resolve(
    request: SessionResolveMarkdownImageRequest,
    signal: AbortSignal,
  ): Promise<SessionResolveMarkdownImageValue> {
    if (this.config.mode === 'disabled') {
      return Promise.reject(failure('attachment-error', 'Local Markdown images are disabled.', 'LOCAL_MARKDOWN_IMAGES_DISABLED'))
    }
    if (this.disposed) return Promise.reject(failure('internal', 'Local Markdown image resolver is disposed.', 'RESOLVER_DISPOSED'))
    validateRequest(request)
    const key = mappingKey(request)
    const existing = this.inflight.get(key)
    if (existing !== undefined) return existing
    const operation = this.resolveOnce(request, signal).finally(() => {
      this.inflight.delete(key)
    })
    this.inflight.set(key, operation)
    return operation
  }

  private async resolveOnce(
    request: SessionResolveMarkdownImageRequest,
    signal: AbortSignal,
  ): Promise<SessionResolveMarkdownImageValue> {
    signal.throwIfAborted()
    const resolved = await this.agents.resolveAgent(request.sessionId)
    if ('error' in resolved) {
      throw failure(resolved.error.code, resolved.error.message, 'SESSION_RESOLVE_FAILED', resolved.error.details)
    }
    const session = resolved.agent.session
    const assistant = findAssistantMessage(session.events, request.messageId)
    if (assistant === undefined) {
      throw failure('bad-request', 'The addressed Assistant message is not in this Session.', 'MESSAGE_NOT_FOUND')
    }
    const block = assistant.data.message.content[request.textBlockIndex]
    if (block?.type !== 'text') {
      throw failure('bad-request', 'The addressed content block is not text.', 'TEXT_BLOCK_NOT_FOUND')
    }
    const occurrence = extractMarkdownImages(block.text).find(item => item.index === request.imageIndex)
    if (occurrence === undefined || occurrence.destination !== request.destination) {
      throw failure('bad-request', 'The Markdown image occurrence does not match the Session message.', 'IMAGE_OCCURRENCE_MISMATCH')
    }
    const existing = findMapping(
      session.events,
      request.messageId,
      request.textBlockIndex,
      request.imageIndex,
      request.destination,
    )
    if (existing !== undefined) return existing

    const key = mappingKey(request)
    const pending = this.pending.get(key)
    try {
      const mapping = pending === undefined
        ? await this.admit(session, assistant, request, occurrence.destination, signal)
        : pending.mapping
      signal.throwIfAborted()
      session.append('assistant/markdown-image', mapping)
      this.pending.delete(key)
      return mapping
    } catch (error: unknown) {
      if (error instanceof TypertRemoteFailure) {
        const reason = (error.failure.details as { readonly reason?: unknown }).reason
        if (pending !== undefined && reason !== 'CANCELLED') this.pending.set(key, pending)
        throw error
      }
      if (signal.aborted) throw failure('cancelled', 'Local Markdown image resolution was cancelled.', 'CANCELLED')
      if (pending !== undefined) this.pending.set(key, pending)
      throw mapFailure(error)
    }
  }

  private async admit(
    session: Session,
    assistant: Extract<SessionEvent, { type: 'assistant/message' }>,
    request: SessionResolveMarkdownImageRequest,
    destination: string,
    signal: AbortSignal,
  ): Promise<SessionMarkdownImageMapping> {
    const path = localPath(destination)
    if (path === undefined) throw failure('bad-request', 'The Markdown destination is not a local image path.', 'LOCAL_PATH_REQUIRED')
    const target = await this.ctx.fs.resolve(
      path,
      session.header.cwd === undefined ? undefined : { cwd: session.header.cwd, signal },
    )
    signal.throwIfAborted()
    const info = await this.ctx.fs.stat(target, signal)
    if (info === undefined) throw failure('attachment-error', `Local image not found: ${destination}`, 'IMAGE_NOT_FOUND')
    if (info.type !== 'file') throw failure('attachment-error', `Local image is not a regular file: ${destination}`, 'IMAGE_NOT_REGULAR_FILE')
    if (info.size !== undefined && info.size > this.ctx.attachments.imageLimits.maxImageBytes) {
      throw failure('attachment-error', 'Local image exceeds the configured image-size limit.', 'IMAGE_TOO_LARGE')
    }
    if (this.config.mode === 'workspaces' && !(await this.inRegisteredWorkspace(target, signal))) {
      throw failure('attachment-error', 'Local image is outside every registered Workspace.', 'IMAGE_OUTSIDE_WORKSPACE')
    }
    const mediaType = IMAGE_MEDIA_TYPES[extensionOf(path)]
    if (mediaType === undefined) {
      throw failure('attachment-error', 'The local image extension is not supported.', 'UNSUPPORTED_IMAGE_EXTENSION')
    }
    const data = await this.ctx.fs.readBytes(target, signal, this.ctx.attachments.imageLimits.maxImageBytes)
    signal.throwIfAborted()
    let attachment: ImageAttachmentRef
    try {
      attachment = await this.ctx.attachments.saveImage({
        data,
        mediaType,
        name: basename(target.displayPath),
      })
    } catch (error: unknown) {
      throw mapFailure(error)
    }
    const mapping: SessionMarkdownImageMapping = {
      turn: assistant.data.turn,
      step: assistant.data.step,
      messageId: request.messageId,
      textBlockIndex: request.textBlockIndex,
      imageIndex: request.imageIndex,
      destination,
      attachment,
    }
    this.pending.set(mappingKey(request), { mapping })
    return mapping
  }

  private async inRegisteredWorkspace(target: Awaited<ReturnType<Context['fs']['resolve']>>, signal: AbortSignal): Promise<boolean> {
    for (const workspace of this.ctx.workspaceRegistry.list()) {
      const root = await this.ctx.fs.resolve(workspace.path, { signal })
      if (this.ctx.fs.contains(root, target)) return true
    }
    return false
  }
}

interface PendingMapping {
  readonly mapping: SessionMarkdownImageMapping
}

function validateRequest(request: SessionResolveMarkdownImageRequest): void {
  if (request.sessionId.length === 0 || request.messageId.length === 0 || request.destination.length === 0) {
    throw failure('bad-request', 'The local Markdown image request is incomplete.', 'INVALID_IMAGE_REQUEST')
  }
  if (!Number.isSafeInteger(request.textBlockIndex) || request.textBlockIndex < 0
    || !Number.isSafeInteger(request.imageIndex) || request.imageIndex < 0) {
    throw failure('bad-request', 'Markdown image indexes must be non-negative integers.', 'INVALID_IMAGE_INDEX')
  }
}

function mappingKey(request: Pick<SessionResolveMarkdownImageRequest, 'sessionId' | 'messageId' | 'textBlockIndex' | 'imageIndex'>): string {
  return `${request.sessionId}/${request.messageId}/${String(request.textBlockIndex)}/${String(request.imageIndex)}`
}

function findAssistantMessage(
  events: readonly SessionEvent[],
  messageId: SessionResolveMarkdownImageRequest['messageId'],
): Extract<SessionEvent, { type: 'assistant/message' }> | undefined {
  return events.find((event): event is Extract<SessionEvent, { type: 'assistant/message' }> =>
    event.type === 'assistant/message' && event.data.message.id === messageId)
}

function findMapping(
  events: readonly SessionEvent[],
  messageId: SessionResolveMarkdownImageRequest['messageId'],
  textBlockIndex: number,
  imageIndex: number,
  destination: string,
): SessionResolveMarkdownImageValue | undefined {
  const found = events.find((event): event is Extract<SessionEvent, { type: 'assistant/markdown-image' }> =>
    event.type === 'assistant/markdown-image'
      && event.data.messageId === messageId
      && event.data.textBlockIndex === textBlockIndex
      && event.data.imageIndex === imageIndex
      && event.data.destination === destination)
  return found?.data
}

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot).toLowerCase()
}

function localPath(destination: string): string | undefined {
  try {
    const parsed = new URL(destination)
    if (parsed.protocol === 'file:') return fileURLToPath(parsed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      if (/^[A-Za-z]:[\\/]/.test(destination)) return destination
      return undefined
    }
    return undefined
  } catch {
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(destination) && !/^[A-Za-z]:[\\/]/.test(destination)) return undefined
    return destination
  }
}

function parseMarkdown(text: string): Md.Root {
  return fromMarkdown(text, {
    extensions: [gfm(), math()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  })
}

/** Extract image nodes in the same logical order as settled Markdown rendering. */
export function extractMarkdownImages(text: string): MarkdownImageOccurrence[] {
  const root = parseMarkdown(text)
  const definitions = new Map<string, Md.Definition>()
  const footnotes = new Map<string, Md.FootnoteDefinition>()
  collectTargets(root.children as unknown as readonly MarkdownNode[], definitions, footnotes)
  const footnoteOrder: string[] = []
  const occurrences: MarkdownImageOccurrence[] = []
  let index = 0
  const visit = (node: MarkdownNode): void => {
    switch (node.type) {
      case 'definition':
      case 'footnoteDefinition':
        return
      case 'image': {
        occurrences.push({ index, destination: node.url ?? '', alt: node.alt ?? '' })
        index += 1
        return
      }
      case 'imageReference': {
        const imageIndex = index
        index += 1
        const definition = node.identifier === undefined ? undefined : definitions.get(node.identifier.toUpperCase())
        if (definition !== undefined) {
          occurrences.push({ index: imageIndex, destination: definition.url, alt: node.alt ?? '' })
        }
        return
      }
      case 'footnoteReference': {
        const id = node.identifier?.toUpperCase()
        if (id !== undefined && !footnoteOrder.includes(id)) footnoteOrder.push(id)
        return
      }
      default:
        break
    }
    const children = 'children' in node ? node.children : undefined
    for (const child of children ?? []) visit(child)
  }
  for (const child of root.children) visit(child as unknown as MarkdownNode)
  for (const id of footnoteOrder) {
    const definition = footnotes.get(id)
    for (const child of definition?.children ?? []) visit(child as unknown as MarkdownNode)
  }
  return occurrences
}

function collectTargets(
  nodes: readonly MarkdownNode[],
  definitions: Map<string, Md.Definition>,
  footnotes: Map<string, Md.FootnoteDefinition>,
): void {
  for (const node of nodes) {
    if (node.type === 'definition' && node.identifier !== undefined && node.url !== undefined) {
      definitions.set(node.identifier.toUpperCase(), node as Md.Definition)
    }
    if (node.type === 'footnoteDefinition' && node.identifier !== undefined) {
      footnotes.set(node.identifier.toUpperCase(), node as Md.FootnoteDefinition)
    }
    const children = node.children
    for (const child of children ?? []) collectTargets([child], definitions, footnotes)
  }
}

function mapFailure(error: unknown): TypertRemoteFailure {
  if (error instanceof AttachmentError) return failure('attachment-error', error.message, error.code)
  if (error instanceof TypertRemoteFailure) return error
  return failure('attachment-error', `Unable to read local image: ${error instanceof Error ? error.message : String(error)}`, 'IMAGE_READ_FAILED')
}

function failure(
  code: string,
  message: string,
  reason: string,
  details: Record<string, unknown> = {},
): TypertRemoteFailure {
  return new TypertRemoteFailure({ code, message, details: { reason, ...details } })
}
