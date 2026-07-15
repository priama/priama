import { makeReparentCommand } from '@/lib/commands'
import { getFolderScope, getSceneChapters, isSimpleChapter } from '@/lib/treeUtils'
import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import type { FolderScope, TreeNode } from '@shared/types'
import type { MoveToFolder } from '@/components/Tree/TreeContextMenu'

export const MOVE_TO_ROOT = '__root__'

export type { MoveToFolder }

export type SidebarMenuActions = {
  scope: FolderScope
  foldersAtRoot: MoveToFolder[]
  foldersNested: MoveToFolder[]
  sceneChapters?: MoveToFolder[]
  onMoveToFolder: (node: TreeNode, folderId: string) => void
  onMoveToChapter?: (node: TreeNode, chapterId: string) => void
  onConvertToSimpleChapter?: (node: TreeNode) => void
  onConvertToSceneChapter?: (node: TreeNode) => void
  onConvertSimpleToSceneChapter?: (node: TreeNode) => void
  onMoveTo?: (node: TreeNode) => void
}

export function listFoldersForScope(nodes: TreeNode[], scope: FolderScope): MoveToFolder[] {
  return nodes
    .filter((n) => !n.deletedAt && n.type === 'folder' && getFolderScope(n) === scope)
    .map((n) => ({ id: n.id, title: n.title }))
}

export function listFoldersWithRoot(
  nodes: TreeNode[],
  scope: FolderScope,
  rootLabel: string
): MoveToFolder[] {
  return [{ id: MOVE_TO_ROOT, title: rootLabel }, ...listFoldersForScope(nodes, scope)]
}

export function listSceneChapters(nodes: TreeNode[]): MoveToFolder[] {
  return getSceneChapters(nodes).map((n) => ({ id: n.id, title: n.title }))
}

export type TreeContextMenuActionProps = {
  onMoveTo?: () => void
  moveToFolders?: MoveToFolder[]
  onMoveToFolder?: (folderId: string) => void
  moveToChapters?: MoveToFolder[]
  onMoveToChapter?: (chapterId: string) => void
  onConvertToSimpleChapter?: () => void
  onConvertToSceneChapter?: () => void
  onConvertSimpleToSceneChapter?: () => void
}

export function buildTreeContextMenuActions(
  node: TreeNode,
  actions: SidebarMenuActions
): TreeContextMenuActionProps {
  const baseFolders = node.parentId ? actions.foldersNested : actions.foldersAtRoot
  const isManuscript = actions.scope === 'manuscript'

  return {
    onMoveTo:
      node.type === 'scene' && actions.onMoveTo ? () => actions.onMoveTo!(node) : undefined,
    moveToFolders: baseFolders.filter(
      (f) => f.id !== node.id && (node.parentId ? f.id !== node.parentId : f.id !== MOVE_TO_ROOT)
    ),
    onMoveToFolder: (folderId) => actions.onMoveToFolder(node, folderId),
    moveToChapters:
      node.type === 'scene' && actions.sceneChapters
        ? actions.sceneChapters.filter((c) => c.id !== node.parentId)
        : undefined,
    onMoveToChapter:
      node.type === 'scene' && actions.onMoveToChapter
        ? (chapterId) => actions.onMoveToChapter!(node, chapterId)
        : undefined,
    onConvertToSimpleChapter:
      node.type === 'scene' && isManuscript && actions.onConvertToSimpleChapter
        ? () => actions.onConvertToSimpleChapter!(node)
        : undefined,
    onConvertToSceneChapter:
      node.type === 'scene' && isManuscript && actions.onConvertToSceneChapter
        ? () => actions.onConvertToSceneChapter!(node)
        : undefined,
    onConvertSimpleToSceneChapter:
      node.type === 'chapter' &&
      isSimpleChapter(node) &&
      isManuscript &&
      actions.onConvertSimpleToSceneChapter
        ? () => actions.onConvertSimpleToSceneChapter!(node)
        : undefined
  }
}

export async function moveNodeToFolder(node: TreeNode, folderId: string): Promise<void> {
  await useHistoryStore.getState().push(
    makeReparentCommand({
      nodeId: node.id,
      oldParentId: node.parentId ?? null,
      newParentId: folderId === MOVE_TO_ROOT ? null : folderId
    })
  )
}

export async function moveSceneToChapter(scene: TreeNode, chapterId: string): Promise<void> {
  await useHistoryStore.getState().push(
    makeReparentCommand({
      nodeId: scene.id,
      oldParentId: scene.parentId ?? null,
      newParentId: chapterId
    })
  )
}

export async function convertSceneToSimpleChapter(scene: TreeNode): Promise<void> {
  const { nodes, setNodes, setSelectedNodeId } = useAppStore.getState()
  const chapterParent = scene.parentId ? nodes.find((n) => n.id === scene.parentId) : null
  const newChapter = await window.electronAPI.tree.create(
    chapterParent?.parentId ?? null,
    'chapter',
    scene.title,
    { metadata: JSON.stringify({ structure: 'simple' }) }
  )
  await window.electronAPI.tree.update(newChapter.id, { content: scene.content })
  await window.electronAPI.tree.moveToTrash(scene.id)
  const all = await window.electronAPI.tree.getAll()
  setNodes(all)
  setSelectedNodeId(newChapter.id)
}

export async function convertSceneToSceneChapter(scene: TreeNode): Promise<void> {
  const { nodes, setNodes, setSelectedNodeId } = useAppStore.getState()
  const chapterParent = scene.parentId ? nodes.find((n) => n.id === scene.parentId) : null
  const newChapter = await window.electronAPI.tomes.createChapter(
    'scenes',
    chapterParent?.parentId ?? null
  )
  await window.electronAPI.tree.update(newChapter.id, { title: scene.title })
  const newScenes = (await window.electronAPI.tree.getAll()).filter(
    (n) => !n.deletedAt && n.type === 'scene' && n.parentId === newChapter.id
  )
  if (newScenes.length > 0) {
    await window.electronAPI.tree.update(newScenes[0].id, {
      content: scene.content,
      title: scene.title
    })
  }
  await window.electronAPI.tree.moveToTrash(scene.id)
  const all = await window.electronAPI.tree.getAll()
  setNodes(all)
  setSelectedNodeId(newChapter.id)
}

export async function convertSimpleToSceneChapter(chapter: TreeNode): Promise<void> {
  const { setNodes, setSelectedNodeId } = useAppStore.getState()
  await window.electronAPI.tree.update(chapter.id, {
    metadata: JSON.stringify({ structure: 'scenes' })
  })
  const firstScene = await window.electronAPI.tree.create(chapter.id, 'scene', chapter.title)
  await window.electronAPI.tree.update(firstScene.id, { content: chapter.content })
  await window.electronAPI.tree.update(chapter.id, { content: '' })
  const all = await window.electronAPI.tree.getAll()
  setNodes(all)
  setSelectedNodeId(chapter.id)
}

export function buildManuscriptSidebarMenuActions(
  nodes: TreeNode[],
  handlers: {
    onMoveToFolder: (node: TreeNode, folderId: string) => void
    onMoveToChapter: (node: TreeNode, chapterId: string) => void
    onConvertToSimpleChapter: (node: TreeNode) => void
    onConvertToSceneChapter: (node: TreeNode) => void
    onConvertSimpleToSceneChapter: (node: TreeNode) => void
    onMoveTo: (node: TreeNode) => void
  }
): SidebarMenuActions {
  return {
    scope: 'manuscript',
    foldersAtRoot: listFoldersForScope(nodes, 'manuscript'),
    foldersNested: listFoldersWithRoot(nodes, 'manuscript', 'Manuscript'),
    sceneChapters: listSceneChapters(nodes),
    ...handlers
  }
}

export function buildCategorySidebarMenuActions(
  nodes: TreeNode[],
  scope: FolderScope,
  rootLabel: string,
  onMoveToFolder: (node: TreeNode, folderId: string) => void
): SidebarMenuActions {
  return {
    scope,
    foldersAtRoot: listFoldersForScope(nodes, scope),
    foldersNested: listFoldersWithRoot(nodes, scope, rootLabel),
    onMoveToFolder
  }
}
