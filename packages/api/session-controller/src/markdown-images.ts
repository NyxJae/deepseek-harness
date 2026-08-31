/** Host-side admission and durable mapping for local Assistant Markdown images. */

import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { AttachmentError } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-fs'
import { RemoteError, remoteErrorOf, type RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
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

/** One finalized Markdown image occurrence in document order. */
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
  private readonly inflight = new Map<string, SharedMarkdownImageRequest<SessionResolveMarkdownImageValue>>()
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
      const active = [...this.inflight.values()]
      for (const request of active) request.cancel()
      await Promise.allSettled(active.map(request => request.promise))
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
      return Promise.reject(failure('session/attachment-invalid', 'Local Markdown images are disabled.', 'LOCAL_MARKDOWN_IMAGES_DISABLED'))
    }
    if (this.disposed) return Promise.reject(failure('gateway/internal', 'Local Markdown image resolver is disposed.', 'RESOLVER_DISPOSED'))
    validateRequest(request)
    if (signal.aborted) return Promise.reject(cancellationFailure())
    const key = mappingKey(request)
    let shared = this.inflight.get(key)
    if (shared === undefined) {
      shared = new SharedMarkdownImageRequest(sharedSignal => this.resolveOnce(request, sharedSignal))
      this.inflight.set(key, shared)
      const current = shared
      void shared.promise.then(
        () => { if (this.inflight.get(key) === current) this.inflight.delete(key) },
        () => { if (this.inflight.get(key) === current) this.inflight.delete(key) },
      )
    }
    return shared.wait(signal)
  }

  private async resolveOnce(
    request: SessionResolveMarkdownImageRequest,
    signal: AbortSignal,
  ): Promise<SessionResolveMarkdownImageValue> {
    signal.throwIfAborted()
    const resolved = await this.agents.resolveAgent(request.sessionId)
    signal.throwIfAborted()
    if ('error' in resolved) throw resolved.error
    const session = resolved.agent.session
    const assistant = findAssistantMessage(session.events, request.messageId)
    if (assistant === undefined) {
      throw failure('gateway/bad-request', 'The addressed Assistant message is not in this Session.', 'MESSAGE_NOT_FOUND')
    }
    const block = assistant.data.message.content[request.textBlockIndex]
    if (block?.type !== 'text') {
      throw failure('gateway/bad-request', 'The addressed content block is not text.', 'TEXT_BLOCK_NOT_FOUND')
    }
    const occurrence = extractMarkdownImages(block.text).find(item => item.index === request.imageIndex)
    if (occurrence === undefined || occurrence.destination !== request.destination) {
      throw failure('gateway/bad-request', 'The Markdown image occurrence does not match the Session message.', 'IMAGE_OCCURRENCE_MISMATCH')
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
      const remote = remoteErrorOf(error)
      if (remote !== undefined) {
        if (pending !== undefined && remote.code !== 'gateway/cancelled') this.pending.set(key, pending)
        throw remote
      }
      if (signal.aborted) throw failure('gateway/cancelled', 'Local Markdown image resolution was cancelled.', 'CANCELLED')
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
    if (path === undefined) throw failure('gateway/bad-request', 'The Markdown destination is not a local image path.', 'LOCAL_PATH_REQUIRED')
    const target = await this.ctx.fs.resolve(
      path,
      session.header.cwd === undefined ? { signal } : { cwd: session.header.cwd, signal },
    )
    signal.throwIfAborted()
    const info = await this.ctx.fs.stat(target, signal)
    if (info === undefined) throw failure('session/attachment-invalid', `Local image not found: ${destination}`, 'IMAGE_NOT_FOUND')
    if (info.type !== 'file') throw failure('session/attachment-invalid', `Local image is not a regular file: ${destination}`, 'IMAGE_NOT_REGULAR_FILE')
    if (info.size !== undefined && info.size > this.ctx.attachments.imageLimits.maxImageBytes) {
      throw failure('session/attachment-invalid', 'Local image exceeds the configured image-size limit.', 'IMAGE_TOO_LARGE')
    }
    if (this.config.mode === 'workspaces' && !(await this.inRegisteredWorkspace(target, signal))) {
      throw failure('session/attachment-invalid', 'Local image is outside every registered Workspace.', 'IMAGE_OUTSIDE_WORKSPACE')
    }
    const mediaType = IMAGE_MEDIA_TYPES[extensionOf(path)]
    if (mediaType === undefined) {
      throw failure('session/attachment-invalid', 'The local image extension is not supported.', 'UNSUPPORTED_IMAGE_EXTENSION')
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

class SharedMarkdownImageRequest<T> {
  readonly controller = new AbortController()
  readonly promise: Promise<T>
  private settled = false
  private waiters = 0

  constructor(start: (signal: AbortSignal) => Promise<T>) {
    this.promise = Promise.resolve().then(() => start(this.controller.signal)).finally(() => {
      this.settled = true
    })
  }

  wait(signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(cancellationFailure())
    this.waiters += 1
    return new Promise<T>((resolve, reject) => {
      let finished = false
      const finish = (callback: () => void, cancelled: boolean): void => {
        if (finished) return
        finished = true
        signal.removeEventListener('abort', abort)
        this.release(cancelled)
        callback()
      }
      const abort = (): void => {
        finish(() => {
          reject(cancellationFailure())
        }, true)
      }
      signal.addEventListener('abort', abort, { once: true })
      void this.promise.then(
        (value) => {
          finish(() => {
            resolve(value)
          }, false)
        },
        (error: unknown) => {
          finish(() => {
            reject(error instanceof Error ? error : new Error('Shared Markdown image request failed.', { cause: error }))
          }, false)
        },
      )
    })
  }

  cancel(): void {
    if (!this.settled) this.controller.abort(cancellationFailure())
  }

  private release(cancelled: boolean): void {
    this.waiters -= 1
    if (cancelled && this.waiters === 0 && !this.settled) this.controller.abort(cancellationFailure())
  }
}

interface PendingMapping {
  readonly mapping: SessionMarkdownImageMapping
}

function validateRequest(request: SessionResolveMarkdownImageRequest): void {
  if (request.sessionId.length === 0 || request.messageId.length === 0 || request.destination.length === 0) {
    throw failure('gateway/bad-request', 'The local Markdown image request is incomplete.', 'INVALID_IMAGE_REQUEST')
  }
  if (!Number.isSafeInteger(request.textBlockIndex) || request.textBlockIndex < 0
    || !Number.isSafeInteger(request.imageIndex) || request.imageIndex < 0) {
    throw failure('gateway/bad-request', 'Markdown image indexes must be non-negative integers.', 'INVALID_IMAGE_INDEX')
  }
}

function mappingKey(request: Pick<SessionResolveMarkdownImageRequest, 'sessionId' | 'messageId' | 'textBlockIndex' | 'imageIndex' | 'destination'>): string {
  return JSON.stringify([
    request.sessionId,
    request.messageId,
    request.textBlockIndex,
    request.imageIndex,
    request.destination,
  ])
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
  if (destination.startsWith('//') || destination.startsWith('\\\\')) return undefined
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

/**
 * Extract image nodes in the same logical order as settled Markdown rendering.
 * @param text - finalized Assistant Markdown text.
 * @returns image occurrences with renderer-compatible indexes and destinations.
 */
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
      const id = node.identifier.toUpperCase()
      if (!definitions.has(id)) definitions.set(id, node as Md.Definition)
    }
    if (node.type === 'footnoteDefinition' && node.identifier !== undefined) {
      const id = node.identifier.toUpperCase()
      if (!footnotes.has(id)) footnotes.set(id, node as Md.FootnoteDefinition)
    }
    const children = node.children
    for (const child of children ?? []) collectTargets([child], definitions, footnotes)
  }
}

function mapFailure(error: unknown): RemoteFailure {
  const remote = remoteErrorOf(error)
  if (remote !== undefined) return remote
  if (error instanceof AttachmentError) {
    return new RemoteError('session/attachment-invalid', error.message, { reason: error.code })
  }
  return new RemoteError(
    'gateway/internal',
    'Unable to read local Markdown image.',
    {},
    { cause: error },
  )
}
function cancellationFailure(): RemoteError<'gateway/cancelled'> {
  return new RemoteError('gateway/cancelled', 'Local Markdown image resolution was cancelled.', {})
}

function failure(code: 'gateway/bad-request', message: string, reason: string): RemoteError<'gateway/bad-request'>
function failure(code: 'gateway/cancelled', message: string, reason: string): RemoteError<'gateway/cancelled'>
function failure(code: 'gateway/internal', message: string, reason: string): RemoteError<'gateway/internal'>
function failure(code: 'session/attachment-invalid', message: string, reason: string, details?: Record<string, unknown>): RemoteError<'session/attachment-invalid'>
function failure(
  code: 'gateway/bad-request' | 'gateway/cancelled' | 'gateway/internal' | 'session/attachment-invalid',
  message: string,
  reason: string,
  details: Record<string, unknown> = {},
): RemoteFailure {
  switch (code) {
    case 'gateway/bad-request':
      return new RemoteError(code, message, {})
    case 'gateway/cancelled':
      return new RemoteError(code, message, {})
    case 'gateway/internal':
      return new RemoteError(code, message, {})
    case 'session/attachment-invalid':
      return new RemoteError(code, message, { reason, ...details })
  }
}
