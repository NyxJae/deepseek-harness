/** Host-side local Markdown image admission and mapping tests. */

import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry, { InvariantError } from '@deepseek-ai/dsh-invariants'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { createAssistantMessage, createUserMessage, MessageId } from '@deepseek-ai/dsh-llm'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { describe, expect, it, vi } from 'vitest'
import { ApiSessionAgentController } from '../src/agent.ts'
import { SessionMarkdownImageResolver } from '../src/markdown-images.ts'
import * as SessionControllerInvariant from '../src/invariant.ts'

const IMAGE = {
  attachmentId: 'image-1' as never,
  mediaType: 'image/png' as const,
  bytes: 4,
  width: 1,
  height: 1,
} satisfies ImageAttachmentRef

function assistantSession(body: string): { session: Session; messageId: MessageId } {
  const sessionId = SessionId('markdown-image-session')
  const message = createAssistantMessage({
    content: [{ type: 'text', text: body }],
    source: { provider: 'fixture', model: 'fixture' },
  })
  const events: SessionEvent[] = [
    { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
    {
      type: 'user/message',
      seq: 1,
      time: 2,
      surfaceOp: 'append',
      data: createUserMessage({ content: [{ type: 'text', text: 'show image' }], source: { kind: 'user' } }),
    },
    { type: 'step/start', seq: 2, time: 3, data: { turn: 1, step: 0 } },
    {
      type: 'assistant/message',
      seq: 3,
      time: 4,
      surfaceOp: 'append',
      data: { turn: 1, step: 0, message },
    },
    { type: 'step/end', seq: 4, time: 5, data: { turn: 1, step: 0 } },
    { type: 'turn/end', seq: 5, time: 6, data: { turn: 1, reason: { kind: 'completed' } } },
  ] as SessionEvent[]
  const header = { version: 0, id: sessionId, createdAt: 1, cwd: 'C:\\workspace' } as SessionHeader
  return { session: Session.create(sessionId, events, header), messageId: message.id }
}

function resolverHarness(
  session: Session,
  mode: 'workspaces' | 'host' | 'disabled' = 'host',
  contains = true,
) {
  const ctx = new Context()
  const fs = {
    resolve: vi.fn(async () => ({ targetKey: 'opaque-target', displayPath: 'C:\\workspace\\picture.png' })),
    stat: vi.fn(async () => ({ type: 'file', size: 4 })),
    contains: vi.fn(() => contains),
    readBytes: vi.fn(async () => Uint8Array.of(1, 2, 3, 4)),
  }
  ctx.provide('fs', fs as never)
  ctx.provide('attachments', {
    imageLimits: { maxImageBytes: 20, maxImagesPerMessage: 20, maxMessageImageBytes: 200, maxImagePixels: 64_000_000, maxImageDimension: 8192, mediaTypes: ['image/png'] },
    saveImage: vi.fn(async () => IMAGE),
  } as never)
  ctx.provide('workspaceRegistry', {
    list: () => mode === 'workspaces' ? [{ path: 'C:\\workspace' }] : [],
  } as never)
  const agent = { session }
  const resolveAgent = vi.fn(async () => ({ agent }))
  const agents = { resolveAgent } as unknown as ApiSessionAgentController
  const resolver = new SessionMarkdownImageResolver(ctx, agents, { mode })
  return { ctx, resolver, agents, resolveAgent, fs }
}

const request = (session: Session, messageId: MessageId, destination = 'picture.png') => ({
  sessionId: session.id,
  messageId,
  textBlockIndex: 0,
  imageIndex: 0,
  destination,
})

describe('SessionMarkdownImageResolver', () => {
  it('reads a local image, saves it, and appends one durable mapping event', async () => {
    const { session, messageId } = assistantSession('![picture](picture.png)')
    const { ctx, resolver } = resolverHarness(session)
    await expect(resolver.resolve(request(session, messageId), new AbortController().signal)).resolves.toMatchObject({
      messageId,
      destination: 'picture.png',
      attachment: IMAGE,
    })
    expect(session.events.some(event => event.type === 'assistant/markdown-image')).toBe(true)
    await ctx.fiber.dispose()
  })

  it('rejects outside-Workspace images in workspace mode and disabled mode', async () => {
    const outside = assistantSession('![picture](picture.png)')
    const outsideHarness = resolverHarness(outside.session, 'workspaces', false)
    await expect(outsideHarness.resolver.resolve(request(outside.session, outside.messageId), new AbortController().signal))
      .rejects.toMatchObject({ code: 'session/attachment-invalid', details: { reason: 'IMAGE_OUTSIDE_WORKSPACE' } })
    await outsideHarness.ctx.fiber.dispose()

    const disabled = assistantSession('![picture](picture.png)')
    const disabledHarness = resolverHarness(disabled.session, 'disabled')
    await expect(disabledHarness.resolver.resolve(request(disabled.session, disabled.messageId), new AbortController().signal))
      .rejects.toMatchObject({ code: 'session/attachment-invalid', details: { reason: 'LOCAL_MARKDOWN_IMAGES_DISABLED' } })
    await disabledHarness.ctx.fiber.dispose()
  })

  it('deduplicates concurrent requests and retains a published reference for append retry', async () => {
    const { session, messageId } = assistantSession('![picture](picture.png)')
    const { ctx, resolver, resolveAgent } = resolverHarness(session)
    const first = resolver.resolve(request(session, messageId), new AbortController().signal)
    const second = resolver.resolve(request(session, messageId), new AbortController().signal)
    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(resolveAgent).toHaveBeenCalledTimes(1)

    const retrySession = assistantSession('![picture](picture.png)')
    const retryHarness = resolverHarness(retrySession.session)
    const append = vi.spyOn(retrySession.session, 'append')
      .mockImplementationOnce(() => { throw new Error('append unavailable') })
    await expect(retryHarness.resolver.resolve(request(retrySession.session, retrySession.messageId), new AbortController().signal))
      .rejects.toMatchObject({ code: 'gateway/internal', details: {} })
    await expect(retryHarness.resolver.resolve(request(retrySession.session, retrySession.messageId), new AbortController().signal))
      .resolves.toMatchObject({ attachment: IMAGE })
    expect(append).toHaveBeenCalledTimes(2)
    await ctx.fiber.dispose()
    await retryHarness.ctx.fiber.dispose()
  })

  it('does not share concurrent requests with different destinations', async () => {
    const { session, messageId } = assistantSession('![picture](picture.png)')
    const { ctx, resolver, resolveAgent } = resolverHarness(session)
    const first = resolver.resolve(request(session, messageId), new AbortController().signal)
    const second = resolver.resolve(request(session, messageId, 'other.png'), new AbortController().signal)
    await expect(first).resolves.toMatchObject({ attachment: IMAGE })
    await expect(second).rejects.toMatchObject({ code: 'gateway/bad-request', details: {} })
    expect(resolveAgent).toHaveBeenCalledTimes(2)
    await ctx.fiber.dispose()
  })
  it('does not cancel a shared admission while another waiter remains', async () => {
    const { session, messageId } = assistantSession('![picture](picture.png)')
    const { ctx, resolver, resolveAgent } = resolverHarness(session)
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    resolveAgent.mockImplementation(() => gate.then(() => ({ agent: { session } })))
    const firstController = new AbortController()
    const secondController = new AbortController()
    const first = resolver.resolve(request(session, messageId), firstController.signal)
    const second = resolver.resolve(request(session, messageId), secondController.signal)
    firstController.abort()
    await expect(first).rejects.toMatchObject({ code: 'gateway/cancelled' })
    release()
    await expect(second).resolves.toMatchObject({ attachment: IMAGE })
    expect(resolveAgent).toHaveBeenCalledTimes(1)
    await ctx.fiber.dispose()
  })


  it('rejects protocol-relative destinations before filesystem access', async () => {
    const destination = '//server/picture.png'
    const { session, messageId } = assistantSession(`![picture](${destination})`)
    const { ctx, resolver, fs } = resolverHarness(session)
    await expect(resolver.resolve(request(session, messageId, destination), new AbortController().signal))
      .rejects.toMatchObject({ code: 'gateway/bad-request', details: {} })
    expect(fs.resolve).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
  })

  it('maps unknown append failures to gateway internal', async () => {
    const { session, messageId } = assistantSession('![picture](picture.png)')
    const { ctx, resolver } = resolverHarness(session)
    vi.spyOn(session, 'append').mockImplementationOnce(() => { throw new Error('append unavailable') })
    await expect(resolver.resolve(request(session, messageId), new AbortController().signal))
      .rejects.toMatchObject({ code: 'gateway/internal', details: {} })
    await ctx.fiber.dispose()
  })


  it('rejects a mapping event whose destination is not the earlier Markdown occurrence', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(InvariantRegistry)
    await ctx.plugin(SessionControllerInvariant)
    const session = ctx.sessions.create(SessionId('markdown-image-invariant'))
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    const message = createAssistantMessage({
      content: [{ type: 'text', text: '![picture](picture.png)' }],
      source: { provider: 'fixture', model: 'fixture' },
    })
    session.append('assistant/message', { turn: 1, step: 1, message }, { surfaceOp: 'append' })
    expect(() => session.append('assistant/markdown-image', {
      turn: 1,
      step: 1,
      messageId: message.id,
      textBlockIndex: 0,
      imageIndex: 0,
      destination: 'other.png',
      attachment: IMAGE,
    })).toThrow(InvariantError)
    await ctx.fiber.dispose()
  })
})
