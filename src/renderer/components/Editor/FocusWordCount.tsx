import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useWordCount } from '@/hooks/useWordCount'
import { cn } from '@/lib/utils'

interface FocusWordCountProps {
  editor: Editor | null
  className?: string
}

const IDLE_MS = 1200

/** Fades in after typing pauses; fades out while the user is typing. */
export function FocusWordCount({ editor, className }: FocusWordCountProps): React.JSX.Element {
  const wordCount = useWordCount(editor)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(false)
    const timer = window.setTimeout(() => setVisible(true), IDLE_MS)
    return () => window.clearTimeout(timer)
  }, [wordCount])

  return (
    <div
      className={cn(
        'pointer-events-none select-none text-xs text-muted-foreground transition-opacity duration-500',
        visible ? 'opacity-70' : 'opacity-0',
        className
      )}
      aria-live="polite"
    >
      {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
    </div>
  )
}
