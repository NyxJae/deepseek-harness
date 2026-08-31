// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ImageLightbox } from '../src/ImageLightbox.tsx'

afterEach(cleanup)

const labels = {
  dialog: '原图预览',
  close: '关闭原图预览',
  zoomIn: '放大原图',
  zoomOut: '缩小原图',
  resetZoom: '重置缩放',
}

describe('ImageLightbox', () => {
  it('focuses its close control, closes by button and Escape, and restores focus', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const onClose = vi.fn()
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={onClose} />)
    const close = view.getByRole('button', { name: '关闭原图预览' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(window, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(2)
    view.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('tolerates a focus owner it cannot restore (no active element at mount)', () => {
    // jsdom always reports body as the fallback active element; stub the
    // element-less state a detached focus can leave.
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null })
    try {
      const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
      view.unmount()
    } finally {
      delete (document as { activeElement?: unknown }).activeElement
    }
  })

  it('closes on a mask press but not on a press over the image', () => {
    const onClose = vi.fn()
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={onClose} />)
    fireEvent.mouseDown(view.getByRole('img'))
    expect(onClose).not.toHaveBeenCalled()
    const mask = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.mouseDown(mask)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks page scrolling, traps focus, and controls zoom with keyboard and wheel input', () => {
    document.body.style.overflow = 'scroll'
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
    const close = view.getByRole('button', { name: labels.close })
    const zoomIn = view.getByRole('button', { name: labels.zoomIn })
    const zoomOut = view.getByRole('button', { name: labels.zoomOut })
    const reset = view.getByRole('button', { name: labels.resetZoom })
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(close)

    fireEvent.click(zoomIn)
    expect(view.getByText('125%')).toBeTruthy()
    fireEvent.keyDown(window, { key: '0' })
    expect(view.getByText('100%')).toBeTruthy()
    fireEvent.wheel(view.getByRole('img'), { deltaY: -100, clientX: 100, clientY: 100 })
    expect(view.getByText('115%')).toBeTruthy()
    fireEvent.click(reset)
    expect(view.getByText('100%')).toBeTruthy()

    close.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(zoomOut)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(close)
    view.unmount()
    expect(document.body.style.overflow).toBe('scroll')
    document.body.style.overflow = ''
  })

  it('supports touch pinch zoom and continues with one-finger pan', () => {
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
    const image = view.getByRole('img')
    fireEvent.pointerDown(image, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 })
    fireEvent.pointerDown(image, { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 })
    fireEvent.pointerMove(image, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 })
    expect(view.getByText('200%')).toBeTruthy()
    fireEvent.pointerUp(image, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 })
    const beforePan = image.getAttribute('style')
    fireEvent.pointerMove(image, { pointerId: 1, pointerType: 'touch', clientX: 130, clientY: 120 })
    expect(image.getAttribute('style')).not.toBe(beforePan)
    expect(image.getAttribute('style')).toContain('scale(2)')
    fireEvent.pointerUp(image, { pointerId: 1, pointerType: 'touch', clientX: 130, clientY: 120 })
  })

  it('supports pointer drag and double-click reset', () => {
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
    const image = view.getByRole('img')
    fireEvent.pointerDown(image, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(image, { pointerId: 1, pointerType: 'mouse', clientX: 60, clientY: 45 })
    expect(image.getAttribute('style')).toContain('translate3d(40px, 25px, 0)')
    fireEvent.pointerUp(image, { pointerId: 1, pointerType: 'mouse', clientX: 60, clientY: 45 })
    fireEvent.doubleClick(image, { clientX: 80, clientY: 80 })
    expect(view.getByText('200%')).toBeTruthy()
    fireEvent.doubleClick(image, { clientX: 80, clientY: 80 })
    expect(view.getByText('100%')).toBeTruthy()
  })
})
