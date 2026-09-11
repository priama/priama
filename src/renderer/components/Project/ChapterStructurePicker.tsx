import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Files, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChapterStructure } from '@shared/types'

const OPTIONS = [
  {
    id: 'simple' as const,
    icon: FileText,
    title: 'Simple Chapter',
    description: 'One continuous document. Best for linear writers and short chapters.'
  },
  {
    id: 'scenes' as const,
    icon: Files,
    title: 'Chapter with Scenes',
    description: 'A chapter folder containing multiple scene documents. Best for beats and POV shifts.'
  }
]

const EXPAND_MS = 200

interface ChapterStructurePickerProps {
  onSelect: (structure: ChapterStructure) => void
  className?: string
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ChapterStructurePicker({
  onSelect,
  className
}: ChapterStructurePickerProps): React.JSX.Element {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null
  )

  const measure = useCallback((): void => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setAnchor({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [])

  const close = useCallback((): void => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setExpanded(false)
    const delay = prefersReducedMotion() ? 0 : EXPAND_MS
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setAnchor(null)
      closeTimerRef.current = null
    }, delay)
  }, [])

  const openPicker = useCallback((): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    measure()
    setOpen(true)
  }, [measure])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    let inner = 0
    const outer = requestAnimationFrame(() => {
      if (prefersReducedMotion()) {
        setExpanded(true)
        return
      }
      inner = requestAnimationFrame(() => setExpanded(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = (): void => measure()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    const onPointer = (e: PointerEvent): void => {
      const t = e.target as Node
      if (surfaceRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Add chapter"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.stopPropagation()
          if (open) close()
          else openPicker()
        }}
        className={cn(
          'shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground',
          open && 'invisible',
          className
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {open &&
        anchor &&
        createPortal(
          <div
            ref={surfaceRef}
            role="dialog"
            aria-label="Add chapter"
            className="chapter-picker-surface no-drag z-[200] text-popover-foreground"
            style={{ top: anchor.top, left: anchor.left }}
          >
            <button
              type="button"
              aria-label="Close chapter picker"
              onClick={(e) => {
                e.stopPropagation()
                close()
              }}
              className="flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              style={{ width: anchor.width, height: anchor.height }}
            >
              <Plus
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200 ease-in-out motion-reduce:transition-none',
                  expanded && 'rotate-45'
                )}
              />
            </button>
            <div
              className={cn(
                'chapter-picker-body min-h-0 overflow-hidden',
                expanded ? 'chapter-picker-body-open' : 'chapter-picker-body-closed'
              )}
            >
              <div className="chapter-picker-cards grid w-[min(18.5rem,calc(100vw-3rem))] gap-2 p-2 pl-1">
                {OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        close()
                        onSelect(opt.id)
                      }}
                      className="no-drag flex gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary hover:bg-accent/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{opt.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
