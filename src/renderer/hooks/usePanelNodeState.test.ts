import { describe, expect, it } from 'vitest'
import { shouldSyncNameFromTitle } from '@/hooks/usePanelNodeState'

describe('shouldSyncNameFromTitle', () => {
  it('returns true when no ref is provided', () => {
    expect(shouldSyncNameFromTitle(undefined, null)).toBe(true)
  })

  it('returns true when ref current is null', () => {
    expect(shouldSyncNameFromTitle({ current: null }, null)).toBe(true)
  })

  it('returns false when the name input is the active element', () => {
    const input = { id: 'name' } as HTMLInputElement
    expect(shouldSyncNameFromTitle({ current: input }, input)).toBe(false)
  })

  it('returns true when another element is focused', () => {
    const input = { id: 'name' } as HTMLInputElement
    const other = { id: 'other' } as HTMLInputElement
    expect(shouldSyncNameFromTitle({ current: input }, other)).toBe(true)
  })
})
