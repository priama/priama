import type { Editor } from '@tiptap/react'
import { EditorState } from '@tiptap/pm/state'

let activeEditor: Editor | null = null
let activeNodeId: string | null = null

export function registerActiveEditorInstance(
  editor: Editor | null,
  nodeId: string | null
): void {
  activeEditor = editor
  activeNodeId = editor && nodeId ? nodeId : null
}

export function getActiveEditorInstance(): {
  editor: Editor
  nodeId: string
} | null {
  if (!activeEditor || !activeNodeId || activeEditor.isDestroyed) return null
  return { editor: activeEditor, nodeId: activeNodeId }
}

/** Reset TipTap/ProseMirror undo history while keeping the current doc and selection. */
export function clearEditorHistory(editor: Editor): void {
  if (editor.isDestroyed) return
  editor.view.updateState(
    EditorState.create({
      doc: editor.state.doc,
      plugins: editor.state.plugins,
      selection: editor.state.selection
    })
  )
}
