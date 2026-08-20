import { getActiveEditorInstance } from '@/lib/activeEditor'
import { useHistoryStore } from '@/store/historyStore'

export function editorCanUndo(): boolean {
  const active = getActiveEditorInstance()
  if (!active || active.editor.isDestroyed) return false
  try {
    return active.editor.can().undo()
  } catch {
    return false
  }
}

export function editorCanRedo(): boolean {
  const active = getActiveEditorInstance()
  if (!active || active.editor.isDestroyed) return false
  try {
    return active.editor.can().redo()
  } catch {
    return false
  }
}

/**
 * Prefer TipTap undo when the live writing surface can undo; otherwise
 * structural history. After split/merge we clear editor history so the
 * next Cmd+Z undoes the structural command.
 */
export async function coordinatedUndo(): Promise<void> {
  const active = getActiveEditorInstance()
  if (active && editorCanUndo()) {
    active.editor.commands.undo()
    return
  }
  if (useHistoryStore.getState().canUndo) {
    await useHistoryStore.getState().undo()
  }
}

export async function coordinatedRedo(): Promise<void> {
  const active = getActiveEditorInstance()
  if (active && editorCanRedo()) {
    active.editor.commands.redo()
    return
  }
  if (useHistoryStore.getState().canRedo) {
    await useHistoryStore.getState().redo()
  }
}
