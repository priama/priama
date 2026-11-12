import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_EXPORT_FORMATTING,
  type ExportSection
} from '@shared/types'
import { manuscriptFormatting } from '@shared/export/formatPresets'
import { buildManuscriptHtml } from './htmlTemplate'

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

describe('buildManuscriptHtml', () => {
  it('uses the project scene break marker and ebook spacing by default', () => {
    const html = buildManuscriptHtml(
      'Book',
      'Author',
      sections,
      DEFAULT_EXPORT_FORMATTING,
      DEFAULT_BOOK_SETTINGS
    )
    expect(html).toContain('>* * *</p>')
    expect(html).toContain('Georgia')
    expect(html).toContain('line-height: 1.6;')
  })

  it('applies the manuscript preset for one export: Times, double spacing, # breaks', () => {
    const html = buildManuscriptHtml(
      'Book',
      'Author',
      sections,
      manuscriptFormatting('Book', 'Author'),
      DEFAULT_BOOK_SETTINGS
    )
    expect(html).toContain('>#</p>')
    expect(html).not.toContain('>* * *</p>')
    expect(html).toContain('"Times New Roman"')
    expect(html).toContain('line-height: 2;')
  })
})
