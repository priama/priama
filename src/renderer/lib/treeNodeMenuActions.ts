import { makeReparentCommand } from '@/lib/commands'
import { getFolderScope, getSceneChapters, isSimpleChapter, isChapterFolder } from '@/lib/treeUtils'
import { canMergeWithNext } from '@/lib/splitMerge'
import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import type { FolderScope, TreeNode } from '@shared/types'
import type { MoveToFolder } from '@/components/Tree/TreeContextMenu'
import {
  convertSceneToSceneChapter as promoteToScenesChapter,
  convertSceneToSimpleChapter as promoteToSimpleChapter,
  convertSimpleToSceneChapter as convertSimpleInPlace,
  convertScenesChapterToSimple,
  mergeWithNext
} from '@/lib/documentActions'

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
  onConvertScenesChapterToSimple?: (node: TreeNode) => void
  onMergeWithNext?: (node: TreeNode) => void
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
  onConvertScenesChapterToSimple?: () => void
  onMergeWithNext?: () => void
}

export function buildTreeContextMenuActions(
  node: TreeNode,
  actions: SidebarMenuActions
): TreeContextMenuActionProps {
  const baseFolders = node.parentId ? actions.foldersNested : actions.foldersAtRoot
  const isManuscript = actions.scope === 'manuscript'
  const nodes = useAppStore.getState().nodes

  const isScene = node.type === 'scene'

  return {
    onMoveTo: isScene && actions.onMoveTo ? () => actions.onMoveTo!(node) : undefined,
    // Scenes belong under chapters only — never offer folder / manuscript-root reparent.
    moveToFolders: isScene
      ? undefined
      : baseFolders.filter(
          (f) => f.id !== node.id && (node.parentId ? f.id !== node.parentId : f.id !== MOVE_TO_ROOT)
        ),
    onMoveToFolder: isScene ? undefined : (folderId) => actions.onMoveToFolder(node, folderId),
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
        : undefined,
    onConvertScenesChapterToSimple:
      node.type === 'chapter' &&
      isChapterFolder(node) &&
      isManuscript &&
      actions.onConvertScenesChapterToSimple
        ? () => actions.onConvertScenesChapterToSimple!(node)
        : undefined,
    onMergeWithNext:
      isManuscript &&
      actions.onMergeWithNext &&
      canMergeWithNext(node, nodes)
        ? () => actions.onMergeWithNext!(node)
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
  await promoteToSimpleChapter(scene)
}

export async function convertSceneToSceneChapter(scene: TreeNode): Promise<void> {
  await promoteToScenesChapter(scene)
}

export async function convertSimpleToSceneChapter(chapter: TreeNode): Promise<void> {
  await convertSimpleInPlace(chapter)
}

export async function convertScenesChapterToSimpleChapter(chapter: TreeNode): Promise<void> {
  await convertScenesChapterToSimple(chapter)
}

export async function mergeNodeWithNext(node: TreeNode): Promise<void> {
  await mergeWithNext(node)
}

export function buildManuscriptSidebarMenuActions(
  nodes: TreeNode[],
  handlers: {
    onMoveToFolder: (node: TreeNode, folderId: string) => void
    onMoveToChapter: (node: TreeNode, chapterId: string) => void
    onConvertToSimpleChapter: (node: TreeNode) => void
    onConvertToSceneChapter: (node: TreeNode) => void
    onConvertSimpleToSceneChapter: (node: TreeNode) => void
    onConvertScenesChapterToSimple: (node: TreeNode) => void
    onMergeWithNext: (node: TreeNode) => void
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
