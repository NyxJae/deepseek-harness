import type { MessageImagesProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import { ImageGallery, MessageImage } from '../MessageImage.tsx'
import { messageImageLabels } from './labels.ts'

/** Historical message-image slot entry. */
export function MessageImages({ images, loadImage, align, inline, t }: MessageImagesProps) {
  const labels = messageImageLabels(t)
  const image = images[0]
  if (inline && image !== undefined && images.length === 1) {
    return <MessageImage image={image} load={loadImage} variant="single" labels={labels} />
  }
  return <ImageGallery images={images} load={loadImage} align={align} labels={labels} />
}
