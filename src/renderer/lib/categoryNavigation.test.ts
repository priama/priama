import { describe, expect, it, beforeEach } from 'vitest'
import { resolveRenameTargetsForNode } from '@/lib/categoryNavigation'
import { useAppStore } from '@/store/appStore'
import { defaultFictionCategories } from '@shared/categoryPresets'
import { BUILTIN_CATEGORY_IDS } from '@shared/types'
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

const editorCategoryId = 'custom-entries'

beforeEach(() => {
  useAppStore.setState({
    categories: [
      ...defaultFictionCategories(),
      {
        id: editorCategoryId,
        name: 'Entries',
        icon: 'FileText',
        mode: 'editor',
        sortOrder: 99,
        builtIn: false,
        nodeKind: 'entry'
      }
    ]
  })
})

describe('resolveRenameTargetsForNode', () => {
  it('notes rename like any other main-editor item, not in the panel', () => {
    const note = node({ id: 'n1', parentId: null, type: 'note' })
    expect(resolveRenameTargetsForNode(note, 'sidebar')).toEqual(['sidebar', 'container'])
    expect(resolveRenameTargetsForNode(note, 'container')).toEqual(['container', 'sidebar'])
  })

  it('panel-mode category nodes rename in panel and sidebar', () => {
    const character = node({ id: 'c1', parentId: null, type: 'character' })
    expect(resolveRenameTargetsForNode(character, 'sidebar')).toEqual(['panel', 'sidebar'])
    expect(resolveRenameTargetsForNode(character, 'container')).toEqual(['panel', 'sidebar'])
  })

  it('main-editor entry from container includes container and sidebar', () => {
    const entry = node({
      id: 'e1',
      parentId: null,
      type: 'entry',
      categoryId: editorCategoryId
    })
    expect(resolveRenameTargetsForNode(entry, 'container')).toEqual(['container', 'sidebar'])
  })

  it('main-editor entry from sidebar prefers sidebar with container fallback', () => {
    const entry = node({
      id: 'e1',
      parentId: null,
      type: 'entry',
      categoryId: editorCategoryId
    })
    expect(resolveRenameTargetsForNode(entry, 'sidebar')).toEqual(['sidebar', 'container'])
  })

  it('uses built-in characters category as panel mode', () => {
    const character = node({
      id: 'c1',
      parentId: null,
      type: 'character',
      categoryId: BUILTIN_CATEGORY_IDS.characters
    })
    expect(resolveRenameTargetsForNode(character, 'sidebar')).toEqual(['panel', 'sidebar'])
  })
})
