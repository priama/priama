/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import {
  __resetRenameSurfaceRegistry,
  commitRenameSession,
  reconcileRenameOwner,
  registerRenameSurface,
  requestRenameAfterCreate,
  unregisterRenameSurface,
  updateRenameDraft
} from '@/lib/pendingRename'
import { __resetRenameRequestIds } from '@/lib/renameSession'
import { defaultFictionCategories } from '@shared/categoryPresets'
import type { TreeNode } from '@shared/types'

function node(
  partial: Pick<TreeNode, 'id' | 'type' | 'parentId'> &
    Partial<Omit<TreeNode, 'id' | 'type' | 'parentId'>>
): TreeNode {
  return {
    title: partial.title ?? 'New Note',
    sortOrder: partial.sortOrder ?? 0,
    content: partial.content ?? '',
    metadata: partial.metadata ?? '{}',
    createdAt: partial.createdAt ?? '',
    updatedAt: partial.updatedAt ?? '',
    ...partial
  }
}

function mountInput(id = 'rename-input'): HTMLInputElement {
  const input = document.createElement('input')
  input.id = id
  document.body.appendChild(input)
  // happy-dom: give a non-zero layout box so visibility checks pass
  Object.defineProperty(input, 'getBoundingClientRect', {
    value: () => ({ width: 120, height: 24, top: 0, left: 0, bottom: 24, right: 120, x: 0, y: 0, toJSON: () => ({}) })
  })
  return input
}

beforeEach(() => {
  __resetRenameSurfaceRegistry()
  __resetRenameRequestIds()
  document.body.innerHTML = ''
  useAppStore.setState({
    categories: defaultFictionCategories(),
    nodes: [node({ id: 'n1', type: 'note', parentId: null, title: 'New Note' })],
    expandedSections: new Set(),
    renameSession: null
  })
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('rename DOM interaction regressions', () => {
  it('selects the default name once after focus', () => {
    const input = mountInput()
    requestRenameAfterCreate('n1', 'panel', 'sidebar')
    registerRenameSurface('n1', 'panel')
    reconcileRenameOwner('n1')

    const session = useAppStore.getState().renameSession!
    expect(session.owner).toBe('panel')
    input.value = session.draft
    input.focus()
    input.select()
    useAppStore.getState().markSelectAllConsumed(session.requestId)

    expect(document.activeElement).toBe(input)
    expect(useAppStore.getState().renameSession?.selectAllConsumed).toBe(true)

    // Typing after select-all replaces the draft without resetting from nodes.
    updateRenameDraft(session.requestId, 'a')
    useAppStore.getState().setNodes([
      node({ id: 'n1', type: 'note', parentId: null, title: 'New Note' })
    ])
    expect(useAppStore.getState().renameSession?.draft).toBe('a')
  })

  it('keeps draft through a delayed full sync (500ms UI broadcast)', () => {
    vi.useFakeTimers()
    requestRenameAfterCreate('n1', 'sidebar')
    const requestId = useAppStore.getState().renameSession!.requestId
    updateRenameDraft(requestId, 'Survives')

    vi.advanceTimersByTime(500)
    useAppStore.getState().applyNavigationSync({
      selectedNodeId: 'n1',
      selectedContainerId: null,
      selectedEntityId: null,
      selectedEntityType: null,
      selectedEntryId: null,
      selectedEntryCategoryId: null,
      expandedSections: ['notes'],
      rightPanelOpen: false,
      sectionOrder: []
    })
    useAppStore.getState().setNodes([
      node({ id: 'n1', type: 'note', parentId: null, title: 'New Note' })
    ])

    expect(useAppStore.getState().renameSession?.draft).toBe('Survives')
  })

  it('falls back when preferred surface is unmounted (collapsed sidebar)', () => {
    registerRenameSurface('n1', 'sidebar')
    registerRenameSurface('n1', 'container')
    requestRenameAfterCreate('n1', 'sidebar', 'container')
    expect(useAppStore.getState().renameSession?.owner).toBe('sidebar')

    // Collapsed sidebar unmounts tree rows
    unregisterRenameSurface('n1', 'sidebar')
    expect(useAppStore.getState().renameSession?.owner).toBe('container')
  })

  it('Enter then blur does not double-commit', async () => {
    const push = vi.fn(async (cmd: { execute: () => Promise<void> }) => {
      await cmd.execute()
      return 'id'
    })
    const history = await import('@/store/historyStore')
    history.useHistoryStore.setState({ push: push as never })

    const treeUpdate = vi.fn(async (_id: string, updates: { title: string }) => ({
      ...useAppStore.getState().nodes[0],
      title: updates.title
    }))
    // @ts-expect-error test stub
    window.electronAPI = { tree: { update: treeUpdate } }

    requestRenameAfterCreate('n1', 'panel')
    const requestId = useAppStore.getState().renameSession!.requestId
    updateRenameDraft(requestId, 'Final')

    expect(await commitRenameSession(requestId)).toBe(true)
    // Simulated blur after Enter
    expect(await commitRenameSession(requestId)).toBe(false)
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('rapid creates replace the prior session without leaking draft', () => {
    useAppStore.setState({
      nodes: [
        node({ id: 'a', type: 'note', parentId: null, title: 'New Note' }),
        node({ id: 'b', type: 'note', parentId: null, title: 'New Note' })
      ]
    })
    requestRenameAfterCreate('a', 'panel')
    const first = useAppStore.getState().renameSession!.requestId
    updateRenameDraft(first, 'First Draft')

    requestRenameAfterCreate('b', 'panel')
    const second = useAppStore.getState().renameSession!
    expect(second.requestId).not.toBe(first)
    expect(second.nodeId).toBe('b')
    expect(second.draft).toBe('New Note')

    updateRenameDraft(first, 'stale-write')
    expect(useAppStore.getState().renameSession?.draft).toBe('New Note')
  })
})
