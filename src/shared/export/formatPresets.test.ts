import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_FORMATTING } from '../types'
import {
  MANUSCRIPT_SCENE_BREAK_MARKER,
  manuscriptFormatting,
  manuscriptHeaderText
} from './formatPresets'

describe('manuscriptHeaderText', () => {
  it('combines author and uppercased title', () => {
    expect(manuscriptHeaderText('The Long Field', 'Jane Smith')).toBe(
      'Jane Smith / THE LONG FIELD'
    )
  })

  it('drops empty sides', () => {
    expect(manuscriptHeaderText('The Long Field', '')).toBe('THE LONG FIELD')
    expect(manuscriptHeaderText('', 'Jane Smith')).toBe('Jane Smith')
    expect(manuscriptHeaderText('  ', '  ')).toBe('')
  })
})

describe('manuscriptFormatting', () => {
  const formatting = manuscriptFormatting('The Long Field', 'Jane Smith')

  it('matches the standard manuscript format agents expect', () => {
    expect(formatting.fontFamily).toBe('times')
    expect(formatting.fontSize).toBe(12)
    expect(formatting.lineSpacing).toBe('double')
    expect(formatting.marginPreset).toBe('normal')
    expect(formatting.pageSize).toBe('letter')
    expect(formatting.headerPageNumber).toBe(true)
    expect(formatting.headerText).toBe('Jane Smith / THE LONG FIELD')
    expect(formatting.sceneBreakMarker).toBe(MANUSCRIPT_SCENE_BREAK_MARKER)
  })

  it('is a per-export copy: mutating it leaves the shared defaults alone', () => {
    const before = JSON.stringify(DEFAULT_EXPORT_FORMATTING)
    formatting.fontSize = 14
    formatting.sceneBreakMarker = '*'
    expect(JSON.stringify(DEFAULT_EXPORT_FORMATTING)).toBe(before)
    expect(DEFAULT_EXPORT_FORMATTING.lineSpacing).toBe('single')
    expect(DEFAULT_EXPORT_FORMATTING.sceneBreakMarker).toBeNull()
    expect(DEFAULT_EXPORT_FORMATTING.headerPageNumber).toBe(false)
  })
})
