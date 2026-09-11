// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { MessageImagesProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import { MarkdownImage } from '../src/client/MarkdownImage.tsx'

afterEach(cleanup)

const t = ((key: string, params?: Readonly<Record<string, unknown>>) => {
  const translated: Record<string, string> = {
    'image.label': '图片',
    'image.openOriginal': '查看原图',
    'image.loading': '图片加载中…',
    'image.loadFailed': '图片加载失败，点击重试',
    'image.preview': '原图预览',
    'image.closePreview': '关闭原图预览',
    'image.zoomIn': '放大原图',
    'image.zoomOut': '缩小原图',
    'image.resetZoom': '重置缩放',
  }
  if (key === 'image.openOriginalLabel') {
    const label = params?.label
    return `${typeof label === 'string' ? label : ''}，点击查看原图`
  }
  return translated[key] ?? key
}) as MessageImagesProps['t']

describe('MarkdownImage', () => {
  it('opens the final source URL in the shared image lightbox', () => {
    const src = '/api/file?path=C%3A%2Ftmp%2Fdiagram.png'
    const view = render(<MarkdownImage src={src} alt="diagram" destination="C:/tmp/diagram.png" t={t} />)

    const frame = view.getByRole('button', { name: 'diagram，点击查看原图' })
    expect(view.getByAltText('diagram').getAttribute('src')).toBe(src)
    fireEvent.click(frame)

    const dialog = view.getByRole('dialog', { name: '原图预览' })
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe(src)
    expect(view.getByRole('button', { name: '放大原图' })).toBeTruthy()
  })

  it('keeps the authored destination as the fallback when loading fails', () => {
    const view = render(<MarkdownImage src="/api/file?path=missing" alt="" destination="C:/tmp/missing.png" t={t} />)

    const image = view.container.querySelector('img')
    if (image === null) throw new Error('Markdown image was not rendered')
    fireEvent.error(image)

    expect(view.getByText('C:/tmp/missing.png')).toBeTruthy()
  })
})
