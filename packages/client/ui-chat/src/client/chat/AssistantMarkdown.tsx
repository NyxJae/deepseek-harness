import { Fragment, memo, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { JsonBlock, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownFileMentions, MarkdownImageResolver } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatNodeOwnerProps, ChatViewSlotProps } from '../contract/slots.ts'
import type { AssistantMarkdownImage } from '../contract/chat-nodes.ts'
import type { AssistantBlock } from '../contract/snapshot.ts'
import type { MessageId } from '@deepseek-ai/dsh-llm/brand'
import { markdownLabels } from '../markdown-labels.ts'
import { ReasoningRow } from './ReasoningRow.tsx'
import { useSearchableHidden } from './searchable-hidden.ts'
import css from './AssistantMarkdown.module.css'

export interface AssistantMarkdownProps {
  blocks: readonly AssistantBlock[]
  streaming: boolean
  /** Frozen partial of an aborted turn: rendered with a stopped marker. */
  interrupted?: boolean | undefined
  /** Render consecutive image blocks through the attachment slot. */
  renderMessageImages: ChatNodeOwnerProps['renderMessageImages']
  /** Resolve a local Markdown image through the Session behavior API. */
  resolveMarkdownImage?: ChatNodeOwnerProps['resolveMarkdownImage'] | undefined
  /** Durable Assistant message identity used for local Markdown image mapping. */
  messageId?: MessageId | undefined
  /** Mapping events already observed for this Assistant message. */
  markdownImages?: readonly AssistantMarkdownImage[] | undefined
  /** Hide reasoning that belongs to the Turn-level process disclosure. */
  reasoningHidden?: boolean | undefined
  /** Reveal the owning Turn-level process disclosure. */
  revealProcess?: (() => void) | undefined
  /** Resolved prose file mentions for this Assistant's closing turn. */
  mentions?: MarkdownFileMentions | undefined
  /** The owning view's locale seat, passed down as a plain prop. */
  t: ChatViewSlotProps['t']
}

/** Reasoning block as the Think variant summary row (figma 39:28304). */
export const AssistantMarkdown = memo(function AssistantMarkdown({
  blocks, streaming, interrupted, renderMessageImages, resolveMarkdownImage,
  messageId, markdownImages = [],
  reasoningHidden = false, revealProcess, mentions, t,
}: AssistantMarkdownProps) {
  // Stable per locale revision (t identity changes on switch): a fresh object
  // per render would rebuild MarkdownText's component table every chunk.
  const labels = useMemo(() => markdownLabels(t), [t])
  const last = blocks.length - 1
  // Tool-call heads render as tool rows in the chat view's grouping pass, so
  // a node that is only those heads (or empty) would paint an empty root
  // between tool groups — skip the shell unless something visible remains.
  const hasVisible = streaming
    || interrupted === true
    || blocks.some(block => block.kind !== 'tool-call')
  if (!hasVisible) return null
  const rendered: ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block === undefined) continue
    switch (block.kind) {
      case 'text': {
        const imageResolver: MarkdownImageResolver | undefined = messageId === undefined || resolveMarkdownImage === undefined
          ? undefined
          : {
            resolve: ({ url, alt, index }) => {
              if (!isLocalMarkdownDestination(url)) return undefined
              const mapping = markdownImages.find(item =>
                item.messageId === messageId
                && item.textBlockIndex === i
                && item.imageIndex === index
                && item.destination === url)
              return (
                <LocalMarkdownImage
                  input={{ destination: url, alt, textBlockIndex: i, imageIndex: index }}
                  mapping={mapping}
                  messageId={messageId}
                  resolve={resolveMarkdownImage}
                  renderMessageImages={renderMessageImages}
                  t={t}
                />
              )
            },
          }
        rendered.push(
          <MarkdownText
            key={i}
            text={block.text}
            streaming={streaming}
            labels={labels}
            fileMentions={mentions}
            imageResolver={imageResolver}
          />,
        )
        break
      }
      case 'reasoning':
        rendered.push(
          <ProcessReasoning
            key={i}
            hidden={reasoningHidden}
            reveal={revealProcess}
          >
            <ReasoningRow text={block.text} running={streaming && i === last} t={t} />
          </ProcessReasoning>,
        )
        break
      case 'image': {
        // Consecutive image blocks share one gallery so several images tile
        // into rows instead of each opening a one-image group of its own.
        // Keyed by the group's FIRST block index: a streaming append that
        // extends the group then only grows `images` instead of remounting
        // the gallery under a shifted key.
        const start = i
        const group = [block]
        while (i + 1 < blocks.length) {
          const next = blocks[i + 1]
          if (next === undefined || next.kind !== 'image') break
          group.push(next)
          i += 1
        }
        rendered.push(
          <Fragment key={start}>
            {renderMessageImages({
              images: group.map(({ attachment }) => ({ attachment })),
              align: 'start',
            })}
          </Fragment>,
        )
        break
      }
      // Grouped into tool rows by ChatView; hasVisible above skips an empty shell.
      case 'tool-call':
        break
      default:
        rendered.push(
          <JsonBlock
            key={i}
            label={t('message.unknownBlock')}
            payload={block.block}
            truncatedLabel={total => t('json.truncated', { total })}
          />,
        )
    }
  }
  return (
    <div className={css.root} data-streaming={streaming || undefined}>
      <div className={css.body}>
        {rendered}
        {interrupted && <span className={css.stopped}>{t('message.stopped')}</span>}
      </div>
    </div>
  )
})

type LocalMarkdownImageInput = {
  readonly destination: string
  readonly alt: string
  readonly textBlockIndex: number
  readonly imageIndex: number
}

function isLocalMarkdownDestination(destination: string): boolean {
  if (destination.startsWith('//')) return false
  if (destination.startsWith('file:')) return true
  if (/^[A-Za-z]:[\\/]/.test(destination)) return true
  try {
    const protocol = new URL(destination).protocol
    return protocol !== 'http:' && protocol !== 'https:' && protocol === ''
  } catch {
    return !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(destination)
  }
}

function LocalMarkdownImage({
  input, mapping, messageId, resolve, renderMessageImages, t,
}: {
  input: LocalMarkdownImageInput
  mapping: AssistantMarkdownImage | undefined
  messageId: MessageId
  resolve: ChatNodeOwnerProps['resolveMarkdownImage'] | undefined
  renderMessageImages: ChatNodeOwnerProps['renderMessageImages']
  t: ChatViewSlotProps['t']
}) {
  const [resolved, setResolved] = useState<AssistantMarkdownImage | undefined>(mapping)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (mapping !== undefined) {
      setResolved(mapping)
      setFailed(false)
      return
    }
    setResolved(undefined)
    setFailed(false)
    if (resolve === undefined) return
    const controller = new AbortController()
    let live = true
    void resolve({
      messageId,
      textBlockIndex: input.textBlockIndex,
      imageIndex: input.imageIndex,
      destination: input.destination,
    }, controller.signal).then((result) => {
      if (!live) return
      if (result.ok) setResolved(result.value)
      else setFailed(true)
    }, () => {
      if (live) setFailed(true)
    })
    return () => {
      live = false
      controller.abort()
    }
  }, [attempt, input.destination, input.imageIndex, input.textBlockIndex, mapping, messageId, resolve])

  if (resolved !== undefined) {
    return renderMessageImages({
      images: [{ attachment: resolved.attachment }],
      align: 'start',
      inline: true,
    })
  }
  if (failed) {
    return (
      <button
        type="button"
        className={css.localImageRetry}
        title={t('message.localImage.failed')}
        aria-label={t('message.localImage.retry')}
        onClick={() => { setAttempt(value => value + 1) }}
      >
        {t('message.localImage.retry')}
      </button>
    )
  }
  return (
    <span className={css.localImageStatus} aria-live="polite">
      {t('message.localImage.loading')}
    </span>
  )
}

function ProcessReasoning({ hidden, reveal, children }: {
  hidden: boolean
  reveal?: (() => void) | undefined
  children: ReactNode
}) {
  const ref = useSearchableHidden(hidden, reveal ?? NOOP)
  return <div ref={ref} data-turn-process-inline={hidden || undefined}>{children}</div>
}

const NOOP = (): void => {}
