// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ImageLightbox } from '../src/ImageLightbox.tsx'

const labels = {
  dialog: '原图预览',
  close: '关闭原图预览',
  zoomIn: '放大原图',
  zoomOut: '缩小原图',
  resetZoom: '重置原图缩放',
}

let originalOverflow = ''
let originalTouchAction = ''

beforeEach(() => {
  originalOverflow = document.body.style.overflow
  originalTouchAction = document.body.style.touchAction
})

afterEach(() => {
  cleanup()
  document.body.style.overflow = originalOverflow
  document.body.style.touchAction = originalTouchAction
  vi.restoreAllMocks()
})

function wideImage(image: HTMLImageElement): void {
  vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(new DOMRect((window.innerWidth - 2000) / 2, (window.innerHeight - 1600) / 2, 2000, 1600))
}

describe('ImageLightbox', () => {
  it('focuses and traps the dialog, locks page input, closes, and restores the opener', () => {
    document.body.style.overflow = 'scroll'
    document.body.style.touchAction = 'pan-x'
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const onClose = vi.fn()
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={onClose} />)
    const close = view.getByRole('button', { name: labels.close })
    const zoomOut = view.getByRole('button', { name: labels.zoomOut })

    expect(document.activeElement).toBe(close)
    opener.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(zoomOut)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.touchAction).toBe('none')
    zoomOut.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(zoomOut)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(2)

    view.unmount()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.body.style.touchAction).toBe('pan-x')
    opener.remove()
  })

  it('tolerates a mount without a focus owner', () => {
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null })
    try {
      const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
      view.unmount()
    } finally {
      Reflect.deleteProperty(document, 'activeElement')
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

  it('zooms through controls and keyboard, wheel zooms around the pointer, and reset fits the image', () => {
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
    const image = view.getByRole('img') as HTMLImageElement
    wideImage(image)
    const zoomIn = view.getByRole('button', { name: labels.zoomIn })
    const zoomOut = view.getByRole('button', { name: labels.zoomOut })
    const reset = view.getByRole('button', { name: labels.resetZoom })

    fireEvent.click(zoomIn)
    expect(view.getByText('125%')).toBeTruthy()
    fireEvent.click(zoomOut)
    expect(view.getByText('100%')).toBeTruthy()
    fireEvent.keyDown(window, { key: '+' })
    expect(view.getByText('125%')).toBeTruthy()
    fireEvent.keyDown(window, { key: '-' })
    expect(view.getByText('100%')).toBeTruthy()
    fireEvent.wheel(image, { deltaY: -1, clientX: 100, clientY: 200 })
    expect(view.getByText('115%')).toBeTruthy()
    expect(image.style.transform).not.toContain('translate3d(0px, 0px, 0)')
    fireEvent.click(reset)
    expect(view.getByText('100%')).toBeTruthy()
    fireEvent.keyDown(window, { key: '0' })
    expect(image.style.transform).toContain('scale(1)')
  })

  it('clamps zoom controls to the supported minimum and maximum scales', () => {
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
    const zoomIn = view.getByRole('button', { name: labels.zoomIn })
    const zoomOut = view.getByRole('button', { name: labels.zoomOut })
    for (let index = 0; index < 20; index += 1) fireEvent.click(zoomIn)
    expect(view.getByText('800%')).toBeTruthy()
    for (let index = 0; index < 30; index += 1) fireEvent.click(zoomOut)
    expect(view.getByText('25%')).toBeTruthy()
  })

  it('toggles zoom on double click', () => {
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
    const image = view.getByRole('img') as HTMLImageElement
    fireEvent.doubleClick(image, { clientX: 100, clientY: 120 })
    expect(view.getByText('200%')).toBeTruthy()
    fireEvent.doubleClick(image, { clientX: 100, clientY: 120 })
    expect(view.getByText('100%')).toBeTruthy()
  })

  it('pans a zoomed image and ignores movement after pointer cancellation', () => {
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
    const image = view.getByRole('img') as HTMLImageElement
    wideImage(image)
    fireEvent.click(view.getByRole('button', { name: labels.zoomIn }))
    fireEvent.pointerDown(image, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 150, clientY: 140 })
    expect(image.style.transform).toContain('translate3d(50px, 40px, 0)')
    const settled = image.style.transform
    fireEvent.pointerCancel(image, { pointerId: 1, pointerType: 'mouse', clientX: 150, clientY: 140 })
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 190, clientY: 170 })
    expect(image.style.transform).toBe(settled)
  })

  it('pinches around the gesture center and releases the remaining pointer cleanly', () => {
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
    const image = view.getByRole('img') as HTMLImageElement
    wideImage(image)
    fireEvent.pointerDown(image, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 })
    fireEvent.pointerDown(image, { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 })
    fireEvent.pointerMove(image, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 })
    expect(view.getByText('200%')).toBeTruthy()
    fireEvent.pointerUp(image, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 })
    const settled = image.style.transform
    fireEvent.pointerCancel(image, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 })
    fireEvent.pointerMove(image, { pointerId: 2, pointerType: 'touch', clientX: 400, clientY: 100 })
    expect(image.style.transform).toBe(settled)
  })

  it('removes keyboard and wheel listeners when unmounted', () => {
    const onClose = vi.fn()
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={onClose} />)
    const image = view.getByRole('img')
    view.unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.wheel(image, { deltaY: -1 })
    expect(onClose).not.toHaveBeenCalled()
  })
})
