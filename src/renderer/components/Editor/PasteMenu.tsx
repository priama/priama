import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Clipboard, ClipboardPaste } from 'lucide-react'

interface PasteMenuProps {
  x: number
  y: number
  onPasteRich: () => void
  onPasteClean: () => void
  onClose: () => void
}

export function PasteMenu({
  x,
  y,
  onPasteRich,
  onPasteClean,
  onClose
}: PasteMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (!e.metaKey && !e.ctrlKey && e.key.length === 1) onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y + 8, window.innerHeight - 100),
    zIndex: 9999
  }

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="min-w-[200px] rounded-md border border-border bg-popover py-1 shadow-md"
    >
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onPasteRich()
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none"
      >
        <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
        Paste
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onPasteClean()
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none"
      >
        <ClipboardPaste className="h-3.5 w-3.5 text-muted-foreground" />
        Paste without formatting
      </button>
    </div>,
    document.body
  )
}
