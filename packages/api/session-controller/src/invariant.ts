/** Package-owned relational invariants for Session Controller mappings. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { extractMarkdownImages } from './markdown-images.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-api-session-controller'

/** Cordis companion plugin name. */
export const name = 'api-session-controller-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

function validateMapping(session: Session, event: SessionEvent, fail: InvariantFailure): void {
  if (event.type !== 'assistant/markdown-image') return
  const mapping = event.data
  const assistant = session.events.find(candidate =>
    candidate.type === 'assistant/message'
    && candidate.seq < event.seq
    && candidate.data.message.id === mapping.messageId)
  if (assistant === undefined || assistant.type !== 'assistant/message') {
    fail(`assistant/markdown-image ${mapping.messageId} has no earlier assistant message`)
  }
  if (assistant.data.turn !== mapping.turn || assistant.data.step !== mapping.step) {
    fail(`assistant/markdown-image ${mapping.messageId} has mismatched turn or step`)
  }
  const block = assistant.data.message.content[mapping.textBlockIndex]
  if (block?.type !== 'text') {
    fail(`assistant/markdown-image ${mapping.messageId} points outside a text block`)
  }
  const occurrence = extractMarkdownImages(block.text).find(item => item.index === mapping.imageIndex)
  if (occurrence === undefined || occurrence.destination !== mapping.destination) {
    fail(`assistant/markdown-image ${mapping.messageId} does not match its Markdown occurrence`)
  }
}

/** Install the mapping relation into the Session event publication checks. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  const staged = new WeakMap<SessionEvent, { readonly session: Session }>()
  const seed = (session: Session): void => {
    for (const event of session.events) validateMapping(session, event, fail)
  }
  for (const session of ctx.sessions.list()) seed(session)
  ctx.on('session/created', seed, { global: true })
  ctx.on('session/event', (session, event) => {
    const candidate = staged.get(event)
    if (candidate === undefined || candidate.session !== session) {
      fail('session/event reached publication without a staged Session Controller validation')
    }
    staged.delete(event)
  }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [session, event] = args as [Session, SessionEvent]
    validateMapping(session, event, fail)
    staged.set(event, { session })
  }, { global: true })
}, { inject: ['sessions'] })

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
