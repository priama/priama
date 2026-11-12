import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_EXPORT_FORMATTING,
  type BookSettings,
  type ExportSection
} from '../types'
import { buildEpubChapterHtml } from './epubHtml'
import { manuscriptFormatting } from './formatPresets'

const sections: ExportSection[] = [
  {
    id: 'c1',
    title: 'Alpha',
    level: 'chapter',
    html: '<p>Body text.</p>',
    displayHeading: 'Chapter 1: Alpha'
  },
  {
    id: 's1',
    title: 'Beta',
    level: 'scene',
    html: '<p>After break.</p>',
    displayHeading: null,
    sceneBreakBefore: true
  }
]

describe('buildEpubChapterHtml', () => {
  it('uses the project scene break marker and ebook spacing by default', () => {
    const html = buildEpubChapterHtml(sections, DEFAULT_EXPORT_FORMATTING, DEFAULT_BOOK_SETTINGS)
    expect(html).toContain('>* * *</p>')
    expect(html).toContain('Georgia')
    expect(html).toContain('line-height: 1.6;')
  })

  it('lets one export override the scene break marker without changing book settings', () => {
    const bookSettings: BookSettings = { ...DEFAULT_BOOK_SETTINGS }
    const html = buildEpubChapterHtml(
      sections,
      manuscriptFormatting('Book', 'Author'),
      bookSettings
    )
    expect(html).toContain('>#</p>')
    expect(html).not.toContain('* * *')
    expect(bookSettings.sceneBreakMarker).toBe('* * *')
  })

  it('applies Times New Roman and double spacing for the manuscript preset', () => {
    const html = buildEpubChapterHtml(
      sections,
      manuscriptFormatting('Book', 'Author'),
      DEFAULT_BOOK_SETTINGS
    )
    expect(html).toContain('"Times New Roman"')
    expect(html).toContain('line-height: 2;')
  })
})
