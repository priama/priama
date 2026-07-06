import {
  categoryOpensInMainEditor,
  categoryOpensInRightPanel,
  findCategory
} from '@shared/categoryView'
import { resolveCategoryForNode, wikiNodeTypeForCategory } from '@shared/categoryNodeKind'
import type { TreeNode } from '@shared/types'
import { mergeIncomingNodes } from '@/lib/contentPersistence'
import { makeCreateNodeCommand } from '@/lib/commands'
import { requestRenameAfterCreate, requestSidebarRenameAfterCreate } from '@/lib/pendingRename'
import { folderContainerId, isFolder, isWikiEntityType } from '@/lib/treeUtils'
import { useAppStore, type PendingRenameTarget } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'

export type CreateSource = 'sidebar' | 'container'

export type OpenCategoryOptions = {
  renameAfterCreate?: boolean
  source?: CreateSource
  renameTarget?: PendingRenameTarget
}

/** Ensure node exists in store: local → entity.getById → tree.getAll. */
export async function ensureNodeInStore(nodeId: string): Promise<TreeNode | null> {
  const store = useAppStore.getState()
  const local = store.nodes.find((n) => n.id === nodeId)
  if (local) return local

  const fetched = await window.electronAPI.entity.getById(nodeId)
  if (fetched) {
    store.upsertNode(fetched)
    return fetched
  }

  const all = await window.electronAPI.tree.getAll()
  store.setNodes(mergeIncomingNodes(all))
  return useAppStore.getState().nodes.find((n) => n.id === nodeId) ?? null
}

export function resolveRenameTargetForNode(
  node: TreeNode,
  source: CreateSource
): PendingRenameTarget {
  if (node.type === 'note') return 'panel'

  const { categories } = useAppStore.getState()
  const categoryId = resolveCategoryForNode(node)
  const category = findCategory(categories, categoryId)

  if (categoryOpensInRightPanel(category)) return 'panel'
  if (source === 'container') return 'container'
  return 'sidebar'
}

function dispatchRenameAfterCreate(nodeId: string, target: PendingRenameTarget): void {
  if (target === 'sidebar') {
    requestSidebarRenameAfterCreate(nodeId)
    return
  }
  queueMicrotask(() => requestRenameAfterCreate(nodeId, target))
}

function applyRenameAfterCreate(node: TreeNode, opts?: OpenCategoryOptions): void {
  if (opts?.renameTarget) {
    dispatchRenameAfterCreate(node.id, opts.renameTarget)
    return
  }

  if (!opts?.renameAfterCreate) return

  const target = resolveRenameTargetForNode(node, opts.source ?? 'sidebar')
  dispatchRenameAfterCreate(node.id, target)
}

export function selectCategoryHeader(categoryId: string): void {
  useAppStore.getState().selectContainer(categoryId)
}

export async function openPanelCategoryItem(
  node: TreeNode,
  categoryId: string | null,
  opts?: OpenCategoryOptions
): Promise<void> {
  const resolvedCategoryId = categoryId ?? resolveCategoryForNode(node)
  const { selectEntry, setSelectedEntity } = useAppStore.getState()

  if (isWikiEntityType(node.type)) {
    setSelectedEntity(node.id, node.type)
  } else if (node.type === 'entry') {
    if (!resolvedCategoryId) return
    selectEntry(node.id, resolvedCategoryId)
  } else if (node.type === 'note') {
    setSelectedEntity(node.id, node.type)
  } else {
    return
  }

  if (opts?.renameAfterCreate || opts?.renameTarget) {
    applyRenameAfterCreate(node, opts)
  }
}

export async function openEditorCategoryItem(
  node: TreeNode,
  _categoryId: string | null,
  opts?: OpenCategoryOptions
): Promise<void> {
  useAppStore.getState().setSelectedNodeId(node.id)
  if (opts?.renameAfterCreate || opts?.renameTarget) {
    applyRenameAfterCreate(node, opts)
  }
}

/** Single router for category item clicks and open-after-create. */
export async function openCategoryItem(
  nodeId: string,
  opts?: OpenCategoryOptions
): Promise<void> {
  const node = await ensureNodeInStore(nodeId)
  if (!node) return

  if (isFolder(node)) {
    useAppStore.getState().selectContainer(folderContainerId(node.id))
    return
  }

  if (node.type === 'chapter' || node.type === 'scene') {
    useAppStore.getState().setSelectedNodeId(node.id)
    return
  }

  const { categories } = useAppStore.getState()
  const categoryId = resolveCategoryForNode(node)
  const category = findCategory(categories, categoryId)

  if (node.type === 'note') {
    await openPanelCategoryItem(node, categoryId, opts)
    return
  }

  if (categoryOpensInRightPanel(category)) {
    await openPanelCategoryItem(node, categoryId, opts)
    return
  }

  if (categoryOpensInMainEditor(category)) {
    await openEditorCategoryItem(node, categoryId, opts)
  }
}

export async function createCategoryItem(
  categoryId: string,
  parentId: string | null,
  source: CreateSource
): Promise<string | null> {
  const { categories } = useAppStore.getState()
  const category = findCategory(categories, categoryId)
  const title = category ? `New ${category.name.replace(/s$/, '')}` : 'New Entry'

  const wikiType = wikiNodeTypeForCategory(categoryId)
  const createdId = await useHistoryStore.getState().push(
    wikiType
      ? makeCreateNodeCommand({ parentId, type: wikiType, title })
      : makeCreateNodeCommand({ parentId, type: 'entry', title, categoryId })
  )
  if (!createdId) return null

  await openCategoryItem(createdId, { renameAfterCreate: true, source })
  return createdId
}
