import { useCallback, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { getSceneChapters } from '@/lib/treeUtils'
import {
  convertSceneToSceneChapter,
  convertSceneToSimpleChapter,
  convertSimpleToSceneChapter,
  moveNodeToFolder,
  moveSceneToChapter
} from '@/lib/treeNodeMenuActions'
import type { TreeNode } from '@shared/types'

export function useTreeNodeMenuHandlers(): {
  moveSceneNode: TreeNode | null
  setMoveSceneNode: (node: TreeNode | null) => void
  handleMoveScene: (chapterId: string) => Promise<void>
  sceneChapters: TreeNode[]
  onMoveToFolder: (node: TreeNode, folderId: string) => void
  onMoveToChapter: (node: TreeNode, chapterId: string) => void
  onConvertToSimpleChapter: (node: TreeNode) => void
  onConvertToSceneChapter: (node: TreeNode) => void
  onConvertSimpleToSceneChapter: (node: TreeNode) => void
  onMoveTo: (node: TreeNode) => void
} {
  const nodes = useAppStore((s) => s.nodes)
  const [moveSceneNode, setMoveSceneNode] = useState<TreeNode | null>(null)

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

  const onMoveTo = useCallback((node: TreeNode): void => {
    setMoveSceneNode(node)
  }, [])

  return {
    moveSceneNode,
    setMoveSceneNode,
    handleMoveScene,
    sceneChapters: getSceneChapters(nodes),
    onMoveToFolder,
    onMoveToChapter,
    onConvertToSimpleChapter,
    onConvertToSceneChapter,
    onConvertSimpleToSceneChapter,
    onMoveTo
  }
}
