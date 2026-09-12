import { describe, expect, it } from 'vitest'
import { resolveCollapsibleWidth } from './collapsiblePanelWidth'
import {
  SIDEBAR_COLLAPSE_WIDTH,
  SIDEBAR_EXPAND_WIDTH,
  SIDEBAR_EXPANDED_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH
} from '@shared/types'

const opts = {
  min: SIDEBAR_EXPANDED_MIN_WIDTH,
  max: SIDEBAR_MAX_WIDTH,
  collapseBelow: SIDEBAR_COLLAPSE_WIDTH,
  expandAbove: SIDEBAR_EXPAND_WIDTH,
  collapsedWidth: SIDEBAR_MIN_WIDTH
}

describe('resolveCollapsibleWidth', () => {
  it('allows a small shrink while expanded', () => {
    expect(resolveCollapsibleWidth(260, { ...opts, wasOpen: true })).toBe(260)
  })

  it('clamps to the expanded min instead of a mid size', () => {
    expect(resolveCollapsibleWidth(220, { ...opts, wasOpen: true })).toBe(SIDEBAR_EXPANDED_MIN_WIDTH)
  })

  it('collapses to the icon rail when dragged below the threshold', () => {
    expect(resolveCollapsibleWidth(180, { ...opts, wasOpen: true })).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('stays on the icon rail until the drag crosses the expand threshold', () => {
    expect(resolveCollapsibleWidth(80, { ...opts, wasOpen: false })).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('snaps open to at least expanded min once the expand threshold is crossed', () => {
    expect(resolveCollapsibleWidth(SIDEBAR_EXPAND_WIDTH, { ...opts, wasOpen: false })).toBe(
      SIDEBAR_EXPANDED_MIN_WIDTH
    )
    expect(resolveCollapsibleWidth(250, { ...opts, wasOpen: false })).toBe(250)
    expect(resolveCollapsibleWidth(400, { ...opts, wasOpen: false })).toBe(SIDEBAR_MAX_WIDTH)
  })
})
