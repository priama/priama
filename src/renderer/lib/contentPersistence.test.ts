import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  markContentDirty,
  flushNode,
  flushAllDirty,
  getLiveContent,
  getUnsavedContent,
  hasUnpersistedChanges,
  publishUnsavedContent,
  registerActiveNoteContent,
  registerActiveEditor,
  resetPersistenceState,
  mergeIncomingNodes,
  __test__
} from '@/lib/contentPersistence'
import { computeRowsBaselineHeight } from '@/components/UI/auto-grow-textarea'
import { useAppStore } from '@/store/appStore'
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

describe('typing hot path and the store', () => {
  const storedContent = (id: string): string | undefined =>
    useAppStore.getState().nodes.find((n) => n.id === id)?.content

  beforeEach(() => {
    useAppStore.setState({
      nodes: [node({ id: 'scene-1', type: 'scene', content: '<p>saved</p>' })],
      isDirty: false
    })
  })

  it('keystrokes leave the store alone until the write lands, then patch it once', async () => {
    const nodeChanges = vi.fn()
    const notifications = vi.fn()
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      notifications()
      if (state.nodes !== prev.nodes) nodeChanges()
    })

    markContentDirty('scene-1', '<p>s</p>')
    markContentDirty('scene-1', '<p>sa</p>')
    markContentDirty('scene-1', '<p>sav</p>')

    expect(nodeChanges).not.toHaveBeenCalled()
    expect(storedContent('scene-1')).toBe('<p>saved</p>')
    // Only the clean → dirty flip notifies; repeated setDirty(true) is a no-op.
    expect(notifications).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().isDirty).toBe(true)

    await __test__.persistNow('scene-1')

    expect(updateMock).toHaveBeenCalledWith('scene-1', { content: '<p>sav</p>' })
    expect(storedContent('scene-1')).toBe('<p>sav</p>')
    expect(nodeChanges).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().isDirty).toBe(false)
    unsubscribe()
  })

  it('does not patch the store with a write that newer typing already superseded', async () => {
    let resolveFirst!: () => void
    updateMock.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = () => resolve({})))
    )

    markContentDirty('scene-1', '<p>first</p>')
    const first = __test__.persistNow('scene-1')
    await vi.waitFor(() => expect(__test__.isPersisting('scene-1')).toBe(true))

    const seen: (string | undefined)[] = []
    const unsubscribe = useAppStore.subscribe(() => seen.push(storedContent('scene-1')))
    markContentDirty('scene-1', '<p>second</p>')
    resolveFirst()
    await first

    await vi.waitFor(() => expect(storedContent('scene-1')).toBe('<p>second</p>'))
    expect(seen).not.toContain('<p>first</p>')
    unsubscribe()
  })

  it('keeps a failed write dirty for a later retry instead of looping', async () => {
    updateMock.mockRejectedValue(new Error('disk full'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    markContentDirty('scene-1', '<p>unsaved</p>')
    await __test__.persistNow('scene-1')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(getUnsavedContent('scene-1')).toBe('<p>unsaved</p>')
    expect(hasUnpersistedChanges()).toBe(true)
    expect(storedContent('scene-1')).toBe('<p>saved</p>')

    updateMock.mockResolvedValue({})
    await flushNode('scene-1')
    expect(storedContent('scene-1')).toBe('<p>unsaved</p>')
    expect(hasUnpersistedChanges()).toBe(false)
    consoleError.mockRestore()
  })

  it('publishUnsavedContent copies pending text into the store without writing', () => {
    markContentDirty('scene-1', '<p>pending</p>')

    publishUnsavedContent('scene-1')

    expect(storedContent('scene-1')).toBe('<p>pending</p>')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('getLiveContent prefers the open buffer, then unsaved text, then the store copy', () => {
    useAppStore.setState({
      nodes: [
        node({ id: 'open', content: 'store' }),
        node({ id: 'pending', content: 'store' }),
        node({ id: 'clean', content: 'store' })
      ]
    })
    registerActiveEditor(() => ({ nodeId: 'open', content: 'editor buffer' }))
    markContentDirty('open', 'older keystrokes')
    markContentDirty('pending', 'unsaved')

    expect(getLiveContent('open', 'stale object')).toBe('editor buffer')
    expect(getLiveContent('pending', 'stale object')).toBe('unsaved')
    expect(getLiveContent('clean', 'stale object')).toBe('store')
    expect(getLiveContent('missing', 'fallback')).toBe('fallback')
  })
})
