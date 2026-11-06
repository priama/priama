import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface SpellSuggestionsProps {
  x: number
  y: number
  word: string
  suggestions: string[]
  message?: string
  isCustomWord?: boolean
  onSelect: (replacement: string) => void
  onAddToDictionary: () => void
  onRemoveFromDictionary?: () => void
  onClose: () => void
}

const POPUP_MAX_HEIGHT = 260

export function SpellSuggestions({
  x,
  y,
  word,
  suggestions,
  message,
  isCustomWord,
  onSelect,
  onAddToDictionary,
  onRemoveFromDictionary,
  onClose
}: SpellSuggestionsProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // A known height means we can flip above the caret instead of guessing at a gap
  // below it — which is what pinning to innerHeight - 300 was doing.
  const flipUp = y + POPUP_MAX_HEIGHT > window.innerHeight
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 200),
    ...(flipUp ? { bottom: window.innerHeight - y + 6 } : { top: y + 6 }),
    maxHeight: POPUP_MAX_HEIGHT,
    zIndex: 9999
  }

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="min-w-[180px] overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md"
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border mb-1">
        &ldquo;{word}&rdquo;
        {message && (
          <p className="mt-0.5 text-xs font-normal text-muted-foreground/70 leading-tight">
            {message}
          </p>
        )}
      </div>

      {suggestions.length > 0 ? (
        suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(s)
            }}
            className={cn(
              'w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
              'focus:bg-accent focus:text-accent-foreground focus:outline-none'
            )}
          >
            {s}
          </button>
        ))
      ) : (
        <p className="px-3 py-1.5 text-xs text-muted-foreground/60 italic">No suggestions</p>
      )}

      <div className="my-1 border-t border-border" />
      {isCustomWord && onRemoveFromDictionary ? (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onRemoveFromDictionary()
          }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none text-muted-foreground"
        >
          Remove from dictionary
        </button>
      ) : (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onAddToDictionary()
          }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none text-muted-foreground"
        >
          Add to dictionary
        </button>
      )}
    </div>,
    document.body
  )
}
