import { useCallback, useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { ImageLightbox } from '../ImageLightbox.tsx'
import { messageImageLabels } from './labels.ts'
import css from './MarkdownImage.module.css'

/** Props for the settled Markdown image presentation slot. */
export interface MarkdownImageProps {
  /** Authored Markdown destination. */
  readonly destination: string
  /** Final display URL after Markdown protocol and local-path resolution. */
  readonly src: string
  /** Authored alternative text. */
  readonly alt: string
  /** Conversation namespace translator for image controls and fallback text. */
  t: TranslateNS<'conversation'>
}

/**
 * Present one settled Markdown image at its natural responsive size and open the
 * same source in the shared zoomable lightbox.
 * @param props - resolved image source, authored text, destination, and locale.
 * @returns the clickable image or its authored fallback.
 */
export function MarkdownImage({ src, alt, destination, t }: MarkdownImageProps) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const labels = useMemo(() => messageImageLabels(t), [t])
  const close = useCallback(() => { setOpen(false) }, [])
  const label = alt || destination

  if (failed) return <span className={css.imageAlt}>{label}</span>
  return (
    <>
      <button
        type="button"
        className={css.frame}
        title={labels.open}
        aria-label={labels.openNamed(label)}
        onClick={() => { setOpen(true) }}
      >
        <img
          className={css.image}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => { setFailed(true) }}
        />
      </button>
      {open && <ImageLightbox src={src} alt={label} labels={labels.lightbox} onClose={close} />}
    </>
  )
}
