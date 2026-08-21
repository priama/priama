import type { ProjectSearchHit } from '@/lib/projectSearch'
import { openCategoryItem } from '@/lib/categoryNavigation'
import { isChapterFolder, isWikiEntityType } from '@/lib/treeUtils'
import { isWritingSurfaceNode } from '@/lib/writingSurface'
import { useAppStore } from '@/store/appStore'

/**
 * Navigate to a project-find hit and optionally hand off to in-doc SearchBar.
 * Closes the Spotlight overlay.
 */
export async function openProjectSearchHit(
  hit: ProjectSearchHit,
  query: string,
  caseSensitive: boolean
): Promise<void> {
  const {
    nodes,
    categories,
    setSelectedNodeId,
    openManuscriptInfo,
    setProjectFindOpen,
    setPendingDocumentSearch
  } = useAppStore.getState()

  const node = nodes.find((n) => n.id === hit.nodeId && !n.deletedAt)
  if (!node) {
    setProjectFindOpen(false)
    return
  }

  setProjectFindOpen(false)

  if (hit.source === 'synopsis') {
    setSelectedNodeId(node.id)
    openManuscriptInfo(node.id)
    return
  }

  if (hit.source === 'title' || hit.source === 'alias') {
    if (isWikiEntityType(node.type) || node.type === 'entry') {
      await openCategoryItem(node.id)
      return
    }
    if (node.type === 'chapter' && isChapterFolder(node)) {
      setSelectedNodeId(node.id)
      return
    }
    // Manuscript title hit on a writing surface — open doc, no in-doc search
    // (title text is not in the TipTap body).
    if (isWritingSurfaceNode(node, categories)) {
      setSelectedNodeId(node.id)
      return
    }
    setSelectedNodeId(node.id)
    return
  }

  // Prose (including note bodies)
  if (node.type === 'note') {
    await openCategoryItem(node.id)
    return
  }

  if (isWritingSurfaceNode(node, categories)) {
    setPendingDocumentSearch({
      nodeId: node.id,
      term: query,
      caseSensitive
    })
    setSelectedNodeId(node.id)
    return
  }

  await openCategoryItem(node.id)
}
