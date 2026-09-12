import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/UI/dialog'
import { ScrollArea } from '@/components/UI/scroll-area'
import { useAppStore } from '@/store/appStore'
import { openCategoryItem } from '@/lib/categoryNavigation'
import { listQuickOpenCandidates, searchQuickOpen, type QuickOpenHit } from '@/lib/quickOpen'
import { cn } from '@/lib/utils'

const LIST_ID = 'quick-open-results'

const GROUP_LABEL: Record<QuickOpenHit['group'], string> = {
  manuscript: 'Manuscript',
  wiki: 'Wiki'
}

function HighlightedText({
  text,
  positions
}: {
  text: string
  positions: number[]
}): React.JSX.Element {
  if (positions.length === 0) return <>{text}</>

  const set = new Set(positions)
  const parts: React.ReactNode[] = []
  let i = 0
  while (i < text.length) {
    const marked = set.has(i)
    let j = i + 1
    while (j < text.length && set.has(j) === marked) j++
    const slice = text.slice(i, j)
    if (marked) {
      parts.push(
        <mark
          key={i}
          className="rounded-sm bg-yellow-400/40 text-foreground dark:bg-yellow-300/30"
        >
          {slice}
        </mark>
      )
    } else {
      parts.push(<span key={i}>{slice}</span>)
    }
    i = j
  }
  return <>{parts}</>
}

export function QuickOpenOverlay(): React.JSX.Element {
  const quickOpenOpen = useAppStore((s) => s.quickOpenOpen)
  const setQuickOpenOpen = useAppStore((s) => s.setQuickOpenOpen)
  const nodes = useAppStore((s) => s.nodes)
  const categories = useAppStore((s) => s.categories)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!quickOpenOpen) return
    setQuery('')
    setActiveIndex(0)
    const focus = (): void => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    const t = window.setTimeout(focus, 0)
    const onRefocus = (): void => focus()
    window.addEventListener('quick-open:refocus', onRefocus)
    return () => {
      clearTimeout(t)
      window.removeEventListener('quick-open:refocus', onRefocus)
    }
  }, [quickOpenOpen])

  const hits = useMemo(() => {
    if (!quickOpenOpen) return [] as QuickOpenHit[]
    return searchQuickOpen(listQuickOpenCandidates(nodes, categories), query)
  }, [quickOpenOpen, nodes, categories, query])

  useEffect(() => {
    if (activeIndex >= hits.length) setActiveIndex(hits.length > 0 ? hits.length - 1 : 0)
  }, [hits.length, activeIndex])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-hit-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const close = useCallback((): void => {
    setQuickOpenOpen(false)
  }, [setQuickOpenOpen])

  const openHit = useCallback(
    (hit: QuickOpenHit): void => {
      setQuickOpenOpen(false)
      void openCategoryItem(hit.nodeId)
    },
    [setQuickOpenOpen]
  )

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.nativeEvent.isComposing) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (hits.length === 0) return
      setActiveIndex((i) => (i + 1) % hits.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (hits.length === 0) return
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[activeIndex]
      if (hit) openHit(hit)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const trimmed = query.trim()
  const emptyMessage = hits.length === 0 ? (trimmed ? 'No matching titles' : 'No titles to open') : ''

  let lastGroup: QuickOpenHit['group'] | null = null

  return (
    <Dialog
      open={quickOpenOpen}
      onOpenChange={(open) => {
        if (!open) close()
        else setQuickOpenOpen(true)
      }}
    >
      <DialogContent
        hideCloseButton
        overlayClassName="bg-black/35 backdrop-blur-[2px]"
        aria-label="Quick open"
        className="top-[18%] max-h-[min(80vh,40rem)] w-[min(40rem,calc(100vw-3rem))] max-w-none translate-y-0 gap-0 overflow-hidden rounded-xl border-border/80 p-0 shadow-2xl"
        onKeyDown={onKeyDown}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogTitle className="sr-only">Quick open</DialogTitle>
        <DialogDescription className="sr-only">
          Jump to a chapter, scene, or wiki title
        </DialogDescription>

        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="Go to chapter, scene, or wiki…"
            className="h-9 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            aria-controls={LIST_ID}
            aria-activedescendant={
              hits[activeIndex] ? `quick-open-hit-${hits[activeIndex].nodeId}` : undefined
            }
            aria-autocomplete="list"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-haspopup="listbox"
          />
        </div>

        <ScrollArea className="max-h-[min(60vh,28rem)]">
          <div
            ref={listRef}
            id={LIST_ID}
            role="listbox"
            aria-label="Titles"
            className="py-1"
          >
            {emptyMessage ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              hits.map((hit, index) => {
                const showHeader = hit.group !== lastGroup
                lastGroup = hit.group
                return (
                  <div key={hit.nodeId}>
                    {showHeader && (
                      <div className="px-4 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {GROUP_LABEL[hit.group]}
                      </div>
                    )}
                    <button
                      type="button"
                      id={`quick-open-hit-${hit.nodeId}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      data-hit-index={index}
                      className={cn(
                        'flex w-full flex-col items-start px-4 py-1.5 text-left',
                        index === activeIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted/60'
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openHit(hit)}
                    >
                      <span className="w-full truncate text-sm">
                        <HighlightedText text={hit.title} positions={hit.positions} />
                        {hit.matchedAlias ? (
                          <span className="text-muted-foreground">
                            {' · '}
                            <HighlightedText
                              text={hit.matchedPhrase}
                              positions={hit.aliasPositions}
                            />
                          </span>
                        ) : null}
                      </span>
                      {hit.breadcrumb && hit.breadcrumb !== hit.title ? (
                        <span className="w-full truncate text-[11px] text-muted-foreground">
                          {hit.breadcrumb}
                        </span>
                      ) : null}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="rounded border border-border px-1">↑↓</kbd> navigate ·{' '}
            <kbd className="rounded border border-border px-1">↵</kbd> open ·{' '}
            <kbd className="rounded border border-border px-1">esc</kbd> close
          </span>
          <span>
            {hits.length > 0
              ? `${hits.length} title${hits.length === 1 ? '' : 's'}`
              : ''}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
