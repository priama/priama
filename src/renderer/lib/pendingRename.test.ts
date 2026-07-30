import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import {
  __resetRenameSurfaceRegistry,
  cancelRenameSession,
  commitRenameSession,
  markRenameFocusFailed,
  reconcileRenameOwner,
  registerRenameSurface,
  requestRenameAfterCreate,
  shouldAutoFocusPendingRename,
  unregisterRenameSurface,
  updateRenameDraft
} from '@/lib/pendingRename'
import {
  __resetRenameRequestIds,
  pickBestMountedSurface,
  shouldShowRenameEditor
} from '@/lib/renameSession'
import { defaultFictionCategories } from '@shared/categoryPresets'
import type { TreeNode } from '@shared/types'

function node(
  partial: Pick<TreeNode, 'id' | 'type' | 'parentId'> &
    Partial<Omit<TreeNode, 'id' | 'type' | 'parentId'>>
): TreeNode {
  return {
    title: partial.title ?? 'Node',
    sortOrder: partial.sortOrder ?? 0,
    content: partial.content ?? '',
    metadata: partial.metadata ?? '{}',
    createdAt: partial.createdAt ?? '',
    updatedAt: partial.updatedAt ?? '',
    ...partial
  }
}

beforeEach(() => {
  __resetRenameSurfaceRegistry()
  __resetRenameRequestIds()
  useAppStore.setState({
    categories: defaultFictionCategories(),
    nodes: [node({ id: 'n1', type: 'folder', parentId: null, title: 'New Folder' })],
    expandedSections: new Set(),
    renameSession: null
  })
})

describe('pickBestMountedSurface', () => {
  it('respects preferred order, not global panel>sidebar>container', () => {
    expect(pickBestMountedSurface(['container', 'sidebar'], ['sidebar', 'container'])).toBe(
      'container'
    )
    expect(pickBestMountedSurface(['sidebar', 'container'], ['sidebar', 'container'])).toBe(
      'sidebar'
    )
  })

  it('falls back to the next preferred mounted surface', () => {
    expect(pickBestMountedSurface(['panel', 'sidebar'], ['sidebar'])).toBe('sidebar')
    expect(pickBestMountedSurface(['panel', 'sidebar'], [])).toBeNull()
  })
})

describe('rename session draft durability', () => {
  it('initializes draft once and ignores later node title refreshes', () => {
    requestRenameAfterCreate('n1', 'sidebar', 'container')
    const requestId = useAppStore.getState().renameSession!.requestId
    updateRenameDraft(requestId, 'Typed Name')

    useAppStore.getState().setNodes([
      node({ id: 'n1', type: 'folder', parentId: null, title: 'New Folder' })
    ])
    useAppStore.getState().updateNodeInStore('n1', { title: 'New Folder' })

    expect(useAppStore.getState().renameSession?.draft).toBe('Typed Name')
    expect(useAppStore.getState().renameSession?.requestId).toBe(requestId)
  })

  it('preserves rename session through navigation sync', () => {
    requestRenameAfterCreate('n1', 'sidebar')
    const requestId = useAppStore.getState().renameSession!.requestId
    updateRenameDraft(requestId, 'Keep Me')

    useAppStore.getState().applyNavigationSync({
      selectedNodeId: null,
      selectedContainerId: 'manuscript',
      selectedEntityId: null,
      selectedEntityType: null,
      selectedEntryId: null,
      selectedEntryCategoryId: null,
      expandedSections: ['manuscript'],
      rightPanelOpen: false,
      sectionOrder: []
    })

    expect(useAppStore.getState().renameSession?.draft).toBe('Keep Me')
    expect(useAppStore.getState().renameSession?.requestId).toBe(requestId)
  })

  it('cancels when the node disappears from the tree', () => {
    requestRenameAfterCreate('n1', 'sidebar')
    useAppStore.getState().setNodes([])
    expect(useAppStore.getState().renameSession).toBeNull()
  })
})

describe('owner claiming and fallback', () => {
  it('claims the first preferred mounted surface', () => {
    registerRenameSurface('n1', 'sidebar')
    registerRenameSurface('n1', 'container')
    requestRenameAfterCreate('n1', 'container', 'sidebar')

    expect(useAppStore.getState().renameSession?.owner).toBe('container')
    expect(shouldShowRenameEditor(useAppStore.getState().renameSession, 'container', 'n1')).toBe(
      true
    )
    expect(shouldShowRenameEditor(useAppStore.getState().renameSession, 'sidebar', 'n1')).toBe(
      false
    )
  })

  it('transfers ownership when preferred surface focus fails', () => {
    registerRenameSurface('n1', 'panel')
    registerRenameSurface('n1', 'sidebar')
    requestRenameAfterCreate('n1', 'panel', 'sidebar')
    expect(useAppStore.getState().renameSession?.owner).toBe('panel')

    const requestId = useAppStore.getState().renameSession!.requestId
    markRenameFocusFailed(requestId, 'panel')
    useAppStore.getState().releaseRenameOwner(requestId, 'panel')
    reconcileRenameOwner('n1')

    expect(useAppStore.getState().renameSession?.owner).toBe('sidebar')
  })

  it('unregisters transfer ownership to remaining surface', () => {
    registerRenameSurface('n1', 'container')
    registerRenameSurface('n1', 'sidebar')
    requestRenameAfterCreate('n1', 'container', 'sidebar')
    expect(useAppStore.getState().renameSession?.owner).toBe('container')

    unregisterRenameSurface('n1', 'container')
    expect(useAppStore.getState().renameSession?.owner).toBe('sidebar')
  })
})

describe('stale request protection', () => {
  it('ignores draft updates and clears from a superseded request', () => {
    requestRenameAfterCreate('n1', 'sidebar')
    const first = useAppStore.getState().renameSession!.requestId
    requestRenameAfterCreate('n1', 'container')
    const second = useAppStore.getState().renameSession!.requestId
    expect(second).not.toBe(first)

    updateRenameDraft(first, 'stale')
    expect(useAppStore.getState().renameSession?.draft).toBe('New Folder')

    updateRenameDraft(second, 'fresh')
    expect(useAppStore.getState().renameSession?.draft).toBe('fresh')

    useAppStore.getState().clearRenameSessionIf(first)
    expect(useAppStore.getState().renameSession?.requestId).toBe(second)
  })

  it('commit is idempotent by request id', async () => {
    const treeUpdate = vi.fn(
      async (_id: string, updates: Partial<{ title: string }>) => ({
        id: 'n1',
        type: 'folder' as const,
        parentId: null,
        title: updates.title ?? 'New Folder',
        sortOrder: 0,
        content: '',
        metadata: '{}',
        createdAt: '',
        updatedAt: ''
      })
    )
    vi.stubGlobal('window', {
      electronAPI: { tree: { update: treeUpdate } }
    })

    const history = await import('@/store/historyStore')
    const push = vi.fn(async (cmd: { execute: () => Promise<void> }) => {
      await cmd.execute()
      return null
    })
    history.useHistoryStore.setState({ push: push as never })

    requestRenameAfterCreate('n1', 'sidebar')
    const requestId = useAppStore.getState().renameSession!.requestId
    updateRenameDraft(requestId, 'Renamed')

    const first = await commitRenameSession(requestId)
    const second = await commitRenameSession(requestId)
    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(useAppStore.getState().renameSession).toBeNull()
    expect(push).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('Escape cancels without committing', () => {
    requestRenameAfterCreate('n1', 'sidebar')
    const requestId = useAppStore.getState().renameSession!.requestId
    updateRenameDraft(requestId, 'Nope')
    cancelRenameSession(requestId)
    expect(useAppStore.getState().renameSession).toBeNull()
  })
})

describe('shouldAutoFocusPendingRename', () => {
  it('follows preferred order before ownership', () => {
    useAppStore.getState().startRenameSession({
      nodeId: 'n1',
      originalTitle: 'New Folder',
      preferredSurfaces: ['container', 'sidebar']
    })
    expect(shouldAutoFocusPendingRename('container')).toBe(true)
    expect(shouldAutoFocusPendingRename('sidebar')).toBe(false)
  })

  it('follows claimed owner once set', () => {
    const requestId = useAppStore.getState().startRenameSession({
      nodeId: 'n1',
      originalTitle: 'New Folder',
      preferredSurfaces: ['panel', 'sidebar']
    })
    useAppStore.getState().claimRenameOwner(requestId, 'sidebar')
    expect(shouldAutoFocusPendingRename('panel')).toBe(false)
    expect(shouldAutoFocusPendingRename('sidebar')).toBe(true)
  })
})

describe('requestRenameAfterCreate', () => {
  it('starts a session with preferred surfaces', () => {
    requestRenameAfterCreate('n1', 'sidebar', 'container')
    const session = useAppStore.getState().renameSession
    expect(session?.nodeId).toBe('n1')
    expect(session?.preferredSurfaces).toEqual(['sidebar', 'container'])
    expect(session?.draft).toBe('New Folder')
    expect(session?.originalTitle).toBe('New Folder')
  })

  it('no-ops for empty target list or null id', () => {
    requestRenameAfterCreate('n1')
    expect(useAppStore.getState().renameSession).toBeNull()
    requestRenameAfterCreate(null, 'sidebar')
    expect(useAppStore.getState().renameSession).toBeNull()
  })
})
