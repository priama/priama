import { describe, expect, it } from 'vitest'
import {
  normalizeSidebarWidth,
  SIDEBAR_EXPANDED_MIN_WIDTH,
  SIDEBAR_ICON_ONLY_THRESHOLD,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  sidebarWidthOnProjectOpen
} from './types'

describe('normalizeSidebarWidth', () => {
  it('maps fully hidden and icon-rail widths to the icon rail', () => {
    expect(normalizeSidebarWidth(0)).toBe(SIDEBAR_MIN_WIDTH)
    expect(normalizeSidebarWidth(-10)).toBe(SIDEBAR_MIN_WIDTH)
    expect(normalizeSidebarWidth(SIDEBAR_MIN_WIDTH)).toBe(SIDEBAR_MIN_WIDTH)
    expect(normalizeSidebarWidth(SIDEBAR_ICON_ONLY_THRESHOLD)).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('snaps leftover mid widths to the default expanded width', () => {
    expect(normalizeSidebarWidth(SIDEBAR_ICON_ONLY_THRESHOLD + 1)).toBe(SIDEBAR_MAX_WIDTH)
    expect(normalizeSidebarWidth(SIDEBAR_EXPANDED_MIN_WIDTH - 1)).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('keeps widths in the expanded band', () => {
    expect(normalizeSidebarWidth(SIDEBAR_EXPANDED_MIN_WIDTH)).toBe(SIDEBAR_EXPANDED_MIN_WIDTH)
    expect(normalizeSidebarWidth(260)).toBe(260)
    expect(normalizeSidebarWidth(SIDEBAR_MAX_WIDTH)).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('clamps oversized and invalid values', () => {
    expect(normalizeSidebarWidth(400)).toBe(SIDEBAR_MAX_WIDTH)
    expect(normalizeSidebarWidth(Number.NaN)).toBe(SIDEBAR_MAX_WIDTH)
  })
})

describe('sidebarWidthOnProjectOpen', () => {
  it('keeps an already expanded width', () => {
    expect(sidebarWidthOnProjectOpen(260, SIDEBAR_MAX_WIDTH)).toBe(260)
  })

  it('restores the last expanded width when the rail is collapsed', () => {
    expect(sidebarWidthOnProjectOpen(SIDEBAR_MIN_WIDTH, 260)).toBe(260)
  })

  it('falls back to the default expanded width', () => {
    expect(sidebarWidthOnProjectOpen(SIDEBAR_MIN_WIDTH, SIDEBAR_MIN_WIDTH)).toBe(SIDEBAR_MAX_WIDTH)
  })
})
