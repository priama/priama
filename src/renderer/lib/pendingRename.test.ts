import { describe, expect, it, beforeEach } from 'vitest'
import { useAppStore } from '@/store/appStore'
import {
  expandSidebarToNode,
  requestRenameAfterCreate,
  shouldAutoFocusPendingRename
} from '@/lib/pendingRename'
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

function manuscriptFolder(id: string, parentId: string | null): TreeNode {
  return node({
    id,
    parentId,
    type: 'folder',
    metadata: JSON.stringify({ scope: 'manuscript' })
  })
}

beforeEach(() => {
  useAppStore.setState({
    categories: defaultFictionCategories(),
    nodes: [],
    expandedSections: new Set(),
    pendingRenameNodeId: null,
    pendingRenameTargets: []
  })
})

describe('shouldAutoFocusPendingRename', () => {
  it('panel wins over sidebar and container', () => {
    useAppStore.setState({
      pendingRenameNodeId: 'n1',
      pendingRenameTargets: ['panel', 'sidebar', 'container']
    })
    expect(shouldAutoFocusPendingRename('panel')).toBe(true)
    expect(shouldAutoFocusPendingRename('sidebar')).toBe(false)
    expect(shouldAutoFocusPendingRename('container')).toBe(false)
  })

  it('sidebar wins over container alone', () => {
    useAppStore.setState({
      pendingRenameNodeId: 'n1',
      pendingRenameTargets: ['sidebar', 'container']
    })
    expect(shouldAutoFocusPendingRename('sidebar')).toBe(true)
    expect(shouldAutoFocusPendingRename('container')).toBe(false)
  })

  it('returns false when target is not in pending list', () => {
    useAppStore.setState({
      pendingRenameNodeId: 'n1',
      pendingRenameTargets: ['container']
    })
    expect(shouldAutoFocusPendingRename('sidebar')).toBe(false)
  })
})

describe('expandSidebarToNode', () => {
  it('expands manuscript for a nested scene', () => {
    const mf = manuscriptFolder('mf', null)
    const chapter = node({ id: 'ch', parentId: 'mf', type: 'chapter' })
    const scene = node({ id: 'sc', parentId: 'ch', type: 'scene' })
    useAppStore.setState({ nodes: [mf, chapter, scene] })

    expandSidebarToNode('sc')

    expect(useAppStore.getState().expandedSections.has('manuscript')).toBe(true)
    expect(useAppStore.getState().expandedSections.has('mf')).toBe(true)
  })

  it('expands the right category section for a nested entry', () => {
    const editorCategoryId = 'custom-entries'
    const categories = [
      ...defaultFictionCategories(),
      {
        id: editorCategoryId,
        name: 'Entries',
        icon: 'FileText',
        mode: 'editor' as const,
        sortOrder: 99,
        builtIn: false,
        nodeKind: 'entry' as const
      }
    ]
    const folder = node({
      id: 'ef',
      parentId: null,
      type: 'folder',
      metadata: JSON.stringify({ scope: 'entry' })
    })
    const entry = node({
      id: 'en',
      parentId: 'ef',
      type: 'entry',
      categoryId: editorCategoryId
    })
    useAppStore.setState({ categories, nodes: [folder, entry] })

    expandSidebarToNode('en')

    expect(useAppStore.getState().expandedSections.has(editorCategoryId)).toBe(true)
    expect(useAppStore.getState().expandedSections.has('ef')).toBe(true)
  })

  it('expands manuscript for a root-level manuscript folder', () => {
    const folder = manuscriptFolder('root-folder', null)
    useAppStore.setState({ nodes: [folder] })

    expandSidebarToNode('root-folder')

    expect(useAppStore.getState().expandedSections.has('manuscript')).toBe(true)
  })

  it('expands manuscript for a nested manuscript folder', () => {
    const outer = manuscriptFolder('outer', null)
    const inner = manuscriptFolder('inner', 'outer')
    useAppStore.setState({ nodes: [outer, inner] })

    expandSidebarToNode('inner')

    expect(useAppStore.getState().expandedSections.has('manuscript')).toBe(true)
    expect(useAppStore.getState().expandedSections.has('outer')).toBe(true)
  })
})

describe('requestRenameAfterCreate', () => {
  it('sets pending rename targets for multiple surfaces', () => {
    requestRenameAfterCreate('created-id', 'sidebar', 'container')

    const state = useAppStore.getState()
    expect(state.pendingRenameNodeId).toBe('created-id')
    expect(state.pendingRenameTargets).toEqual(['sidebar', 'container'])
  })

  it('no-ops for empty target list', () => {
    requestRenameAfterCreate('created-id')

    expect(useAppStore.getState().pendingRenameNodeId).toBeNull()
    expect(useAppStore.getState().pendingRenameTargets).toEqual([])
  })

  it('no-ops for null id', () => {
    requestRenameAfterCreate(null, 'sidebar')

    expect(useAppStore.getState().pendingRenameNodeId).toBeNull()
    expect(useAppStore.getState().pendingRenameTargets).toEqual([])
  })
})
