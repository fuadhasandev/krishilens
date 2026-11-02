import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { SegmentationViewer } from './SegmentationViewer'

describe('SegmentationViewer', () => {
  it('toggles a returned overlay without removing the original image', async () => {
    await i18n.changeLanguage('en')
    const { container } = render(
      <SegmentationViewer
        height={100}
        originalUrl="/original.png"
        overlayUrl="/overlay.png"
        width={100}
      />,
    )

    expect(container.querySelectorAll('img')).toHaveLength(3)
    const toggle = screen.getByRole('button', { name: 'Hide segmentation overlay' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Show segmentation overlay' })).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelectorAll('img')).toHaveLength(2)
    expect(screen.getByAltText('Uploaded crop image')).toBeInTheDocument()
  })

  it('explains when no overlay was returned', async () => {
    await i18n.changeLanguage('en')
    render(
      <SegmentationViewer
        height={100}
        originalUrl="/original.png"
        overlayUrl={null}
        width={100}
      />,
    )

    expect(screen.getByText('A segmentation overlay is not available for this image.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show segmentation overlay' })).not.toBeInTheDocument()
  })
})
