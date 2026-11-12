import { useAppStore } from '@/store/appStore'
import { getActiveEditorInstance } from '@/lib/activeEditor'
import { canMergeWithNext, canSplitAtCaret, canSplitNode } from '@/lib/splitMerge'
import { isWritingSurfaceOpen } from '@/lib/writingSurface'
import { SIDEBAR_EXPANDED_MIN_WIDTH, type WritingMenuState } from '@shared/types'

/**
 * The same state the native menu renders from: which items are enabled, and
 * which checkboxes and radios are ticked. The in-app menu on Windows reads this
 * too, so both menus agree without duplicating the rules.
 */
export function computeWritingMenuState(): WritingMenuState {
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

  return {
    focusMode: state.focusMode,
    focusModeEnabled: writingSurfaceOpen,
    typewriterScrolling: state.typewriterScrolling,
    entityHighlights: state.entityHighlights,
    canSplitDocument,
    canMergeWithNext: canMerge,
    sidebarVisible: state.sidebarWidth >= SIDEBAR_EXPANDED_MIN_WIDTH,
    sidebarEnabled: state.isProjectOpen
  }
}

/** Push Edit-menu enablement for split/merge (and focus chrome) to the main process. */

// Typing moves the caret on every keystroke, but the menu state almost never changes
// while writing. Compute at most once per pause, and only send when something the menu
// renders actually differs from what the main process was last given.
const SYNC_DEBOUNCE_MS = 150

let pendingTimer: ReturnType<typeof setTimeout> | null = null
let lastSent: WritingMenuState | null = null

function sameMenuState(a: WritingMenuState, b: WritingMenuState): boolean {
  return (
    a.focusMode === b.focusMode &&
    a.focusModeEnabled === b.focusModeEnabled &&
    a.typewriterScrolling === b.typewriterScrolling &&
    a.entityHighlights === b.entityHighlights &&
    a.canSplitDocument === b.canSplitDocument &&
    a.canMergeWithNext === b.canMergeWithNext &&
    a.sidebarVisible === b.sidebarVisible &&
    a.sidebarEnabled === b.sidebarEnabled
  )
}

export function syncWritingMenuState(): void {
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    const state = computeWritingMenuState()
    if (lastSent && sameMenuState(lastSent, state)) return
    lastSent = state
    void window.electronAPI.app.setWritingMenuState(state)
  }, SYNC_DEBOUNCE_MS)
}
