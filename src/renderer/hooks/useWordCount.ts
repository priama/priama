import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Word count without serializing the document: walk the ProseMirror text directly.
 * Memoized on the doc object — ProseMirror docs are immutable, so identical means
 * unchanged, and two subscribers of the same transaction share one count.
 */
let lastDoc: PMNode | null = null
let lastCount = 0

export function countDocWords(doc: PMNode): number {
  if (doc === lastDoc) return lastCount
  const text = doc.textBetween(0, doc.content.size, ' ', ' ')
  const count = text ? text.split(/\s+/).filter(Boolean).length : 0
  lastDoc = doc
  lastCount = count
  return count
}

/** Live word count for the open editor. Only re-renders the caller when the count changes. */
export function useWordCount(editor: Editor | null): number {
  // The `editor: Editor | null` overload makes the result nullable until an editor exists.
  return useEditorState({
    editor,
    selector: ({ editor: ed }) => (ed ? countDocWords(ed.state.doc) : 0)
  }) ?? 0
}
