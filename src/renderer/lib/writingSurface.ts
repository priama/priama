import type {
  CategoryDefinition,
  EntityHighlights,
  TreeNode,
  TypewriterScrolling
} from '@shared/types'
import { findCategory, categoryOpensInMainEditor } from '@shared/categoryView'
import { resolveCategoryForNode } from '@shared/categoryNodeKind'
import { isChapterFolder, isSimpleChapter } from '@/lib/treeUtils'

/** True when this node is an editable main-editor document (scene, simple chapter, or editor-mode entry). */
export function isWritingSurfaceNode(
  node: TreeNode | null | undefined,
  categories: CategoryDefinition[]
): boolean {
  if (!node || node.deletedAt) return false
  if (node.type === 'scene') return true
  if (node.type === 'chapter' && isSimpleChapter(node)) return true
  if (node.type === 'entry' || node.type === 'note') {
    const categoryId = resolveCategoryForNode(node)
    if (categoryOpensInMainEditor(findCategory(categories, categoryId))) return true
  }
  return false
}

/**
 * True when the center pane is showing a live TipTap writing surface
 * (not a container grid, scenes-chapter list, or panel-only entity).
 */
export function isWritingSurfaceOpen(params: {
  selectedContainerId: string | null
  selectedNode: TreeNode | null | undefined
  categories: CategoryDefinition[]
}): boolean {
  const { selectedContainerId, selectedNode, categories } = params
  if (selectedContainerId !== null) return false
  if (!selectedNode) return false
  if (isChapterFolder(selectedNode)) return false
  return isWritingSurfaceNode(selectedNode, categories)
}

export function entityHighlightsVisible(
  preference: EntityHighlights,
  focusMode: boolean
): boolean {
  if (preference === 'off') return false
  if (preference === 'hide-in-focus' && focusMode) return false
  return true
}

export function typewriterEnabled(
  preference: TypewriterScrolling,
  focusMode: boolean
): boolean {
  if (preference === 'off') return false
  if (preference === 'on') return true
  return focusMode
}

/** Focus chrome is active only when the preference is on and a writing surface is open. */
export function focusChromeActive(focusMode: boolean, writingSurfaceOpen: boolean): boolean {
  return focusMode && writingSurfaceOpen
}
