import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import type { BlockStyleType } from '@/components/Editor/BlockStyle'

const STYLE_SHORTCUTS: { key: string; style: BlockStyleType }[] = [
  { key: '1', style: 'title' },
  { key: '2', style: 'heading1' },
  { key: '3', style: 'heading2' },
  { key: '4', style: 'heading3' },
  { key: '5', style: 'subheading' },
  { key: '6', style: 'body' },
  { key: '7', style: 'caption' },
  { key: '8', style: 'blockquote' },
  { key: '9', style: 'code' }
]

/** Cmd/Ctrl+Alt+1–9 block styles — lives outside the toolbar so focus mode keeps them. */
export function useBlockStyleShortcuts(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return

    const onKeyDown = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || !e.altKey || e.shiftKey) return
      const match = STYLE_SHORTCUTS.find((s) => s.key === e.key)
      if (!match) return
      e.preventDefault()
      editor.chain().focus().setBlockStyle(match.style).run()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor])
}
