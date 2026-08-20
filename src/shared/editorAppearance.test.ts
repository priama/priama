import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDITOR_APPEARANCE,
  EDITOR_SIZE_DEFAULT,
  EDITOR_SIZE_MAX,
  EDITOR_SIZE_MIN,
  clampEditorAppearance,
  isSupportedFamily,
  stepEditorSize
} from './editorAppearance'

describe('clampEditorAppearance', () => {
  it('returns defaults for null/undefined/non-objects', () => {
    expect(clampEditorAppearance(null)).toEqual(DEFAULT_EDITOR_APPEARANCE)
    expect(clampEditorAppearance(undefined)).toEqual(DEFAULT_EDITOR_APPEARANCE)
    expect(clampEditorAppearance('Literata')).toEqual(DEFAULT_EDITOR_APPEARANCE)
    expect(clampEditorAppearance([])).toEqual(DEFAULT_EDITOR_APPEARANCE)
  })

  it('maps unknown fonts to Literata', () => {
    expect(clampEditorAppearance({ font: 'Comic Sans' }).font).toBe('Literata')
    expect(clampEditorAppearance({ font: 42 }).font).toBe('Literata')
  })

  it('accepts allowlisted fonts', () => {
    expect(clampEditorAppearance({ font: 'Inter' }).font).toBe('Inter')
    expect(clampEditorAppearance({ font: 'Georgia' }).font).toBe('Georgia')
  })

  it('clamps size to 16–24 and rounds', () => {
    expect(clampEditorAppearance({ size: 999 }).size).toBe(EDITOR_SIZE_MAX)
    expect(clampEditorAppearance({ size: 1 }).size).toBe(EDITOR_SIZE_MIN)
    expect(clampEditorAppearance({ size: 18.7 }).size).toBe(19)
    expect(clampEditorAppearance({ size: 'nope' }).size).toBe(EDITOR_SIZE_DEFAULT)
  })

  it('clamps leading and snaps to 0.125 steps', () => {
    expect(clampEditorAppearance({ leading: 3 }).leading).toBe(2)
    expect(clampEditorAppearance({ leading: 1 }).leading).toBe(1.4)
    expect(clampEditorAppearance({ leading: 1.7 }).leading).toBe(1.75)
  })

  it('clamps measure to 60–80', () => {
    expect(clampEditorAppearance({ measure: 100 }).measure).toBe(80)
    expect(clampEditorAppearance({ measure: 40 }).measure).toBe(60)
  })

  it('drops unknown keys and keeps valid ones', () => {
    const result = clampEditorAppearance({
      font: 'Lora',
      size: 20,
      leading: 1.5,
      measure: 70,
      evil: 'xss'
    })
    expect(result).toEqual({ font: 'Lora', size: 20, leading: 1.5, measure: 70 })
    expect(result).not.toHaveProperty('evil')
  })
})

describe('stepEditorSize', () => {
  it('increments and decrements within bounds', () => {
    const base = { ...DEFAULT_EDITOR_APPEARANCE, size: 18 }
    expect(stepEditorSize(base, 'in').size).toBe(19)
    expect(stepEditorSize(base, 'out').size).toBe(17)
  })

  it('stops at min/max', () => {
    expect(stepEditorSize({ ...DEFAULT_EDITOR_APPEARANCE, size: EDITOR_SIZE_MAX }, 'in').size).toBe(
      EDITOR_SIZE_MAX
    )
    expect(stepEditorSize({ ...DEFAULT_EDITOR_APPEARANCE, size: EDITOR_SIZE_MIN }, 'out').size).toBe(
      EDITOR_SIZE_MIN
    )
  })

  it('resets size only', () => {
    const current = { font: 'Inter' as const, size: 24, leading: 2, measure: 60 }
    expect(stepEditorSize(current, 'reset')).toEqual({
      font: 'Inter',
      size: EDITOR_SIZE_DEFAULT,
      leading: 2,
      measure: 60
    })
  })
})

describe('isSupportedFamily', () => {
  it('allows empty and allowlisted prefixes', () => {
    expect(isSupportedFamily('')).toBe(true)
    expect(isSupportedFamily('Literata, serif')).toBe(true)
    expect(isSupportedFamily('Inter, system-ui, sans-serif')).toBe(true)
  })

  it('rejects unknown families', () => {
    expect(isSupportedFamily('Comic Sans MS')).toBe(false)
    expect(isSupportedFamily('Arial')).toBe(false)
  })
})
