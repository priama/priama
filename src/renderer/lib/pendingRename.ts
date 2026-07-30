import { useAppStore, type PendingRenameTarget } from '@/store/appStore'
import { getCategoryScopedChildren, getFolderScope } from '@/lib/treeUtils'
import { categoryIdForWikiNodeType } from '@shared/categoryNodeKind'
import { folderScopeForCategory } from '@shared/categoryPresets'
import { makeRenameCommand } from '@/lib/commands'
import { useHistoryStore } from '@/store/historyStore'
import {
  pickBestMountedSurface,
  type RenameSurface,
  type RenameSession
} from '@/lib/renameSession'
import type { TreeNode } from '@shared/types'

export type { PendingRenameTarget, RenameSurface, RenameSession }

/** Surfaces currently mounted for a given node id. */
const mountedByNode = new Map<string, Set<RenameSurface>>()

/** Surfaces that failed to obtain focus for a given request (cleared when session ends). */
const focusFailedByRequest = new Map<string, Set<RenameSurface>>()

export function registerRenameSurface(nodeId: string, surface: RenameSurface): void {
  let set = mountedByNode.get(nodeId)
  if (!set) {
    set = new Set()
    mountedByNode.set(nodeId, set)
  }
  set.add(surface)
  reconcileRenameOwner(nodeId)
}

export function unregisterRenameSurface(nodeId: string, surface: RenameSurface): void {
  const set = mountedByNode.get(nodeId)
  if (!set) return
  set.delete(surface)
  if (set.size === 0) mountedByNode.delete(nodeId)

  const store = useAppStore.getState()
  const session = store.renameSession
  if (session?.nodeId === nodeId && session.owner === surface) {
    store.releaseRenameOwner(session.requestId, surface)
  }
  reconcileRenameOwner(nodeId)
}

export function getMountedRenameSurfaces(nodeId: string): RenameSurface[] {
  return [...(mountedByNode.get(nodeId) ?? [])]
}

export function markRenameFocusFailed(requestId: string, surface: RenameSurface): void {
  let set = focusFailedByRequest.get(requestId)
  if (!set) {
    set = new Set()
    focusFailedByRequest.set(requestId, set)
  }
  set.add(surface)
}

function clearFocusFailed(requestId: string): void {
  focusFailedByRequest.delete(requestId)
}

function getFocusFailed(requestId: string): Set<RenameSurface> {
  return focusFailedByRequest.get(requestId) ?? new Set()
}

/** Claim / transfer ownership to the best currently mounted preferred surface. */
export function reconcileRenameOwner(nodeId?: string): RenameSurface | null {
  const store = useAppStore.getState()
  const session = store.renameSession
  if (!session) return null
  if (nodeId !== undefined && session.nodeId !== nodeId) return null
  if (session.phase === 'committing') return session.owner

  const failed = getFocusFailed(session.requestId)
  const mounted = getMountedRenameSurfaces(session.nodeId).filter((s) => !failed.has(s))
  const best = pickBestMountedSurface(session.preferredSurfaces, mounted)
  if (!best) {
    // All mounted preferred surfaces failed — retry from scratch with all mounted.
    const anyMounted = pickBestMountedSurface(
      session.preferredSurfaces,
      getMountedRenameSurfaces(session.nodeId)
    )
    if (anyMounted && session.owner !== anyMounted) {
      clearFocusFailed(session.requestId)
      store.claimRenameOwner(session.requestId, anyMounted)
      return anyMounted
    }
    return session.owner
  }

  if (session.owner !== best) {
    store.claimRenameOwner(session.requestId, best)
  }
  return best
}

/**
 * @deprecated Prefer isRenameOwner / reconcileRenameOwner.
 * Kept for temporary call-site compatibility; returns true only for the current owner.
 */
export function shouldAutoFocusPendingRename(target: PendingRenameTarget): boolean {
  const session = useAppStore.getState().renameSession
  if (!session || !session.preferredSurfaces.includes(target)) return false
  if (session.owner) return session.owner === target
  return session.preferredSurfaces[0] === target
}

function ensureSectionExpanded(sectionId: string): void {
  const { expandedSections, toggleSection } = useAppStore.getState()
  if (!expandedSections.has(sectionId)) toggleSection(sectionId)
}

/**
 * Start a durable rename transaction after create.
 * Draft is initialized once from the node title and never reset from later node syncs.
 */
export function requestRenameAfterCreate(
  createdId: string | null | undefined,
  ...targets: PendingRenameTarget[]
): void {
  if (!createdId || targets.length === 0) return
  if (targets.includes('sidebar')) expandSidebarToNode(createdId)

  const store = useAppStore.getState()
  const node = store.nodes.find((n) => n.id === createdId)
  const title = node?.title ?? ''
  const requestId = store.startRenameSession({
    nodeId: createdId,
    originalTitle: title,
    preferredSurfaces: targets
  })
  clearFocusFailed(requestId)
  reconcileRenameOwner(createdId)
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
  } else if (node.type === 'folder') {
    const scope = getFolderScope(node) ?? 'manuscript'
    expandSectionForScope(state.nodes, state.categories, scope, node.id)
  } else {
    const categoryId = categoryIdForWikiNodeType(node.type)
    if (categoryId) ensureSectionExpanded(categoryId)
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

/** Commit rename: persist title via history, then clear session if still the same request. */
export async function commitRenameSession(
  requestId: string,
  options?: { title?: string }
): Promise<boolean> {
  const store = useAppStore.getState()
  const session = store.renameSession
  if (!session || session.requestId !== requestId) return false
  if (session.phase === 'committing') return false

  store.setRenamePhase(requestId, 'committing')
  const nextTitle = (options?.title ?? session.draft).trim() || session.originalTitle

  try {
    if (nextTitle !== session.originalTitle) {
      await useHistoryStore.getState().push(
        makeRenameCommand({
          id: session.nodeId,
          oldTitle: session.originalTitle,
          newTitle: nextTitle
        })
      )
    }
  } finally {
    clearFocusFailed(requestId)
    store.clearRenameSessionIf(requestId)
  }
  return true
}

export function cancelRenameSession(requestId?: string): void {
  const store = useAppStore.getState()
  const session = store.renameSession
  if (session) clearFocusFailed(session.requestId)
  store.cancelRenameSession(requestId)
}

export function updateRenameDraft(requestId: string, draft: string): void {
  useAppStore.getState().updateRenameDraft(requestId, draft)
}

/** Test helper — clear mount registry. */
export function __resetRenameSurfaceRegistry(): void {
  mountedByNode.clear()
  focusFailedByRequest.clear()
}
