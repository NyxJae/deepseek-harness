import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconCloseOutline16,
  IconFullscreenOutline16,
  IconPlusOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ImageLightbox.module.css'

/** Lightbox strings the owner resolves from its own locale namespace. */
export interface ImageLightboxLabels {
  /** Accessible name of the preview dialog. */
  dialog: string
  /** Accessible label of the close control. */
  close: string
  /** Accessible label of the zoom-in control. */
  zoomIn: string
  /** Accessible label of the zoom-out control. */
  zoomOut: string
  /** Accessible label of the fit/reset control. */
  resetZoom: string
}

type Transform = { readonly scale: number; readonly x: number; readonly y: number }
type Point = { readonly x: number; readonly y: number }
type PointerPoint = Point & { readonly pointerId: number }
type Gesture =
  | { readonly kind: 'pan'; readonly pointerId: number; readonly start: Point; readonly origin: Transform }
  | { readonly kind: 'pinch'; readonly distance: number; readonly center: Point; readonly origin: Transform }

const INITIAL_TRANSFORM: Transform = { scale: 1, x: 0, y: 0 }
const MIN_SCALE = 0.25
const MAX_SCALE = 8

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

function pointerDistance(first: Point, second: Point): number {
  return Math.max(1, Math.hypot(second.x - first.x, second.y - first.y))
}

function pointerCenter(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

/**
 * Document-level original-image preview opened by clicking a thumbnail.
 * The viewer owns focus, scroll locking, keyboard controls, and pointer
 * gestures; the opener only controls whether the component is mounted.
 *
 * @param props.src - the original image URL.
 * @param props.alt - the image's alt text.
 * @param props.labels - dialog, control, and close-control strings.
 * @param props.onClose - dismiss callback owned by the opener.
 * @returns the modal preview dialog.
 */
export function ImageLightbox({ src, alt, labels, onClose }: {
  src: string
  alt: string
  labels: ImageLightboxLabels
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const pointersRef = useRef(new Map<number, PointerPoint>())
  const gestureRef = useRef<Gesture | null>(null)
  const transformRef = useRef<Transform>(INITIAL_TRANSFORM)
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM)

  const clampTransform = (next: Transform): Transform => {
    const image = imageRef.current
    const current = transformRef.current
    const rect = image?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0 || rect.height === 0) return next
    const baseWidth = rect.width / current.scale
    const baseHeight = rect.height / current.scale
    const maxX = Math.max(0, (baseWidth * next.scale - window.innerWidth) / 2)
    const maxY = Math.max(0, (baseHeight * next.scale - window.innerHeight) / 2)
    return {
      scale: next.scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  const updateTransform = (next: Transform): void => {
    const bounded = clampTransform(next)
    transformRef.current = bounded
    setTransform(bounded)
  }

  const resetTransform = (): void => {
    updateTransform(INITIAL_TRANSFORM)
  }

  const zoomAt = (factor: number, clientX: number, clientY: number): void => {
    const current = transformRef.current
    const nextScale = clampScale(current.scale * factor)
    if (nextScale === current.scale) return
    const rect = imageRef.current?.getBoundingClientRect()
    const centerX = rect === undefined ? window.innerWidth / 2 : rect.left + rect.width / 2
    const centerY = rect === undefined ? window.innerHeight / 2 : rect.top + rect.height / 2
    const ratio = nextScale / current.scale
    updateTransform({
      scale: nextScale,
      x: current.x - (clientX - centerX) * (ratio - 1),
      y: current.y - (clientY - centerY) * (ratio - 1),
    })
  }

  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    closeRef.current?.focus()

    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomAt(1.25, window.innerWidth / 2, window.innerHeight / 2)
        return
      }
      if (event.key === '-') {
        event.preventDefault()
        zoomAt(0.8, window.innerWidth / 2, window.innerHeight / 2)
        return
      }
      if (event.key === '0') {
        event.preventDefault()
        resetTransform()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (dialog === null) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      zoomAt(event.deltaY < 0 ? 1.15 : 0.87, event.clientX, event.clientY)
    }
    imageRef.current?.addEventListener('wheel', onWheel, { passive: false })
    const onResize = (): void => { updateTransform(transformRef.current) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      imageRef.current?.removeEventListener('wheel', onWheel)
      // Embedded test DOMs and older WebViews may omit pointer capture methods.
      // oxlint-disable-next-line typescript/no-unnecessary-condition -- Pointer capture is optional at runtime.
      for (const pointerId of pointersRef.current.keys()) imageRef.current?.releasePointerCapture?.(pointerId)
      pointersRef.current.clear()
      gestureRef.current = null
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
      if (restoreRef.current?.isConnected === true) restoreRef.current.focus()
    }
  }, [onClose])

  const onPointerDown = (event: React.PointerEvent<HTMLImageElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Embedded test DOMs and older WebViews may omit pointer capture methods.
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- Pointer capture is optional at runtime.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const pointers = pointersRef.current
    pointers.set(event.pointerId, { pointerId: event.pointerId, x: event.clientX, y: event.clientY })
    const current = transformRef.current
    if (pointers.size >= 2) {
      const [first, second] = [...pointers.values()]
      if (first === undefined || second === undefined) return
      gestureRef.current = {
        kind: 'pinch',
        distance: pointerDistance(first, second),
        center: pointerCenter(first, second),
        origin: current,
      }
    } else {
      gestureRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        origin: current,
      }
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLImageElement>): void => {
    const pointers = pointersRef.current
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { pointerId: event.pointerId, x: event.clientX, y: event.clientY })
    const gesture = gestureRef.current
    if (gesture?.kind === 'pinch' && pointers.size >= 2) {
      const [first, second] = [...pointers.values()]
      if (first === undefined || second === undefined) return
      const distance = pointerDistance(first, second)
      const center = pointerCenter(first, second)
      const nextScale = clampScale(gesture.origin.scale * distance / gesture.distance)
      const ratio = nextScale / gesture.origin.scale
      const viewportCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      updateTransform({
        scale: nextScale,
        x: gesture.origin.x + (center.x - gesture.center.x) - (gesture.center.x - viewportCenter.x) * (ratio - 1),
        y: gesture.origin.y + (center.y - gesture.center.y) - (gesture.center.y - viewportCenter.y) * (ratio - 1),
      })
      return
    }
    if (gesture?.kind === 'pan') {
      updateTransform({
        scale: gesture.origin.scale,
        x: gesture.origin.x + event.clientX - gesture.start.x,
        y: gesture.origin.y + event.clientY - gesture.start.y,
      })
    }
  }

  const onPointerEnd = (event: React.PointerEvent<HTMLImageElement>): void => {
    // Embedded test DOMs and older WebViews may omit pointer capture methods.
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- Pointer capture is optional at runtime.
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const pointers = pointersRef.current
    pointers.delete(event.pointerId)
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0]
      if (remaining === undefined) return
      gestureRef.current = {
        kind: 'pan',
        pointerId: remaining.pointerId,
        start: { x: remaining.x, y: remaining.y },
        origin: transformRef.current,
      }
    } else if (pointers.size === 0) {
      gestureRef.current = null
    }
  }

  const onDoubleClick = (event: React.MouseEvent<HTMLImageElement>): void => {
    if (transformRef.current.scale > 1.05) resetTransform()
    else zoomAt(2, event.clientX, event.clientY)
  }

  return createPortal(
    <div
      ref={dialogRef}
      className={css.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialog}
    >
      <div className={css.mask} aria-hidden="true" onMouseDown={onClose} />
      <div className={css.imageStage}>
        <img
          ref={imageRef}
          className={css.image}
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onDoubleClick={onDoubleClick}
          onLoad={() => { updateTransform(transformRef.current) }}
        />
      </div>
      <div className={css.controls} role="toolbar" aria-label={labels.dialog}>
        <button
          type="button"
          className={css.control}
          aria-label={labels.zoomOut}
          title={labels.zoomOut}
          onClick={() => { zoomAt(0.8, window.innerWidth / 2, window.innerHeight / 2) }}
        >
          <span className={css.minusIcon} aria-hidden="true" />
        </button>
        <span className={css.zoomLevel} aria-live="polite">{Math.round(transform.scale * 100)}%</span>
        <button
          type="button"
          className={css.control}
          aria-label={labels.zoomIn}
          title={labels.zoomIn}
          onClick={() => { zoomAt(1.25, window.innerWidth / 2, window.innerHeight / 2) }}
        >
          <IconPlusOutline16 size={16} />
        </button>
        <button type="button" className={css.control} aria-label={labels.resetZoom} title={labels.resetZoom} onClick={resetTransform}>
          <IconFullscreenOutline16 size={16} />
        </button>
      </div>
      <button ref={closeRef} type="button" className={css.close} aria-label={labels.close} title={labels.close} onClick={onClose}>
        <IconCloseOutline16 size={16} />
      </button>
    </div>,
    document.body,
  )
}
