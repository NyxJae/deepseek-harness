/** Host-side Markdown image occurrence projection tests. */

import { describe, expect, it } from 'vitest'
import { extractMarkdownImages } from '../src/markdown-images.ts'

describe('local Markdown image projection', () => {
  it('keeps nested GFM images and resolved references in document order', () => {
    const images = extractMarkdownImages([
      'before ![first](first.png)',
      '',
      '> **inside** ![second][second]',
      '',
      '[second]: second.webp',
      '',
      '![third](third.gif)',
    ].join('\n'))

    expect(images).toEqual([
      { index: 0, destination: 'first.png', alt: 'first' },
      { index: 1, destination: 'second.webp', alt: 'second' },
      { index: 2, destination: 'third.gif', alt: 'third' },
    ])
  })

  it('keeps the first definition when image references repeat an identifier', () => {
    expect(extractMarkdownImages('![picture][image]\n\n[image]: first.png\n[image]: second.png')).toEqual([
      { index: 0, destination: 'first.png', alt: 'picture' },
    ])
  })

  it('does not count an unresolved image reference that remains literal text', () => {
    expect(extractMarkdownImages('![missing][unknown]\n\n![loaded](loaded.jpg)')).toEqual([
      { index: 0, destination: 'loaded.jpg', alt: 'loaded' },
    ])
  })
})
