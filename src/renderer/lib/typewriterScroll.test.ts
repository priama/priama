import { describe, expect, it } from 'vitest'
import {
  caretScrollDelta,
  clampScrollTop,
  nextScrollTop,
  TYPEWRITER_RATIO
} from '@/lib/typewriterScroll'

describe('TYPEWRITER_RATIO', () => {
  it('defaults near mid-viewport', () => {
    expect(TYPEWRITER_RATIO).toBe(0.45)
  })
})

describe('clampScrollTop', () => {
  it('clamps to the scrollable range', () => {
    expect(clampScrollTop(-10, 1000, 400)).toBe(0)
    expect(clampScrollTop(900, 1000, 400)).toBe(600)
    expect(clampScrollTop(200, 1000, 400)).toBe(200)
  })
})

describe('caretScrollDelta', () => {
  it('returns zero when caret is already on the target line', () => {
    const delta = caretScrollDelta({
      caretTop: 100 + 400 * 0.45,
      scrollRectTop: 100,
      scrollRectHeight: 400
    })
    expect(Math.abs(delta)).toBeLessThan(0.001)
  })

  it('returns positive when caret is below the target', () => {
    const delta = caretScrollDelta({
      caretTop: 400,
      scrollRectTop: 100,
      scrollRectHeight: 400
    })
    expect(delta).toBeGreaterThan(0)
  })
})

describe('nextScrollTop', () => {
  it('moves scrollTop to pin the caret', () => {
    const next = nextScrollTop({
      scrollTop: 0,
      scrollHeight: 2000,
      clientHeight: 400,
      caretTop: 500,
      scrollRectTop: 0,
      scrollRectHeight: 400
    })
    expect(next).toBe(500 - 400 * 0.45)
  })

  it('does not change when already pinned', () => {
    const scrollTop = 100
    const next = nextScrollTop({
      scrollTop,
      scrollHeight: 2000,
      clientHeight: 400,
      caretTop: 0 + 400 * 0.45,
      scrollRectTop: 0,
      scrollRectHeight: 400
    })
    expect(next).toBe(scrollTop)
  })
})
