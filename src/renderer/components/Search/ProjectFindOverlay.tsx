import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CaseSensitive, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/UI/dialog'
import { Button } from '@/components/UI/button'
import { ScrollArea } from '@/components/UI/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip'
import { useAppStore } from '@/store/appStore'
import { mergeIncomingNodes } from '@/lib/contentPersistence'
import {
  projectSearch,
  type ProjectSearchHit,
  type ProjectSearchSource
} from '@/lib/projectSearch'
import { openProjectSearchHit } from '@/lib/openProjectSearchHit'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 150
const LIST_ID = 'project-find-results'

const SOURCE_LABEL: Record<Exclude<ProjectSearchSource, 'prose'>, string> = {
  title: 'Title',
  synopsis: 'Synopsis',
  alias: 'Alias'
}

function sourcePill(source: ProjectSearchSource): string | null {
  if (source === 'prose') return null
  return SOURCE_LABEL[source]
}

export function ProjectFindOverlay(): React.JSX.Element {
  const projectFindOpen = useAppStore((s) => s.projectFindOpen)
  const setProjectFindOpen = useAppStore((s) => s.setProjectFindOpen)
  const nodes = useAppStore((s) => s.nodes)
  const categories = useAppStore((s) => s.categories)

  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Session restore: keep last query while overlay remounts within the same project.
  const sessionQueryRef = useRef('')
  const sessionCaseRef = useRef(false)

  useEffect(() => {
    if (!projectFindOpen) return
    setQuery(sessionQueryRef.current)
    setCaseSensitive(sessionCaseRef.current)
    setDebouncedQuery(sessionQueryRef.current)
    setActiveIndex(0)
    const focus = (): void => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    const t = window.setTimeout(focus, 0)
    const onRefocus = (): void => focus()
    window.addEventListener('project-find:refocus', onRefocus)
    return () => {
      clearTimeout(t)
      window.removeEventListener('project-find:refocus', onRefocus)
    }
  }, [projectFindOpen])

  useEffect(() => {
    sessionQueryRef.current = query
  }, [query])

  useEffect(() => {
    sessionCaseRef.current = caseSensitive
  }, [caseSensitive])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query)
      setActiveIndex(0)
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  const { hits, truncated } = useMemo(() => {
    if (!projectFindOpen) return { hits: [] as ProjectSearchHit[], truncated: false }
    const live = mergeIncomingNodes(nodes)
    return projectSearch(live, categories, {
      query: debouncedQuery,
      caseSensitive
    })
  }, [projectFindOpen, nodes, categories, debouncedQuery, caseSensitive])

  useEffect(() => {
    if (activeIndex >= hits.length) setActiveIndex(hits.length > 0 ? hits.length - 1 : 0)
  }, [hits.length, activeIndex])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-hit-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const close = useCallback((): void => {
    setProjectFindOpen(false)
  }, [setProjectFindOpen])

  const openHit = useCallback(
    (hit: ProjectSearchHit): void => {
      void openProjectSearchHit(hit, debouncedQuery.trim(), caseSensitive)
    },
    [debouncedQuery, caseSensitive]
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

  const trimmed = debouncedQuery.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < 2
  const emptyQuery = trimmed.length === 0

  let emptyMessage = ''
  if (emptyQuery) emptyMessage = 'Type at least two characters'
  else if (tooShort) emptyMessage = 'Type at least two characters'
  else if (hits.length === 0) emptyMessage = 'No matches'

  // Group visually: show title/breadcrumb when nodeId changes in the list.
  let lastGroupNodeId: string | null = null

  const perDocument = new Map<string, number>()
  for (const hit of hits) perDocument.set(hit.nodeId, (perDocument.get(hit.nodeId) ?? 0) + 1)
  const documentCount = perDocument.size

  return (
    <Dialog
      open={projectFindOpen}
      onOpenChange={(open) => {
        if (!open) close()
        else setProjectFindOpen(true)
      }}
    >
      <DialogContent
        hideCloseButton
        overlayClassName="bg-black/35 backdrop-blur-[2px]"
        aria-label="Find in project"
        className="top-[18%] max-h-[min(80vh,40rem)] w-[min(40rem,calc(100vw-3rem))] max-w-none translate-y-0 gap-0 overflow-hidden rounded-xl border-border/80 p-0 shadow-2xl"
        onKeyDown={onKeyDown}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogTitle className="sr-only">Find in project</DialogTitle>
        <DialogDescription className="sr-only">
          Search manuscript, titles, synopsis, and wiki names across the project
        </DialogDescription>

        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in project…"
            className="h-9 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            aria-controls={LIST_ID}
            aria-activedescendant={
              hits[activeIndex] ? `project-find-hit-${hits[activeIndex].id}` : undefined
            }
            aria-autocomplete="list"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-haspopup="listbox"
          />
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 shrink-0',
                    caseSensitive && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => setCaseSensitive((v) => !v)}
                  aria-pressed={caseSensitive}
                >
                  <CaseSensitive className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Case sensitive</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <ScrollArea className="max-h-[min(60vh,28rem)]">
          <div
            ref={listRef}
            id={LIST_ID}
            role="listbox"
            aria-label="Search results"
            className="py-1"
          >
            {emptyMessage ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              hits.map((hit, index) => {
                const showHeader = hit.nodeId !== lastGroupNodeId
                lastGroupNodeId = hit.nodeId
                const pill = sourcePill(hit.source)
                return (
                  <div key={hit.id}>
                    {showHeader && (
                      <div className="flex min-w-0 items-center gap-3 px-4 pb-0.5 pt-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-foreground">
                            {hit.title}
                          </div>
                          {hit.breadcrumb && hit.breadcrumb !== hit.title && (
                            <div
                              className="truncate-start text-[11px] text-muted-foreground"
                              title={hit.breadcrumb}
                            >
                              {hit.breadcrumb}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {perDocument.get(hit.nodeId)}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      id={`project-find-hit-${hit.id}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      data-hit-index={index}
                      className={cn(
                        'flex w-full items-start gap-2 px-4 py-1.5 text-left text-sm',
                        index === activeIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted/60'
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openHit(hit)}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-muted-foreground">{hit.snippet.before}</span>
                        <mark className="rounded-sm bg-yellow-400/40 px-0.5 text-foreground dark:bg-yellow-300/30">
                          {hit.snippet.match}
                        </mark>
                        <span className="text-muted-foreground">{hit.snippet.after}</span>
                      </span>
                      {pill && (
                        <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {pill}
                        </span>
                      )}
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
            {truncated
              ? '200+ — narrow the query'
              : hits.length > 0
                ? `${hits.length} match${hits.length === 1 ? '' : 'es'} in ${documentCount} document${documentCount === 1 ? '' : 's'}`
                : ''}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
