import { describe, expect, it } from 'vitest'
import { RESIZE_HANDLE_PILL_HEIGHT, resizeHandlePillTop } from './resizeHandlePill'

describe('resizeHandlePillTop', () => {
  it('centers the pill on the pointer', () => {
    expect(resizeHandlePillTop(100, 400)).toBe(100 - RESIZE_HANDLE_PILL_HEIGHT / 2)
  })

  it('clamps to the top and bottom of the track', () => {
    expect(resizeHandlePillTop(0, 400)).toBe(0)
    expect(resizeHandlePillTop(400, 400)).toBe(400 - RESIZE_HANDLE_PILL_HEIGHT)
  })

  it('stays at the origin when the track is missing or shorter than the pill', () => {
    expect(resizeHandlePillTop(20, 0)).toBe(0)
    expect(resizeHandlePillTop(20, 20)).toBe(0)
    expect(resizeHandlePillTop(Number.NaN, 400)).toBe(0)
  })
})
