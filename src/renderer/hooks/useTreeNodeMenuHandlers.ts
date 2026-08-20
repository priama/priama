import { useCallback, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { getSceneChapters, getScenes, isChapterFolder } from '@/lib/treeUtils'
import {
  convertSceneToSceneChapter,
  convertSceneToSimpleChapter,
  convertSimpleToSceneChapter,
  convertScenesChapterToSimpleChapter,
  mergeNodeWithNext,
  moveNodeToFolder,
  moveSceneToChapter
} from '@/lib/treeNodeMenuActions'
import type { TreeNode } from '@shared/types'

export function useTreeNodeMenuHandlers(): {
  moveSceneNode: TreeNode | null
  setMoveSceneNode: (node: TreeNode | null) => void
  handleMoveScene: (chapterId: string) => Promise<void>
  sceneChapters: TreeNode[]
  convertConfirm: { chapter: TreeNode; sceneCount: number } | null
  setConvertConfirm: (value: { chapter: TreeNode; sceneCount: number } | null) => void
  confirmConvertScenesToSimple: () => Promise<void>
  onMoveToFolder: (node: TreeNode, folderId: string) => void
  onMoveToChapter: (node: TreeNode, chapterId: string) => void
  onConvertToSimpleChapter: (node: TreeNode) => void
  onConvertToSceneChapter: (node: TreeNode) => void
  onConvertSimpleToSceneChapter: (node: TreeNode) => void
  onConvertScenesChapterToSimple: (node: TreeNode) => void
  onMergeWithNext: (node: TreeNode) => void
  onMoveTo: (node: TreeNode) => void
} {
  const nodes = useAppStore((s) => s.nodes)
  const [moveSceneNode, setMoveSceneNode] = useState<TreeNode | null>(null)
  const [convertConfirm, setConvertConfirm] = useState<{
    chapter: TreeNode
    sceneCount: number
  } | null>(null)

  const handleMoveScene = useCallback(async (chapterId: string): Promise<void> => {
    if (!moveSceneNode) return
    await moveSceneToChapter(moveSceneNode, chapterId)
    setMoveSceneNode(null)
  }, [moveSceneNode])

  const onMoveToFolder = useCallback((node: TreeNode, folderId: string): void => {
    void moveNodeToFolder(node, folderId)
  }, [])

  const onMoveToChapter = useCallback((node: TreeNode, chapterId: string): void => {
    void moveSceneToChapter(node, chapterId)
  }, [])

  const onConvertToSimpleChapter = useCallback((node: TreeNode): void => {
    void convertSceneToSimpleChapter(node)
  }, [])

  const onConvertToSceneChapter = useCallback((node: TreeNode): void => {
    void convertSceneToSceneChapter(node)
  }, [])

  const onConvertSimpleToSceneChapter = useCallback((node: TreeNode): void => {
    void convertSimpleToSceneChapter(node)
  }, [])

  const onConvertScenesChapterToSimple = useCallback((node: TreeNode): void => {
    if (!isChapterFolder(node)) return
    const scenes = getScenes(useAppStore.getState().nodes, node.id)
    if (scenes.length > 1) {
      setConvertConfirm({ chapter: node, sceneCount: scenes.length })
      return
    }
    void convertScenesChapterToSimpleChapter(node)
  }, [])

  const confirmConvertScenesToSimple = useCallback(async (): Promise<void> => {
    if (!convertConfirm) return
    await convertScenesChapterToSimpleChapter(convertConfirm.chapter)
    setConvertConfirm(null)
  }, [convertConfirm])

  const onMergeWithNext = useCallback((node: TreeNode): void => {
    void mergeNodeWithNext(node)
  }, [])

  const onMoveTo = useCallback((node: TreeNode): void => {
    setMoveSceneNode(node)
  }, [])

  return {
    moveSceneNode,
    setMoveSceneNode,
    handleMoveScene,
    sceneChapters: getSceneChapters(nodes),
    convertConfirm,
    setConvertConfirm,
    confirmConvertScenesToSimple,
    onMoveToFolder,
    onMoveToChapter,
    onConvertToSimpleChapter,
    onConvertToSceneChapter,
    onConvertSimpleToSceneChapter,
    onConvertScenesChapterToSimple,
    onMergeWithNext,
    onMoveTo
  }
}
