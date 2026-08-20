import { useAppStore } from '@/store/appStore'
import { getActiveEditorInstance } from '@/lib/activeEditor'
import { canMergeWithNext, canSplitAtCaret, canSplitNode } from '@/lib/splitMerge'
import { isWritingSurfaceOpen } from '@/lib/writingSurface'

/** Push Edit-menu enablement for split/merge (and focus chrome) to the main process. */
export function syncWritingMenuState(): void {
  const state = useAppStore.getState()
  const selectedNode =
    state.nodes.find((n) => n.id === state.selectedNodeId && !n.deletedAt) ?? null
  const writingSurfaceOpen =
    state.isProjectOpen &&
    isWritingSurfaceOpen({
      selectedContainerId: state.selectedContainerId,
      selectedNode,
      categories: state.categories
    })

  const active = getActiveEditorInstance()
  const editorNode =
    active && !active.editor.isDestroyed
      ? state.nodes.find((n) => n.id === active.nodeId && !n.deletedAt)
      : null

  const canSplitDocument =
    !!editorNode &&
    canSplitNode(editorNode, state.nodes) &&
    canSplitAtCaret(active!.editor)

  const mergeTarget = editorNode ?? selectedNode
  const canMerge =
    !!mergeTarget &&
    writingSurfaceOpen &&
    canMergeWithNext(mergeTarget, state.nodes)

  void window.electronAPI.app.setWritingMenuState({
    focusMode: state.focusMode,
    focusModeEnabled: writingSurfaceOpen,
    typewriterScrolling: state.typewriterScrolling,
    entityHighlights: state.entityHighlights,
    canSplitDocument,
    canMergeWithNext: canMerge
  })
}
