import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { isValidContainerId } from '@shared/projectUiState'
import { useHistoryStore } from '@/store/historyStore'
import {
  makeCreateChapterCommand,
  makeCreateFolderCommand,
  makeCreateNodeCommand,
  makeMoveToTrashCommand,
  makeReorderCommand,
  makeReparentCommand
} from '@/lib/commands'
import { createCategoryItem, openCategoryItem } from '@/lib/categoryNavigation'
import { requestRenameAfterCreate } from '@/lib/pendingRename'
import { RichTextEditor } from '@/components/Editor/RichTextEditor'
import { ContainerView } from '@/components/Editor/ContainerView'
import { MoveSceneDialog } from '@/components/Tree/MoveSceneDialog'
import {
  folderContainerId,
  getCategoryScopedChildren,
  getChildren,
  getScenes,
  getSceneChapters,
  getTrashNodes,
  getFolderScope,
  isChapterFolder,
  isFolder,
  isTrashContainerId,
  isWikiEntityType,
  parseFolderContainerId,
  parseTrashContainerId,
  resolveEntryCategoryIdForFolder
} from '@/lib/treeUtils'
import { folderScopeForCategory } from '@shared/categoryPresets'
import type { CategoryDefinition, ChapterStructure, FolderScope, TreeNode } from '@shared/types'
import { TRASH_CATEGORY_LABELS } from '@shared/types'

function resolveContainerCategory(
  containerId: string | null,
  categories: CategoryDefinition[]
): CategoryDefinition | null {
  if (!containerId) return null
  if (containerId === 'manuscript' || containerId.startsWith('trash') || containerId.startsWith('folder:')) return null
  return categories.find((c) => c.id === containerId) ?? null
}

function containerSelectionId(
  selectedNodeId: string | null,
  selectedEntityId: string | null,
  selectedEntryId: string | null
): string | null {
  return selectedEntryId ?? selectedEntityId ?? selectedNodeId
}

export function EditorPane(): React.JSX.Element {
  const {
    nodes,
    categories,
    selectedNodeId,
    selectedEntityId,
    selectedEntryId,
    selectedContainerId,
    setSelectedNodeId,
    selectWikiEntity,
    setSelectedEntity,
    selectContainer,
    setNodes,
    containerHistory,
    containerHistoryIndex,
    containerGoBack,
    containerGoForward
  } = useAppStore()

  const canGoBack = containerHistory
    .slice(0, containerHistoryIndex)
    .some((id) => isValidContainerId(id, nodes, categories))
  const canGoForward = containerHistory
    .slice(containerHistoryIndex + 1)
    .some((id) => isValidContainerId(id, nodes, categories))

  const buildBreadcrumb = (folderId: string): string => {
    const parts: string[] = []
    let current = nodes.find((n) => n.id === folderId && !n.deletedAt)
    while (current) {
      parts.unshift(current.title)
      if (!current.parentId) break
      const parent = nodes.find((n) => n.id === current!.parentId && !n.deletedAt)
      if (!parent) break
      current = parent
    }
    return parts.join(' / ')
  }

  const [moveSceneNode, setMoveSceneNode] = useState<TreeNode | null>(null)
  const [recoverSceneNode, setRecoverSceneNode] = useState<TreeNode | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId && !n.deletedAt) ?? null

  const persistReorder = async (reordered: TreeNode[], parentId: string | null): Promise<void> => {
    const nodesBefore = [...useAppStore.getState().nodes]
    const items = reordered.map((n, i) => ({ id: n.id, parentId, sortOrder: i }))
    await useHistoryStore.getState().push(makeReorderCommand({ previousNodes: nodesBefore, newItems: items }))
  }

  const handleMoveToTrash = async (node: TreeNode): Promise<void> => {
    await useHistoryStore.getState().push(makeMoveToTrashCommand({ node }))
  }

  const handleRecover = async (node: TreeNode): Promise<void> => {
    try {
      const updated = await window.electronAPI.tree.restore(node.id)
      setNodes(updated)
    } catch {
      if (node.type === 'scene') {
        const chapters = getSceneChapters(nodes)
        if (chapters.length === 0) {
          const chapter = await window.electronAPI.tomes.createChapter('scenes')
          const restored = await window.electronAPI.tree.restore(node.id, chapter.id)
          setNodes(restored)
        } else {
          setRecoverSceneNode(node)
        }
      }
    }
  }

  const handlePermanentDelete = async (node: TreeNode): Promise<void> => {
    const updated = await window.electronAPI.tree.permanentDelete(node.id)
    setNodes(updated)
  }

  const openInNewWindow = (node: TreeNode): void => {
    if (node.type === 'note') {
      selectWikiEntity(node.id, node.type)
      void window.electronAPI.windows.openDocument(node.id, node.title)
      return
    }
    void window.electronAPI.windows.openDocument(node.id, node.title)
  }

  const createFolder = async (
    scope: FolderScope,
    parentId: string | null,
    categoryId?: string
  ): Promise<void> => {
    const createdId = await useHistoryStore.getState().push(
      makeCreateFolderCommand({ scope, parentId, title: 'New Folder' })
    )
    if (parentId) {
      selectContainer(folderContainerId(parentId))
    } else if (scope === 'manuscript') {
      selectContainer('manuscript')
    } else if (categoryId) {
      selectContainer(categoryId)
    }
    if (createdId) {
      requestRenameAfterCreate(createdId, 'container', 'sidebar')
    }
  }

  const createChapter = async (structure: ChapterStructure, parentId: string | null): Promise<void> => {
    const chapterId = await useHistoryStore.getState().push(
      makeCreateChapterCommand({ structure, parentId })
    )
    if (!chapterId) return
    const all = useAppStore.getState().nodes
    if (structure === 'scenes') {
      const scene = all.find((n) => n.parentId === chapterId && n.type === 'scene')
      setSelectedNodeId(scene?.id ?? chapterId)
    } else {
      setSelectedNodeId(chapterId)
    }
    requestRenameAfterCreate(chapterId, 'container', 'sidebar')
  }

  const createScene = async (chapterId: string): Promise<void> => {
    const createdId = await useHistoryStore.getState().push(
      makeCreateNodeCommand({ parentId: chapterId, type: 'scene', title: 'New Scene' })
    )
    if (createdId) {
      setSelectedNodeId(createdId)
      requestRenameAfterCreate(createdId, 'container', 'sidebar')
    }
  }

  const handleMoveScene = async (chapterId: string): Promise<void> => {
    if (!moveSceneNode) return
    await useHistoryStore.getState().push(
      makeReparentCommand({
        nodeId: moveSceneNode.id,
        oldParentId: moveSceneNode.parentId ?? null,
        newParentId: chapterId
      })
    )
    setMoveSceneNode(null)
  }

  const handleRecoverScene = async (chapterId: string): Promise<void> => {
    if (!recoverSceneNode) return
    const updated = await window.electronAPI.tree.restore(recoverSceneNode.id, chapterId)
    setNodes(updated)
    setRecoverSceneNode(null)
  }

  const handleSelectContainerItem = (
    node: TreeNode,
    scope: FolderScope,
    entryCategoryId?: string
  ): void => {
    if (isFolder(node)) {
      selectContainer(folderContainerId(node.id))
      return
    }
    if (scope === 'manuscript' && node.type === 'chapter') {
      setSelectedNodeId(node.id)
      return
    }
    void openCategoryItem(node.id)
  }

  const buildManuscriptMenu = (parentId: string | null) => [
    { label: 'New Folder', onSelect: () => void createFolder('manuscript', parentId) },
    { label: 'New Chapter', onSelect: () => void createChapter('simple', parentId) },
    { label: 'New Chapter with Scenes', onSelect: () => void createChapter('scenes', parentId) }
  ]

  const buildCategoryMenu = (
    category: CategoryDefinition,
    parentId: string | null
  ) => {
    const scope = folderScopeForCategory(category)
    const itemLabel = `New ${category.name.replace(/s$/, '')}`
    return [
      { label: 'New Folder', onSelect: () => void createFolder(scope, parentId, category.id) },
      { label: itemLabel, onSelect: () => void createCategoryItem(category.id, parentId, 'container') }
    ]
  }

  const MOVE_TO_ROOT = '__root__'

  const getFoldersForScope = (scope: FolderScope): { id: string; title: string }[] =>
    nodes.filter((n) => !n.deletedAt && n.type === 'folder' && getFolderScope(n) === scope)
      .map((n) => ({ id: n.id, title: n.title }))

  const getFoldersWithRoot = (scope: FolderScope, rootLabel: string): { id: string; title: string }[] => [
    { id: MOVE_TO_ROOT, title: rootLabel },
    ...getFoldersForScope(scope)
  ]

  const getSceneChaptersList = (): { id: string; title: string }[] =>
    getSceneChapters(nodes).map((n) => ({ id: n.id, title: n.title }))

  const handleMoveToChapter = async (scene: TreeNode, chapterId: string): Promise<void> => {
    await useHistoryStore.getState().push(
      makeReparentCommand({
        nodeId: scene.id,
        oldParentId: scene.parentId ?? null,
        newParentId: chapterId
      })
    )
  }

  const handleConvertSceneToSimpleChapter = async (scene: TreeNode): Promise<void> => {
    const chapterParent = scene.parentId
      ? nodes.find((n) => n.id === scene.parentId)
      : null
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

  const handleConvertSceneToSceneChapter = async (scene: TreeNode): Promise<void> => {
    const chapterParent = scene.parentId
      ? nodes.find((n) => n.id === scene.parentId)
      : null
    const newChapter = await window.electronAPI.tomes.createChapter('scenes', chapterParent?.parentId ?? null)
    await window.electronAPI.tree.update(newChapter.id, { title: scene.title })
    const newScenes = (await window.electronAPI.tree.getAll()).filter(
      (n) => !n.deletedAt && n.type === 'scene' && n.parentId === newChapter.id
    )
    if (newScenes.length > 0) {
      await window.electronAPI.tree.update(newScenes[0].id, { content: scene.content, title: scene.title })
    }
    await window.electronAPI.tree.moveToTrash(scene.id)
    const all = await window.electronAPI.tree.getAll()
    setNodes(all)
    setSelectedNodeId(newChapter.id)
  }

  const handleConvertSimpleToSceneChapter = async (chapter: TreeNode): Promise<void> => {
    await window.electronAPI.tree.update(chapter.id, {
      metadata: JSON.stringify({ structure: 'scenes' })
    })
    const firstScene = await window.electronAPI.tree.create(
      chapter.id,
      'scene',
      chapter.title
    )
    await window.electronAPI.tree.update(firstScene.id, { content: chapter.content })
    await window.electronAPI.tree.update(chapter.id, { content: '' })
    const all = await window.electronAPI.tree.getAll()
    setNodes(all)
    setSelectedNodeId(chapter.id)
  }

  const handleMoveToFolder = async (node: TreeNode, folderId: string): Promise<void> => {
    await useHistoryStore.getState().push(
      makeReparentCommand({
        nodeId: node.id,
        oldParentId: node.parentId ?? null,
        newParentId: folderId === MOVE_TO_ROOT ? null : folderId
      })
    )
  }

  const dialogs = (
    <>
      <MoveSceneDialog
        open={moveSceneNode !== null}
        onOpenChange={(open) => !open && setMoveSceneNode(null)}
        chapters={getSceneChapters(nodes)}
        onMove={handleMoveScene}
      />
      <MoveSceneDialog
        open={recoverSceneNode !== null}
        onOpenChange={(open) => !open && setRecoverSceneNode(null)}
        chapters={getSceneChapters(nodes)}
        onMove={handleRecoverScene}
      />
    </>
  )

  if (selectedContainerId && isTrashContainerId(selectedContainerId)) {
    const category = parseTrashContainerId(selectedContainerId)!
    const items = getTrashNodes(nodes, category)
    return (
      <>
        <ContainerView
          title={`Trash — ${TRASH_CATEGORY_LABELS[category]}`}
          items={items}
          emptyMessage="Nothing in this category."
          selectedNodeId={selectedNodeId ?? selectedEntityId}
          readOnly
          menuVariant="trash"
          onSelect={(node) => {
            if (isWikiEntityType(node.type)) setSelectedEntity(node.id, node.type)
            else setSelectedNodeId(node.id)
          }}
          onRecover={(node) => void handleRecover(node)}
          onPermanentDelete={(node) => void handlePermanentDelete(node)}
        />
        {dialogs}
      </>
    )
  }

  if (selectedContainerId === 'manuscript') {
    const items = getChildren(nodes, null, 'manuscript')
    return (
      <>
        <ContainerView
          title="Manuscript"
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onGoBack={containerGoBack}
          onGoForward={containerGoForward}
          items={items}
          emptyMessage="No items yet. Right-click to add a folder or chapter."
          selectedNodeId={selectedNodeId}
          onSelect={(node) => handleSelectContainerItem(node, 'manuscript')}
          onReorder={(reordered) => void persistReorder(reordered, null)}
          menuVariant="manuscript"
          onMoveTo={(node) => setMoveSceneNode(node)}
          moveToFolders={getFoldersForScope('manuscript')}
          onMoveToFolder={(node, folderId) => void handleMoveToFolder(node, folderId)}
          moveToChapters={getSceneChaptersList()}
          onMoveToChapter={(node, chapterId) => void handleMoveToChapter(node, chapterId)}
          onConvertToSimpleChapter={(node) => void handleConvertSceneToSimpleChapter(node)}
          onConvertToSceneChapter={(node) => void handleConvertSceneToSceneChapter(node)}
          onConvertSimpleToSceneChapter={(node) => void handleConvertSimpleToSceneChapter(node)}
          onOpenNewWindow={openInNewWindow}
          onMoveToTrash={(node) => void handleMoveToTrash(node)}
          emptyMenuItems={buildManuscriptMenu(null)}
        />
        {dialogs}
      </>
    )
  }

  const containerCategory = resolveContainerCategory(selectedContainerId, categories)

  if (containerCategory) {
    const scope = folderScopeForCategory(containerCategory)
    const items = scope === 'entry'
      ? getCategoryScopedChildren(nodes, null, containerCategory.id)
      : getChildren(nodes, null, scope)
    const emptyLabel = containerCategory.name.replace(/s$/, '').toLowerCase()

    return (
      <>
        <ContainerView
          title={containerCategory.name}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onGoBack={containerGoBack}
          onGoForward={containerGoForward}
          items={items}
          emptyMessage={`No ${emptyLabel} entries yet. Right-click to add a folder or entry.`}
          selectedNodeId={containerSelectionId(selectedNodeId, selectedEntityId, selectedEntryId)}
          onSelect={(node) => handleSelectContainerItem(node, scope, containerCategory.id)}
          onReorder={(reordered) => void persistReorder(reordered, null)}
          menuVariant="wiki"
          onMoveTo={(node) => setMoveSceneNode(node)}
          moveToFolders={getFoldersForScope(scope)}
          onMoveToFolder={(node, folderId) => void handleMoveToFolder(node, folderId)}
          onOpenNewWindow={openInNewWindow}
          onMoveToTrash={(node) => void handleMoveToTrash(node)}
          emptyMenuItems={buildCategoryMenu(containerCategory, null)}
        />
        {dialogs}
      </>
    )
  }

  const folderId = selectedContainerId ? parseFolderContainerId(selectedContainerId) : null
  if (folderId) {
    const folder = nodes.find((n) => n.id === folderId)
    if (folder && isFolder(folder) && !folder.deletedAt) {
      const folderScope = getFolderScope(folder) ?? 'manuscript'
      const folderCategoryId =
        folderScope === 'entry'
          ? resolveEntryCategoryIdForFolder(
              nodes,
              folderId,
              categories.map((c) => c.id)
            )
          : undefined
      const items =
        folderScope === 'entry' && folderCategoryId
          ? getCategoryScopedChildren(nodes, folderId, folderCategoryId)
          : getChildren(nodes, folderId, folderScope)
      const folderCategory = folderCategoryId
        ? categories.find((c) => c.id === folderCategoryId)
        : categories.find((c) => folderScopeForCategory(c) === folderScope)
      const isManuscriptFolder = folderScope === 'manuscript'
      return (
        <>
          <ContainerView
            title={isManuscriptFolder ? 'Manuscript' : folderCategory?.name ?? folder.title}
            breadcrumb={buildBreadcrumb(folderId)}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onGoBack={containerGoBack}
            onGoForward={containerGoForward}
            items={items}
            emptyMessage="This folder is empty. Right-click to add items."
            selectedNodeId={
              isManuscriptFolder
                ? selectedNodeId
                : containerSelectionId(selectedNodeId, selectedEntityId, selectedEntryId)
            }
            onSelect={(node) => handleSelectContainerItem(node, folderScope, folderCategoryId)}
            onReorder={(reordered) => void persistReorder(reordered, folderId)}
            menuVariant={isManuscriptFolder ? 'manuscript' : 'wiki'}
            onMoveTo={(node) => setMoveSceneNode(node)}
            moveToFolders={getFoldersWithRoot(folderScope, isManuscriptFolder ? 'Manuscript' : folderCategory?.name ?? 'Root')}
            onMoveToFolder={(node, folderId) => void handleMoveToFolder(node, folderId)}
            moveToChapters={isManuscriptFolder ? getSceneChaptersList() : undefined}
            onMoveToChapter={isManuscriptFolder ? (node, chapterId) => void handleMoveToChapter(node, chapterId) : undefined}
            onConvertToSimpleChapter={isManuscriptFolder ? (node) => void handleConvertSceneToSimpleChapter(node) : undefined}
            onConvertToSceneChapter={isManuscriptFolder ? (node) => void handleConvertSceneToSceneChapter(node) : undefined}
            onConvertSimpleToSceneChapter={isManuscriptFolder ? (node) => void handleConvertSimpleToSceneChapter(node) : undefined}
            onOpenNewWindow={openInNewWindow}
            onMoveToTrash={(node) => void handleMoveToTrash(node)}
            emptyMenuItems={
              isManuscriptFolder
                ? buildManuscriptMenu(folderId)
                : folderCategory
                  ? buildCategoryMenu(folderCategory, folderId)
                  : [{ label: 'New Folder', onSelect: () => void createFolder(folderScope, folderId) }]
            }
          />
          {dialogs}
        </>
      )
    }
  }

  if (selectedNode && isChapterFolder(selectedNode)) {
    const scenes = getScenes(nodes, selectedNode.id)
    return (
      <>
        <ContainerView
          title={selectedNode.title}
          subtitle="Scenes in this chapter"
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onGoBack={containerGoBack}
          onGoForward={containerGoForward}
          items={scenes}
          emptyMessage="No scenes yet. Right-click to add a scene."
          selectedNodeId={selectedNodeId}
          onSelect={(node) => setSelectedNodeId(node.id)}
          onReorder={(reordered) => void persistReorder(reordered, selectedNode.id)}
          menuVariant="manuscript"
          onMoveTo={(node) => setMoveSceneNode(node)}
          moveToChapters={getSceneChaptersList()}
          onMoveToChapter={(node, chapterId) => void handleMoveToChapter(node, chapterId)}
          onConvertToSimpleChapter={(node) => void handleConvertSceneToSimpleChapter(node)}
          onConvertToSceneChapter={(node) => void handleConvertSceneToSceneChapter(node)}
          onOpenNewWindow={openInNewWindow}
          onMoveToTrash={(node) => void handleMoveToTrash(node)}
          emptyMenuItems={[{ label: 'New Scene', onSelect: () => void createScene(selectedNode.id) }]}
        />
        {dialogs}
      </>
    )
  }

  return (
    <>
      <RichTextEditor node={selectedNode} />
      {dialogs}
    </>
  )
}
