import type { ChapterStructure, FolderScope, NodeType, TreeNode } from '@shared/types'
import { useAppStore } from '@/store/appStore'
import type { StructuralCommand } from '@/store/historyStore'
import { clearEditorHistory, getActiveEditorInstance } from '@/lib/activeEditor'
import { flushNode, markContentDirty } from '@/lib/contentPersistence'
import {
  joinHtmlDocuments,
  reorderAfterKeeper,
  titleFromHtml
} from '@/lib/splitMerge'
import { getChildren, getScenes, isSimpleChapter } from '@/lib/treeUtils'
import { requestRenameAfterCreate } from '@/lib/pendingRename'
import { chapterMetaWithStructure, simpleChapterMetaFrom } from '@shared/manuscriptMeta'

function syncNodes(nodes: TreeNode[]): void {
  useAppStore.getState().setNodes(nodes)
}

/** Write content to store + disk; sync live editor if it is this node. */
async function persistNodeContent(nodeId: string, html: string, clearHistory = false): Promise<void> {
  const active = getActiveEditorInstance()
  if (active && active.nodeId === nodeId && !active.editor.isDestroyed) {
    active.editor.commands.setContent(html, false)
    if (clearHistory) clearEditorHistory(active.editor)
  }
  useAppStore.getState().updateNodeInStore(nodeId, { content: html })
  markContentDirty(nodeId, html)
  await flushNode(nodeId)
  await window.electronAPI.tree.update(nodeId, { content: html })
}

function clearSelectionForDeletedNode(createdId: string): void {
  const {
    selectedNodeId,
    selectedEntryId,
    selectedEntityId,
    manuscriptInfoNodeId,
    setSelectedNodeId,
    selectEntry,
    setSelectedEntity,
    clearManuscriptInfo
  } = useAppStore.getState()
  if (selectedNodeId === createdId) setSelectedNodeId(null)
  if (selectedEntryId === createdId) selectEntry(null, null)
  if (selectedEntityId === createdId) setSelectedEntity(null, null)
  if (manuscriptInfoNodeId === createdId) clearManuscriptInfo()
}

export function makeCreateNodeCommand(params: {
  parentId: string | null
  type: NodeType
  title: string
  scope?: FolderScope
  categoryId?: string
}): StructuralCommand {
  let createdId: string | null = null

  return {
    description: `Create ${params.type} "${params.title}"`,

    getCreatedId: () => createdId,

    execute: async () => {
      try {
        const options =
          params.scope || params.categoryId
            ? { scope: params.scope, categoryId: params.categoryId }
            : undefined
        const node = await window.electronAPI.tree.create(
          params.parentId,
          params.type,
          params.title,
          options
        )
        createdId = node.id
        useAppStore.getState().upsertNode(node)
      } catch (err) {
        console.error('Create node failed:', err)
      }
    },

    undo: async () => {
      if (!createdId) return
      try {
        const updated = await window.electronAPI.tree.permanentDelete(createdId)
        syncNodes(updated)
        clearSelectionForDeletedNode(createdId)
      } catch (err) {
        console.error('Undo create node failed:', err)
      }
    }
  }
}

export function makeCreateFolderCommand(params: {
  scope: FolderScope
  parentId: string | null
  title: string
}): StructuralCommand {
  let createdId: string | null = null

  return {
    description: `Create folder "${params.title}"`,

    getCreatedId: () => createdId,

    execute: async () => {
      try {
        const node = await window.electronAPI.tree.createFolder(
          params.scope,
          params.parentId,
          params.title
        )
        createdId = node.id
        useAppStore.getState().upsertNode(node)
      } catch (err) {
        console.error('Create folder failed:', err)
      }
    },

    undo: async () => {
      if (!createdId) return
      try {
        const updated = await window.electronAPI.tree.permanentDelete(createdId)
        syncNodes(updated)
        clearSelectionForDeletedNode(createdId)
      } catch (err) {
        console.error('Undo create folder failed:', err)
      }
    }
  }
}

export function makeCreateChapterCommand(params: {
  structure: ChapterStructure
  parentId?: string | null
}): StructuralCommand {
  let createdChapterId: string | null = null

  return {
    description: 'Create chapter',

    getCreatedId: () => createdChapterId,

    execute: async () => {
      try {
        const node = await window.electronAPI.tomes.createChapter(params.structure, params.parentId)
        createdChapterId = node.id
        const all = await window.electronAPI.tree.getAll()
        useAppStore.getState().setNodes(all)
      } catch (err) {
        console.error('Create chapter failed:', err)
      }
    },

    undo: async () => {
      if (!createdChapterId) return
      try {
        const updated = await window.electronAPI.tree.permanentDelete(createdChapterId)
        syncNodes(updated)
        const { selectedNodeId, setSelectedNodeId } = useAppStore.getState()
        if (selectedNodeId === createdChapterId) setSelectedNodeId(null)
      } catch (err) {
        console.error('Undo create chapter failed:', err)
      }
    }
  }
}

export function makeRenameCommand(params: {
  id: string
  oldTitle: string
  newTitle: string
}): StructuralCommand {
  return {
    description: `Rename to "${params.newTitle}"`,

    execute: async () => {
      try {
        const updated = await window.electronAPI.tree.update(params.id, { title: params.newTitle })
        useAppStore.getState().updateNodeInStore(params.id, { title: updated.title })
      } catch (err) {
        console.error('Rename failed:', err)
      }
    },

    undo: async () => {
      try {
        const updated = await window.electronAPI.tree.update(params.id, { title: params.oldTitle })
        useAppStore.getState().updateNodeInStore(params.id, { title: updated.title })
      } catch (err) {
        console.error('Undo rename failed:', err)
      }
    }
  }
}

export function makeMoveToTrashCommand(params: { node: TreeNode }): StructuralCommand {
  const { node } = params
  const originalParentId = node.parentId

  return {
    description: `Move "${node.title}" to trash`,

    execute: async () => {
      try {
        const updated = await window.electronAPI.tree.moveToTrash(node.id)
        syncNodes(updated)
      } catch (err) {
        console.error('Move to trash failed:', err)
      }
    },

    undo: async () => {
      try {
        const updated = await window.electronAPI.tree.restore(node.id, originalParentId ?? undefined)
        syncNodes(updated)
      } catch (err) {
        console.error('Undo move to trash failed:', err)
      }
    }
  }
}

export function makeReorderCommand(params: {
  previousNodes: TreeNode[]
  newItems: { id: string; parentId: string | null; sortOrder: number }[]
}): StructuralCommand {
  const idSet = new Set(params.newItems.map((i) => i.id))
  const oldItems = params.previousNodes
    .filter((n) => idSet.has(n.id))
    .map((n) => ({ id: n.id, parentId: n.parentId, sortOrder: n.sortOrder }))

  return {
    description: 'Reorder',

    execute: async () => {
      try {
        const updated = await window.electronAPI.tree.reorder(params.newItems)
        syncNodes(updated)
      } catch (err) {
        console.error('Reorder failed:', err)
      }
    },

    undo: async () => {
      try {
        const updated = await window.electronAPI.tree.reorder(oldItems)
        syncNodes(updated)
      } catch (err) {
        console.error('Undo reorder failed:', err)
      }
    }
  }
}

export function makeReparentCommand(params: {
  nodeId: string
  oldParentId: string | null
  newParentId: string | null
}): StructuralCommand {
  return {
    description: 'Move into folder',

    execute: async () => {
      try {
        const updated = await window.electronAPI.tree.update(params.nodeId, {
          parentId: params.newParentId
        })
        useAppStore.getState().updateNodeInStore(params.nodeId, { parentId: updated.parentId })
        const all = await window.electronAPI.tree.getAll()
        useAppStore.getState().setNodes(all)
      } catch (err) {
        console.error('Reparent failed:', err)
      }
    },

    undo: async () => {
      try {
        const updated = await window.electronAPI.tree.update(params.nodeId, {
          parentId: params.oldParentId
        })
        useAppStore.getState().updateNodeInStore(params.nodeId, { parentId: updated.parentId })
        const all = await window.electronAPI.tree.getAll()
        useAppStore.getState().setNodes(all)
      } catch (err) {
        console.error('Undo reparent failed:', err)
      }
    }
  }
}

export function makeSplitCommand(params: {
  keeperId: string
  originalHtml: string
  aboveHtml: string
  belowHtml: string
  previousSelectedId: string | null
}): StructuralCommand {
  let createdId: string | null = null
  let previousSiblingOrder: { id: string; parentId: string | null; sortOrder: number }[] = []

  return {
    description: 'Split document',

    getCreatedId: () => createdId,

    execute: async () => {
      try {
        const { nodes, setSelectedNodeId } = useAppStore.getState()
        const keeper = nodes.find((n) => n.id === params.keeperId && !n.deletedAt)
        if (!keeper) return

        await persistNodeContent(params.keeperId, params.aboveHtml, true)

        const newTitle = titleFromHtml(params.belowHtml)
        let created: TreeNode

        if (keeper.type === 'scene') {
          created = await window.electronAPI.tree.create(
            keeper.parentId,
            'scene',
            newTitle
          )
        } else {
          created = await window.electronAPI.tree.create(
            keeper.parentId,
            'chapter',
            newTitle,
            { metadata: simpleChapterMetaFrom() }
          )
        }

        createdId = created.id
        await window.electronAPI.tree.update(created.id, { content: params.belowHtml })

        const allAfterCreate = await window.electronAPI.tree.getAll()
        const siblings =
          keeper.type === 'scene' && keeper.parentId
            ? getScenes(allAfterCreate, keeper.parentId)
            : getChildren(allAfterCreate, keeper.parentId ?? null, 'manuscript').filter(
                (n) => n.type === 'chapter' && isSimpleChapter(n)
              )

        previousSiblingOrder = siblings.map((n) => ({
          id: n.id,
          parentId: n.parentId ?? null,
          sortOrder: n.sortOrder
        }))

        const reorderItems = reorderAfterKeeper(siblings, keeper.id, created.id)
        let all = allAfterCreate
        if (reorderItems.length > 0) {
          all = await window.electronAPI.tree.reorder(reorderItems)
        }

        syncNodes(all)
        setSelectedNodeId(created.id)

        if (newTitle === 'Untitled') {
          requestRenameAfterCreate(created.id, 'sidebar', 'container')
        }
      } catch (err) {
        console.error('Split document failed:', err)
      }
    },

    undo: async () => {
      if (!createdId) return
      try {
        const { setSelectedNodeId } = useAppStore.getState()
        await persistNodeContent(params.keeperId, params.originalHtml, true)
        const updated = await window.electronAPI.tree.permanentDelete(createdId)
        const withoutCreated = previousSiblingOrder.filter((i) => i.id !== createdId)
        let all = updated
        if (withoutCreated.length > 0) {
          all = await window.electronAPI.tree.reorder(withoutCreated)
        }
        syncNodes(all)
        setSelectedNodeId(params.previousSelectedId ?? params.keeperId)
        createdId = null
      } catch (err) {
        console.error('Undo split document failed:', err)
      }
    }
  }
}

export function makeMergeCommand(params: {
  keeperId: string
  absorbed: TreeNode
  keeperOriginalHtml: string
  absorbedHtml: string
  marker: string
  previousSelectedId: string | null
}): StructuralCommand {
  const absorbedParentId = params.absorbed.parentId
  const absorbedSortOrder = params.absorbed.sortOrder
  let siblingOrderBefore: { id: string; parentId: string | null; sortOrder: number }[] = []

  return {
    description: 'Merge with next',

    execute: async () => {
      try {
        const { nodes, setSelectedNodeId } = useAppStore.getState()
        const keeper = nodes.find((n) => n.id === params.keeperId && !n.deletedAt)
        if (!keeper) return

        const siblings =
          keeper.type === 'scene' && keeper.parentId
            ? getScenes(nodes, keeper.parentId)
            : getChildren(nodes, keeper.parentId ?? null, 'manuscript').filter(
                (n) => n.type === 'chapter' && isSimpleChapter(n)
              )
        siblingOrderBefore = siblings.map((n) => ({
          id: n.id,
          parentId: n.parentId ?? null,
          sortOrder: n.sortOrder
        }))

        const joined = joinHtmlDocuments(
          params.keeperOriginalHtml,
          params.absorbedHtml,
          params.marker
        )
        await persistNodeContent(params.keeperId, joined, true)
        const updated = await window.electronAPI.tree.moveToTrash(params.absorbed.id)
        syncNodes(updated)
        setSelectedNodeId(params.keeperId)
      } catch (err) {
        console.error('Merge with next failed:', err)
      }
    },

    undo: async () => {
      try {
        const { setSelectedNodeId } = useAppStore.getState()
        await persistNodeContent(params.keeperId, params.keeperOriginalHtml, true)
        let all = await window.electronAPI.tree.restore(
          params.absorbed.id,
          absorbedParentId ?? undefined
        )
        // Restore appends at end — put siblings back in original order.
        if (siblingOrderBefore.length > 0) {
          all = await window.electronAPI.tree.reorder(siblingOrderBefore)
        } else {
          all = await window.electronAPI.tree.reorder([
            {
              id: params.absorbed.id,
              parentId: absorbedParentId,
              sortOrder: absorbedSortOrder
            }
          ])
        }
        // Ensure absorbed content is restored (trash keeps content on disk).
        await window.electronAPI.tree.update(params.absorbed.id, {
          content: params.absorbedHtml
        })
        all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        setSelectedNodeId(params.previousSelectedId ?? params.keeperId)
      } catch (err) {
        console.error('Undo merge with next failed:', err)
      }
    }
  }
}

export function makeConvertScenesChapterToSimpleCommand(params: {
  chapterId: string
  sceneIds: string[]
  sceneSnapshots: { id: string; content: string; title: string; sortOrder: number; parentId: string | null }[]
  chapterOriginalContent: string
  chapterOriginalMetadata: string
  joinedHtml: string
  previousSelectedId: string | null
}): StructuralCommand {
  return {
    description: 'Convert to simple chapter',

    execute: async () => {
      try {
        const { setSelectedNodeId, selectContainer } = useAppStore.getState()
        await window.electronAPI.tree.update(params.chapterId, {
          content: params.joinedHtml,
          metadata: chapterMetaWithStructure(params.chapterOriginalMetadata, 'simple')
        })
        for (const sceneId of params.sceneIds) {
          await window.electronAPI.tree.moveToTrash(sceneId)
        }
        const all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        selectContainer(null)
        setSelectedNodeId(params.chapterId)
      } catch (err) {
        console.error('Convert scenes chapter to simple failed:', err)
      }
    },

    undo: async () => {
      try {
        const { setSelectedNodeId } = useAppStore.getState()
        await window.electronAPI.tree.update(params.chapterId, {
          content: params.chapterOriginalContent,
          metadata: params.chapterOriginalMetadata
        })
        for (const scene of params.sceneSnapshots) {
          await window.electronAPI.tree.restore(scene.id, scene.parentId ?? undefined)
        }
        const reorderItems = params.sceneSnapshots.map((s) => ({
          id: s.id,
          parentId: s.parentId,
          sortOrder: s.sortOrder
        }))
        let all = await window.electronAPI.tree.getAll()
        if (reorderItems.length > 0) {
          all = await window.electronAPI.tree.reorder(reorderItems)
        }
        for (const scene of params.sceneSnapshots) {
          await window.electronAPI.tree.update(scene.id, {
            content: scene.content,
            title: scene.title
          })
        }
        all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        setSelectedNodeId(params.previousSelectedId ?? params.chapterId)
      } catch (err) {
        console.error('Undo convert to simple chapter failed:', err)
      }
    }
  }
}

export function makeConvertSimpleToScenesChapterCommand(params: {
  chapterId: string
  chapterOriginalContent: string
  chapterOriginalMetadata: string
  previousSelectedId: string | null
}): StructuralCommand {
  let createdSceneId: string | null = null

  return {
    description: 'Convert to chapter with scenes',

    getCreatedId: () => createdSceneId,

    execute: async () => {
      try {
        const { nodes, setSelectedNodeId, selectContainer } = useAppStore.getState()
        const chapter = nodes.find((n) => n.id === params.chapterId)
        if (!chapter) return

        await window.electronAPI.tree.update(params.chapterId, {
          metadata: chapterMetaWithStructure(params.chapterOriginalMetadata, 'scenes')
        })
        const firstScene = await window.electronAPI.tree.create(
          params.chapterId,
          'scene',
          chapter.title
        )
        createdSceneId = firstScene.id
        await window.electronAPI.tree.update(firstScene.id, {
          content: params.chapterOriginalContent
        })
        await window.electronAPI.tree.update(params.chapterId, { content: '' })
        const all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        selectContainer(null)
        setSelectedNodeId(params.chapterId)
      } catch (err) {
        console.error('Convert simple to scenes chapter failed:', err)
      }
    },

    undo: async () => {
      if (!createdSceneId) return
      try {
        const { setSelectedNodeId } = useAppStore.getState()
        await window.electronAPI.tree.permanentDelete(createdSceneId)
        await window.electronAPI.tree.update(params.chapterId, {
          content: params.chapterOriginalContent,
          metadata: params.chapterOriginalMetadata
        })
        const all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        setSelectedNodeId(params.previousSelectedId ?? params.chapterId)
        createdSceneId = null
      } catch (err) {
        console.error('Undo convert to scenes chapter failed:', err)
      }
    }
  }
}

export function makePromoteSceneToSimpleChapterCommand(params: {
  scene: TreeNode
  previousSelectedId: string | null
}): StructuralCommand {
  let createdChapterId: string | null = null
  const sceneParentId = params.scene.parentId

  return {
    description: 'Convert scene to simple chapter',

    getCreatedId: () => createdChapterId,

    execute: async () => {
      try {
        const { nodes, setSelectedNodeId } = useAppStore.getState()
        const chapterParent = params.scene.parentId
          ? nodes.find((n) => n.id === params.scene.parentId)
          : null
        const newChapter = await window.electronAPI.tree.create(
          chapterParent?.parentId ?? null,
          'chapter',
          params.scene.title,
          { metadata: simpleChapterMetaFrom(params.scene) }
        )
        createdChapterId = newChapter.id
        await window.electronAPI.tree.update(newChapter.id, { content: params.scene.content })
        await window.electronAPI.tree.moveToTrash(params.scene.id)
        const all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        setSelectedNodeId(newChapter.id)
      } catch (err) {
        console.error('Promote scene to simple chapter failed:', err)
      }
    },

    undo: async () => {
      if (!createdChapterId) return
      try {
        const { setSelectedNodeId } = useAppStore.getState()
        await window.electronAPI.tree.permanentDelete(createdChapterId)
        await window.electronAPI.tree.restore(params.scene.id, sceneParentId ?? undefined)
        await window.electronAPI.tree.update(params.scene.id, {
          content: params.scene.content,
          title: params.scene.title
        })
        const all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        setSelectedNodeId(params.previousSelectedId ?? params.scene.id)
        createdChapterId = null
      } catch (err) {
        console.error('Undo promote scene to simple chapter failed:', err)
      }
    }
  }
}

export function makePromoteSceneToScenesChapterCommand(params: {
  scene: TreeNode
  previousSelectedId: string | null
}): StructuralCommand {
  let createdChapterId: string | null = null
  const sceneParentId = params.scene.parentId

  return {
    description: 'Convert scene to chapter with scenes',

    getCreatedId: () => createdChapterId,

    execute: async () => {
      try {
        const { nodes, setSelectedNodeId } = useAppStore.getState()
        const chapterParent = params.scene.parentId
          ? nodes.find((n) => n.id === params.scene.parentId)
          : null
        const newChapter = await window.electronAPI.tomes.createChapter(
          'scenes',
          chapterParent?.parentId ?? null
        )
        createdChapterId = newChapter.id
        await window.electronAPI.tree.update(newChapter.id, { title: params.scene.title })
        const allMid = await window.electronAPI.tree.getAll()
        const newScenes = allMid.filter(
          (n) => !n.deletedAt && n.type === 'scene' && n.parentId === newChapter.id
        )
        if (newScenes.length > 0) {
          await window.electronAPI.tree.update(newScenes[0].id, {
            content: params.scene.content,
            title: params.scene.title
          })
        }
        await window.electronAPI.tree.moveToTrash(params.scene.id)
        const all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        setSelectedNodeId(newChapter.id)
      } catch (err) {
        console.error('Promote scene to scenes chapter failed:', err)
      }
    },

    undo: async () => {
      if (!createdChapterId) return
      try {
        const { setSelectedNodeId } = useAppStore.getState()
        await window.electronAPI.tree.permanentDelete(createdChapterId)
        await window.electronAPI.tree.restore(params.scene.id, sceneParentId ?? undefined)
        await window.electronAPI.tree.update(params.scene.id, {
          content: params.scene.content,
          title: params.scene.title
        })
        const all = await window.electronAPI.tree.getAll()
        syncNodes(all)
        setSelectedNodeId(params.previousSelectedId ?? params.scene.id)
        createdChapterId = null
      } catch (err) {
        console.error('Undo promote scene to scenes chapter failed:', err)
      }
    }
  }
}

/** Resolve live content for a node (editor buffer preferred). */
export function resolveNodeContent(nodeId: string, fallback: string): string {
  const active = getActiveEditorInstance()
  if (active && active.nodeId === nodeId && !active.editor.isDestroyed) {
    return active.editor.getHTML()
  }
  return fallback
}
