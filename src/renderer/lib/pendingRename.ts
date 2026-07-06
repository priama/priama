import { useAppStore, type PendingRenameTarget } from '@/store/appStore'
import { getCategoryScopedChildren, getFolderScope, isFolder } from '@/lib/treeUtils'
import { categoryIdForWikiNodeType } from '@shared/categoryNodeKind'
import { folderScopeForCategory } from '@shared/categoryPresets'
import type { TreeNode } from '@shared/types'

export type { PendingRenameTarget }

function ensureSectionExpanded(sectionId: string): void {
  const { expandedSections, toggleSection } = useAppStore.getState()
  if (!expandedSections.has(sectionId)) toggleSection(sectionId)
}

/** After creating a node, set pending rename on one or more UI surfaces. */
export function requestRenameAfterCreate(
  createdId: string | null | undefined,
  ...targets: PendingRenameTarget[]
): void {
  if (!createdId || targets.length === 0) return
  if (targets.includes('sidebar')) expandSidebarToNode(createdId)
  useAppStore.getState().requestRename(createdId, ...targets)
}

export function expandSidebarToNode(nodeId: string): void {
  const state = useAppStore.getState()
  const node = state.nodes.find((n) => n.id === nodeId)
  if (!node) return

  let current: TreeNode | undefined = node
  const folderIds: string[] = []
  while (current?.parentId) {
    folderIds.push(current.parentId)
    current = state.nodes.find((n) => n.id === current!.parentId)
  }
  for (const folderId of folderIds.reverse()) {
    if (!state.expandedSections.has(folderId)) {
      state.toggleSection(folderId)
    }
  }

  if (node.type === 'chapter' || node.type === 'scene') {
    ensureSectionExpanded('manuscript')
  } else if (node.type === 'entry' && node.categoryId) {
    ensureSectionExpanded(node.categoryId)
  } else {
    const categoryId = categoryIdForWikiNodeType(node.type)
    if (categoryId) ensureSectionExpanded(categoryId)
  }

  if ((node.parentId ?? null) === null && isFolder(node)) {
    const scope = getFolderScope(node) ?? 'manuscript'
    expandSectionForScope(state.nodes, state.categories, scope, node.id)
  }
}

function expandSectionForScope(
  nodes: TreeNode[],
  categories: import('@shared/types').CategoryDefinition[],
  scope: string,
  folderId: string
): void {
  if (scope === 'manuscript') {
    ensureSectionExpanded('manuscript')
    return
  }
  if (scope === 'entry') {
    for (const cat of categories) {
      if (getCategoryScopedChildren(nodes, null, cat.id).some((n) => n.id === folderId)) {
        ensureSectionExpanded(cat.id)
        return
      }
    }
    return
  }
  const cat = categories.find((c) => folderScopeForCategory(c) === scope)
  if (cat) ensureSectionExpanded(cat.id)
}

export function requestSidebarRenameAfterCreate(createdId: string | null | undefined): void {
  requestRenameAfterCreate(createdId, 'sidebar')
}
