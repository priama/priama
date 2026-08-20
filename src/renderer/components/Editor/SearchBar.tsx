import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  ChevronUp,
  ChevronDown,
  X,
  CaseSensitive,
  Replace,
  ReplaceAll
} from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { Input } from '@/components/UI/input'
import { Button } from '@/components/UI/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/UI/tooltip'
import { cn } from '@/lib/utils'
import type { SearchAndReplaceStorage } from './searchAndReplace'

interface SearchBarProps {
  editor: Editor
  onClose: () => void
  defaultShowReplace?: boolean
  focusKey?: number
}

/** Force decoration refresh. Never focuses the editor — safe while typing in the search bar. */
function refreshSearch(editor: Editor): void {
  // Intentional no-op transaction: commands mutate storage without dispatching,
  // so the plugin won't re-run otherwise. This also triggers the SearchBar
  // `transaction` listener — expect one React re-render per call.
  editor.view.dispatch(editor.state.tr)
}

/** Scroll the active match into view without stealing focus from the search bar. */
function scrollToActiveMatch(editor: Editor): void {
  const storage = editor.storage.searchAndReplace as SearchAndReplaceStorage
  const match = storage.results[storage.resultIndex]
  if (!match) return

  const { node } = editor.view.domAtPos(match.from)
  const el =
    node.nodeType === Node.TEXT_NODE ? (node.parentElement as HTMLElement | null) : (node as HTMLElement)
  el?.scrollIntoView({ block: 'nearest' })
}

export function SearchBar({
  editor,
  onClose,
  defaultShowReplace = false,
  focusKey = 0
}: SearchBarProps): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [showReplace, setShowReplace] = useState(defaultShowReplace)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [focusKey])

  // Re-render on editor transactions for match count / disabled states.
  // Coupled to syncSearch() dispatch — intentional, do not remove.
  useEffect(() => {
    const refresh = (): void => forceUpdate()
    editor.on('transaction', refresh)
    return () => {
      editor.off('transaction', refresh)
    }
  }, [editor])

  useEffect(() => {
    editor.commands.setSearchTerm(searchTerm)
    refreshSearch(editor)
  }, [searchTerm, editor])

  useEffect(() => {
    editor.commands.setReplaceTerm(replaceTerm)
  }, [replaceTerm, editor])

  useEffect(() => {
    editor.commands.setCaseSensitive(caseSensitive)
    refreshSearch(editor)
  }, [caseSensitive, editor])

  useEffect(() => {
    return () => {
      editor.commands.setSearchTerm('')
      editor.commands.setReplaceTerm('')
    }
  }, [editor])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const storage = editor.storage.searchAndReplace as SearchAndReplaceStorage
  const resultCount = storage.results.length
  const currentIndex = storage.resultIndex

  const handleNext = useCallback((): void => {
    if (resultCount === 0) return
    editor.commands.nextSearchResult()
    refreshSearch(editor)
    scrollToActiveMatch(editor)
    searchInputRef.current?.focus()
  }, [editor, resultCount])

  const handlePrev = useCallback((): void => {
    if (resultCount === 0) return
    editor.commands.previousSearchResult()
    refreshSearch(editor)
    scrollToActiveMatch(editor)
    searchInputRef.current?.focus()
  }, [editor, resultCount])

  const handleReplaceCurrent = useCallback((): void => {
    if (resultCount === 0) return
    editor.commands.replace()
    refreshSearch(editor)
    scrollToActiveMatch(editor)
    replaceInputRef.current?.focus()
  }, [editor, resultCount])

  const handleReplaceAll = useCallback((): void => {
    if (resultCount === 0) return
    editor.commands.replaceAll()
    refreshSearch(editor)
    replaceInputRef.current?.focus()
  }, [editor, resultCount])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (resultCount === 0) return
      if (e.shiftKey) handlePrev()
      else handleNext()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (resultCount === 0) return
      handleReplaceCurrent()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  const matchLabel =
    searchTerm.length === 0
      ? ''
      : resultCount === 0
        ? 'No results'
        : `${currentIndex + 1} of ${resultCount}`

  return (
    <TooltipProvider delayDuration={300}>
      <div className="no-drag flex flex-col gap-2 border-b border-border bg-background px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Find…"
              className="h-7 pr-20 text-sm"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {matchLabel}
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7 shrink-0', caseSensitive && 'bg-accent text-accent-foreground')}
                onClick={() => setCaseSensitive((v) => !v)}
              >
                <CaseSensitive className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Case sensitive</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handlePrev}
                disabled={resultCount === 0}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous (⇧Enter)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleNext}
                disabled={resultCount === 0}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next (Enter)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7 shrink-0', showReplace && 'bg-accent text-accent-foreground')}
                onClick={() => setShowReplace((v) => !v)}
              >
                <Replace className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle replace</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close (Esc)</TooltipContent>
          </Tooltip>
        </div>

        {showReplace && (
          <div className="flex items-center gap-2">
            <Input
              ref={replaceInputRef}
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              placeholder="Replace with…"
              className="h-7 flex-1 text-sm"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleReplaceCurrent}
                  disabled={resultCount === 0}
                >
                  <Replace className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Replace current (Enter)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleReplaceAll}
                  disabled={resultCount === 0}
                >
                  <ReplaceAll className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Replace all</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
