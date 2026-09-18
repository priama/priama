import { useCallback, useEffect, useRef, useState } from 'react'
import { addCustomWord, check, onSpellCheckSettingsChange, type SpellMatch } from '@/lib/spellCheck'

const DEBOUNCE_MS = 400
const BLUR_MENU_DELAY_MS = 150

export interface SpellCheckMenuState {
  x: number
  y: number
  match: SpellMatch
}

interface LineCache {
  hash: string
  matches: SpellMatch[]
}

function splitLines(text: string): string[] {
  return text.split('\n')
}

function offsetMatches(matches: SpellMatch[], offset: number): SpellMatch[] {
  return matches.map((m) => ({
    ...m,
    from: m.from + offset,
    to: m.to + offset
  }))
}

export function useSpellCheckField(
  value: string,
  options?: { enabled?: boolean; debounceMs?: number }
): {
  matches: SpellMatch[]
  menu: SpellCheckMenuState | null
  closeMenu: () => void
  onFocus: () => void
  onBlur: () => void
  markDirty: () => void
  handleContextMenu: (
    e: React.MouseEvent,
    input: HTMLInputElement | HTMLTextAreaElement
  ) => void
  applySuggestion: (replacement: string) => string | null
  addToDictionary: () => void
} {
  const enabled = options?.enabled !== false
  const debounceMs = options?.debounceMs ?? DEBOUNCE_MS

  const [matches, setMatches] = useState<SpellMatch[]>([])
  const [menu, setMenu] = useState<SpellCheckMenuState | null>(null)
  const [focused, setFocused] = useState(false)
  const [dirty, setDirty] = useState(false)

  const generationRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeMenuRef = useRef<SpellCheckMenuState | null>(null)
  const lineCacheRef = useRef<Map<number, LineCache>>(new Map())

  const runCheck = useCallback(
    async (text: string, gen: number) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const lines = splitLines(text)
      const cache = lineCacheRef.current
      const newCache = new Map<number, LineCache>()
      const allMatches: SpellMatch[] = []

      let offset = 0
      for (let i = 0; i < lines.length; i++) {
        if (controller.signal.aborted || gen !== generationRef.current) return

        const line = lines[i]
        const hash = line
        const cached = cache.get(i)

        if (cached && cached.hash === hash) {
          newCache.set(i, cached)
          allMatches.push(...offsetMatches(cached.matches, offset))
        } else {
          const lineMatches = await check(line, { signal: controller.signal })
          if (controller.signal.aborted || gen !== generationRef.current) return

          newCache.set(i, { hash, matches: lineMatches })
          allMatches.push(...offsetMatches(lineMatches, offset))
        }

        offset += line.length + 1
      }

      lineCacheRef.current = newCache
      setMatches(allMatches)
    },
    []
  )

  const scheduleCheck = useCallback(
    (text: string) => {
      if (!enabled) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      generationRef.current++
      const gen = generationRef.current

      debounceRef.current = setTimeout(() => {
        requestIdleCallback(() => {
          void runCheck(text, gen)
        }, { timeout: 500 })
      }, debounceMs)
    },
    [enabled, debounceMs, runCheck]
  )

  const closeMenu = useCallback(() => {
    if (blurMenuTimerRef.current) {
      clearTimeout(blurMenuTimerRef.current)
      blurMenuTimerRef.current = null
    }
    activeMenuRef.current = null
    setMenu(null)
  }, [])

  useEffect(() => {
    return onSpellCheckSettingsChange(() => {
      lineCacheRef.current = new Map()
      setDirty(true)
    })
  }, [])

  useEffect(() => {
    if (!enabled) {
      setMatches([])
      lineCacheRef.current = new Map()
      return
    }
    if (!focused && !dirty) return
    scheduleCheck(value)
  }, [value, focused, dirty, enabled, scheduleCheck])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (blurMenuTimerRef.current) clearTimeout(blurMenuTimerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const onFocus = useCallback(() => {
    if (blurMenuTimerRef.current) {
      clearTimeout(blurMenuTimerRef.current)
      blurMenuTimerRef.current = null
    }
    setFocused(true)
  }, [])

  const onBlur = useCallback(() => {
    setFocused(false)
    if (blurMenuTimerRef.current) clearTimeout(blurMenuTimerRef.current)
    blurMenuTimerRef.current = setTimeout(() => {
      closeMenu()
      blurMenuTimerRef.current = null
    }, BLUR_MENU_DELAY_MS)
  }, [closeMenu])

  const markDirty = useCallback(() => {
    setDirty(true)
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, input: HTMLInputElement | HTMLTextAreaElement) => {
      if (!enabled) return

      const offset = input.selectionStart ?? 0
      const match = matches.find((m) => offset >= m.from && offset < m.to)
      if (!match) return

      e.preventDefault()
      const nextMenu = { x: e.clientX, y: e.clientY, match }
      activeMenuRef.current = nextMenu
      setMenu(nextMenu)
    },
    [enabled, matches]
  )

  const applySuggestion = useCallback(
    (replacement: string): string | null => {
      const active = activeMenuRef.current
      if (!active) return null
      const { from, to } = active.match
      const next = value.slice(0, from) + replacement + value.slice(to)
      closeMenu()
      lineCacheRef.current = new Map()
      setDirty(true)
      return next
    },
    [value, closeMenu]
  )

  const addToDictionary = useCallback(() => {
    const active = activeMenuRef.current
    if (!active) return
    addCustomWord(active.match.word)
    closeMenu()
    lineCacheRef.current = new Map()
    setDirty(true)
    if (enabled && (focused || dirty)) {
      scheduleCheck(value)
    }
  }, [enabled, focused, dirty, value, scheduleCheck, closeMenu])

  return {
    matches,
    menu,
    closeMenu,
    onFocus,
    onBlur,
    markDirty,
    handleContextMenu,
    applySuggestion,
    addToDictionary
  }
}
