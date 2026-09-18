import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import { getActiveEditorInstance, clearEditorHistory } from '@/lib/activeEditor'
import {
  makeSplitCommand,
  makeMergeCommand,
  makeConvertScenesChapterToSimpleCommand,
  makeConvertSimpleToScenesChapterCommand,
  makePromoteSceneToSimpleChapterCommand,
  makePromoteSceneToScenesChapterCommand
} from '@/lib/commands'
import { flushNode, getLiveContent } from '@/lib/contentPersistence'
import {
  canMergeWithNext,
  canSplitAtCaret,
  canSplitNode,
  joinHtmlDocuments,
  nextSiblingOfKind,
  sliceDocAtPos
} from '@/lib/splitMerge'
import { getScenes, isChapterFolder, isSimpleChapter } from '@/lib/treeUtils'
import { DEFAULT_BOOK_SETTINGS } from '@shared/types'
import type { TreeNode } from '@shared/types'

function sceneBreakMarker(): string {
  return (
    useAppStore.getState().projectMeta?.bookSettings?.sceneBreakMarker ??
    DEFAULT_BOOK_SETTINGS.sceneBreakMarker
  )
}

export async function splitDocumentAtCaret(): Promise<boolean> {
  const active = getActiveEditorInstance()
  if (!active) return false

  const { nodes, selectedNodeId } = useAppStore.getState()
  const node = nodes.find((n) => n.id === active.nodeId && !n.deletedAt)
  if (!node || !canSplitNode(node, nodes)) return false
  if (!canSplitAtCaret(active.editor)) return false

  const pos = active.editor.state.selection.from
  const sliced = sliceDocAtPos(active.editor, pos)
  if (!sliced) return false

  const originalHtml = active.editor.getHTML()
  await useHistoryStore.getState().push(
    makeSplitCommand({
      keeperId: node.id,
      originalHtml,
      aboveHtml: sliced.aboveHtml,
      belowHtml: sliced.belowHtml,
      previousSelectedId: selectedNodeId
    })
  )
  return true
}

export async function mergeWithNext(node?: TreeNode): Promise<boolean> {
  const { nodes, selectedNodeId } = useAppStore.getState()
  const target =
    node ??
    (selectedNodeId
      ? nodes.find((n) => n.id === selectedNodeId && !n.deletedAt)
      : null)
  if (!target || !canMergeWithNext(target, nodes)) return false

  const next = nextSiblingOfKind(target, nodes)
  if (!next) return false

  const keeperHtml = getLiveContent(target.id, target.content)
  const absorbedHtml = getLiveContent(next.id, next.content)

  await useHistoryStore.getState().push(
    makeMergeCommand({
      keeperId: target.id,
      absorbed: { ...next, content: absorbedHtml },
      keeperOriginalHtml: keeperHtml,
      absorbedHtml,
      marker: sceneBreakMarker(),
      previousSelectedId: selectedNodeId
    })
  )
  return true
}

export async function convertScenesChapterToSimple(chapter: TreeNode): Promise<void> {
  const { nodes, selectedNodeId } = useAppStore.getState()
  if (!isChapterFolder(chapter)) return

  // The open scene's latest keystrokes live in the editor, not the store.
  const scenes = getScenes(nodes, chapter.id).map((s) => ({
    ...s,
    content: getLiveContent(s.id, s.content)
  }))
  if (scenes.length === 0) return

  const marker = sceneBreakMarker()
  let joined = scenes[0].content
  for (let i = 1; i < scenes.length; i++) {
    joined = joinHtmlDocuments(joined, scenes[i].content, marker)
  }

  await useHistoryStore.getState().push(
    makeConvertScenesChapterToSimpleCommand({
      chapterId: chapter.id,
      sceneIds: scenes.map((s) => s.id),
      sceneSnapshots: scenes.map((s) => ({
        id: s.id,
        content: s.content,
        title: s.title,
        sortOrder: s.sortOrder,
        parentId: s.parentId
      })),
      chapterOriginalContent: getLiveContent(chapter.id, chapter.content),
      chapterOriginalMetadata: chapter.metadata,
      joinedHtml: joined,
      previousSelectedId: selectedNodeId
    })
  )
}

export async function convertSimpleToSceneChapter(chapter: TreeNode): Promise<void> {
  if (!isSimpleChapter(chapter)) return
  // The command empties the chapter body; a debounced write still pending for it would
  // land afterwards and put the old text back.
  await flushNode(chapter.id)
  const { selectedNodeId } = useAppStore.getState()
  const content = getLiveContent(chapter.id, chapter.content)

  // Sync editor so we don't lose live buffer when clearing chapter content.
  const active = getActiveEditorInstance()
  if (active && active.nodeId === chapter.id) {
    clearEditorHistory(active.editor)
  }

  await useHistoryStore.getState().push(
    makeConvertSimpleToScenesChapterCommand({
      chapterId: chapter.id,
      chapterOriginalContent: content,
      chapterOriginalMetadata: chapter.metadata,
      previousSelectedId: selectedNodeId
    })
  )
}

export async function convertSceneToSimpleChapter(scene: TreeNode): Promise<void> {
  const { selectedNodeId } = useAppStore.getState()
  const content = getLiveContent(scene.id, scene.content)
  await useHistoryStore.getState().push(
    makePromoteSceneToSimpleChapterCommand({
      scene: { ...scene, content },
      previousSelectedId: selectedNodeId
    })
  )
}

export async function convertSceneToSceneChapter(scene: TreeNode): Promise<void> {
  const { selectedNodeId } = useAppStore.getState()
  const content = getLiveContent(scene.id, scene.content)
  await useHistoryStore.getState().push(
    makePromoteSceneToScenesChapterCommand({
      scene: { ...scene, content },
      previousSelectedId: selectedNodeId
    })
  )
}
