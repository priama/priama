import { describe, expect, it } from 'vitest'
import { DEFAULT_BOOK_SETTINGS, DEFAULT_EXPORT_FORMATTING } from '../types'
import {
  bodyLineHeight,
  docxFontName,
  docxLineSpacing,
  effectiveSceneBreakMarker,
  fontCssFamily
} from './formatting'

describe('docxFontName', () => {
  it('offers Times New Roman alongside Georgia and Calibri', () => {
    expect(docxFontName('serif')).toBe('Georgia')
    expect(docxFontName('sans')).toBe('Calibri')
    expect(docxFontName('times')).toBe('Times New Roman')
  })
})

describe('fontCssFamily', () => {
  it('maps times to a Times New Roman-first stack', () => {
    expect(fontCssFamily('times').startsWith('"Times New Roman"')).toBe(true)
  })

  it('keeps the existing serif and sans stacks', () => {
    expect(fontCssFamily('serif')).toContain('Georgia')
    expect(fontCssFamily('sans')).toContain('system-ui')
  })
})

describe('line spacing', () => {
  it('single keeps the ebook line height and leaves OOXML spacing unset', () => {
    expect(bodyLineHeight(DEFAULT_EXPORT_FORMATTING)).toBe(1.6)
    expect(docxLineSpacing(DEFAULT_EXPORT_FORMATTING)).toBeUndefined()
  })

  it('double becomes line-height 2 in CSS and 480 in OOXML', () => {
    const formatting = { ...DEFAULT_EXPORT_FORMATTING, lineSpacing: 'double' as const }
    expect(bodyLineHeight(formatting)).toBe(2)
    expect(docxLineSpacing(formatting)).toBe(480)
  })
})

describe('effectiveSceneBreakMarker', () => {
  it('falls back to the project book setting', () => {
    expect(effectiveSceneBreakMarker(DEFAULT_EXPORT_FORMATTING, DEFAULT_BOOK_SETTINGS)).toBe('* * *')
  })

  it('prefers the export-level override', () => {
    const formatting = { ...DEFAULT_EXPORT_FORMATTING, sceneBreakMarker: '#' }
    expect(effectiveSceneBreakMarker(formatting, DEFAULT_BOOK_SETTINGS)).toBe('#')
  })

  it('can silence the marker for one export without touching book settings', () => {
    const formatting = { ...DEFAULT_EXPORT_FORMATTING, sceneBreakMarker: '' }
    expect(effectiveSceneBreakMarker(formatting, DEFAULT_BOOK_SETTINGS)).toBe('')
    expect(DEFAULT_BOOK_SETTINGS.sceneBreakMarker).toBe('* * *')
  })
})
