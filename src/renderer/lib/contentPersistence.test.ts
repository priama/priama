import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  markContentDirty,
  flushNode,
  flushAllDirty,
  registerActiveNoteContent,
  registerActiveEditor,
  resetPersistenceState,
  mergeIncomingNodes,
  __test__
} from '@/lib/contentPersistence'
import { computeRowsBaselineHeight } from '@/components/UI/auto-grow-textarea'
import type { TreeNode } from '@shared/types'

const updateMock = vi.fn()

beforeEach(() => {
  resetPersistenceState()
  registerActiveEditor(null)
  registerActiveNoteContent(null)
  updateMock.mockReset()
  updateMock.mockResolvedValue({})
  vi.stubGlobal('window', {
    electronAPI: {
      tree: { update: updateMock }
    }
  })
})

afterEach(() => {
  resetPersistenceState()
  registerActiveEditor(null)
  registerActiveNoteContent(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function node(partial: Partial<TreeNode> & Pick<TreeNode, 'id'>): TreeNode {
  return {
    parentId: null,
    type: 'note',
    title: 'Note',
    sortOrder: 0,
    content: '',
    metadata: '{}',
    createdAt: '',
    updatedAt: '',
    ...partial
  }
}

describe('computeRowsBaselineHeight', () => {
  it('uses rows and box metrics, not content', () => {
    expect(
      computeRowsBaselineHeight({
        lineHeightPx: 20,
        rows: 3,
        paddingTop: 8,
        paddingBottom: 8,
        borderTop: 1,
        borderBottom: 1
      })
    ).toBe(20 * 3 + 8 + 8 + 1 + 1)
  })

  it('falls back when line height is invalid', () => {
    expect(
      computeRowsBaselineHeight({
        lineHeightPx: NaN,
        rows: 2,
        paddingTop: 0,
        paddingBottom: 0,
        borderTop: 0,
        borderBottom: 0
      })
    ).toBe(40)
  })
})

describe('contentPersistence', () => {
  it('flushNode only captures active content for the requested node', async () => {
    registerActiveNoteContent(() => ({ nodeId: 'note-b', content: 'wrong note body' }))
    markContentDirty('note-a', 'keep me')

    await flushNode('note-a')

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith('note-a', { content: 'keep me' })
    expect(__test__.getDirtyContent('note-b')).toBeUndefined()
  })

  it('flushNode captures matching active note content', async () => {
    registerActiveNoteContent(() => ({ nodeId: 'note-a', content: 'from getter' }))

    await flushNode('note-a')

    expect(updateMock).toHaveBeenCalledWith('note-a', { content: 'from getter' })
  })

  it('preserves a newer edit made while an older write is in flight', async () => {
    let resolveWrite!: () => void
    let callCount = 0
    updateMock.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) {
        return new Promise((resolve) => {
          resolveWrite = () => resolve({})
        })
      }
      return Promise.resolve({})
    })

    markContentDirty('n1', 'first')
    const first = __test__.persistNow('n1')

    await vi.waitFor(() => expect(__test__.isPersisting('n1')).toBe(true))

    markContentDirty('n1', 'second')
    resolveWrite()
    await first

    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2))
    expect(updateMock).toHaveBeenLastCalledWith('n1', { content: 'second' })
    await vi.waitFor(() => expect(__test__.getDirtyContent('n1')).toBeUndefined())
  })

  it('mergeIncomingNodes prefers active note content', () => {
    registerActiveNoteContent(() => ({ nodeId: 'n1', content: 'local' }))
    const merged = mergeIncomingNodes([
      node({ id: 'n1', content: 'disk' }),
      node({ id: 'n2', content: 'other' })
    ])
    expect(merged[0].content).toBe('local')
    expect(merged[1].content).toBe('other')
  })

  it('flushAllDirty captures all active editors then persists', async () => {
    registerActiveEditor(() => ({ nodeId: 'chapter-1', content: 'editor body' }))
    registerActiveNoteContent(() => ({ nodeId: 'note-1', content: 'note body' }))

    await flushAllDirty()

    expect(updateMock).toHaveBeenCalledWith('chapter-1', { content: 'editor body' })
    expect(updateMock).toHaveBeenCalledWith('note-1', { content: 'note body' })
  })
})
