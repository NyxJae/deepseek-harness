// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AssistantMarkdown, localPathMediaUrl, type AssistantMarkdownProps } from '../src/client/chat/AssistantMarkdown.tsx'
import type { ChatNodeOwnerProps, ChatViewSlotProps } from '../src/client/contract/slots.ts'
import type { AssistantBlock } from '../src/client/contract/snapshot.ts'

afterEach(cleanup)

const t = ((_key: string) => 'label') as unknown as ChatViewSlotProps['t']
const renderMessageImages = (() => null) as unknown as ChatNodeOwnerProps['renderMessageImages']

function textBlock(text: string): AssistantBlock {
  return { kind: 'text', text }
}

const ORIGIN = 'http://127.0.0.1:3080'

describe('localPathMediaUrl', () => {
  it('maps an absolute POSIX path on an HTTP page to the file API', () => {
    expect(localPathMediaUrl('http:', ORIGIN, '/tmp/graph.png'))
      .toBe(`${ORIGIN}/api/file?path=${encodeURIComponent('/tmp/graph.png')}`)
    expect(localPathMediaUrl('https:', 'https://127.0.0.1:3080', '/tmp/graph.png'))
      .toBe(`https://127.0.0.1:3080/api/file?path=${encodeURIComponent('/tmp/graph.png')}`)
  })

  it('keeps non-HTTP transports inert', () => {
    expect(localPathMediaUrl('file:', 'file:///app', '/tmp/graph.png')).toBeUndefined()
    expect(localPathMediaUrl('ws:', ORIGIN, '/tmp/graph.png')).toBeUndefined()
  })

  it('maps Windows drive-letter paths and keeps other destinations inert', () => {
    expect(localPathMediaUrl('http:', ORIGIN, '')).toBeUndefined()
    expect(localPathMediaUrl('http:', ORIGIN, '//cdn.example.com/x.png')).toBeUndefined()
    expect(localPathMediaUrl('http:', ORIGIN, 'relative.png')).toBeUndefined()
    expect(localPathMediaUrl('http:', ORIGIN, 'C:\\tmp\\x.png'))
      .toBe(`${ORIGIN}/api/file?path=${encodeURIComponent('C:\\tmp\\x.png')}`)
    expect(localPathMediaUrl('http:', ORIGIN, 'C:/tmp/x.png'))
      .toBe(`${ORIGIN}/api/file?path=${encodeURIComponent('C:/tmp/x.png')}`)
  })

  it('encodes the full path including spaces', () => {
    expect(localPathMediaUrl('http:', ORIGIN, '/tmp/my graph.png'))
      .toBe(`${ORIGIN}/api/file?path=${encodeURIComponent('/tmp/my graph.png')}`)
  })
})

describe('AssistantMarkdown local-path images', () => {
  it('renders a local image path in closing prose through the same-origin API', () => {
    const { container } = render(
      <AssistantMarkdown
        blocks={[textBlock('See ![diagram](/tmp/graph.png) for the layout.')]}
        streaming={false}
        renderMessageImages={renderMessageImages}
        t={t}
      />,
    )
    const image = container.querySelector('img')
    expect(image?.getAttribute('alt')).toBe('diagram')
    const url = new URL(image?.getAttribute('src') ?? '')
    expect(url.pathname).toBe('/api/file')
    expect(url.searchParams.get('path')).toBe('/tmp/graph.png')
  })

  it('keeps non-absolute destinations inert', () => {
    const { container } = render(
      <AssistantMarkdown
        blocks={[textBlock('See ![diagram](relative.png).')]}
        streaming={false}
        renderMessageImages={renderMessageImages}
        t={t}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('diagram')
  })
  it('routes settled local images through the presentation slot with the final URL', () => {
    const calls: Parameters<NonNullable<AssistantMarkdownProps['renderMarkdownImage']>>[0][] = []
    const renderMarkdownImage: NonNullable<AssistantMarkdownProps['renderMarkdownImage']> = (input) => {
      calls.push(input)
      return <button type="button" data-testid="markdown-image-presentation">{input.alt}</button>
    }
    const { container } = render(
      <AssistantMarkdown
        blocks={[textBlock('See ![diagram](/tmp/graph.png).')]}
        streaming={false}
        renderMessageImages={renderMessageImages}
        renderMarkdownImage={renderMarkdownImage}
        t={t}
      />,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      destination: '/tmp/graph.png',
      src: `${window.location.origin}/api/file?path=${encodeURIComponent('/tmp/graph.png')}`,
      alt: 'diagram',
    })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-testid="markdown-image-presentation"]')?.textContent).toBe('diagram')
  })
})
