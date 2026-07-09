import nspell from 'nspell'
import affEn from '../../../node_modules/dictionary-en/index.aff?raw'
import dicEn from '../../../node_modules/dictionary-en/index.dic?raw'
import affEs from '../../../node_modules/dictionary-es/index.aff?raw'
import dicEs from '../../../node_modules/dictionary-es/index.dic?raw'
import { useAppStore } from '@/store/appStore'
import type { SpellCheckLang } from '@shared/types'

export interface SpellMatch {
  from: number
  to: number
  word: string
  suggestions: string[]
  message?: string
}

export interface CheckOptions {
  signal?: AbortSignal
  excludeRanges?: Array<{ from: number; to: number }>
}

function overlapsExcludeRange(
  from: number,
  to: number,
  excludeRanges?: Array<{ from: number; to: number }>
): boolean {
  if (!excludeRanges?.length) return false
  return excludeRanges.some((r) => from < r.to && to > r.from)
}

function filterExcludedMatches(
  matches: SpellMatch[],
  excludeRanges?: Array<{ from: number; to: number }>
): SpellMatch[] {
  if (!excludeRanges?.length) return matches
  return matches.filter((m) => !overlapsExcludeRange(m.from, m.to, excludeRanges))
}

const STORAGE_KEY = 'priama:spell:custom'
const LT_URL = 'https://api.languagetool.org/v2/check'
const LT_TIMEOUT_MS = 2000
const LT_MAX_CHARS = 20_000
const OFFLINE_YIELD_EVERY = 200

const DICTS = {
  en: { aff: affEn, dic: dicEn },
  es: { aff: affEs, dic: dicEs }
} as const

function loadCustomWords(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveCustomWords(words: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...words]))
}

let customWords = loadCustomWords()

export function addCustomWord(word: string): void {
  customWords.add(word.toLowerCase())
  saveCustomWords(customWords)
}

export function removeCustomWord(word: string): void {
  customWords.delete(word.toLowerCase())
  saveCustomWords(customWords)
}

export function isCustomWord(word: string): boolean {
  return customWords.has(word.toLowerCase())
}

export function getCustomWords(): string[] {
  return [...customWords].sort()
}

type NSpellInstance = ReturnType<typeof nspell>

let spellEn: NSpellInstance | null = null
let spellEs: NSpellInstance | null = null
let dictsReady = false
let initPromise: Promise<void> | null = null

let projectLang: SpellCheckLang = 'en'
const langListeners = new Set<() => void>()

export function getSpellCheckLang(): SpellCheckLang {
  return projectLang
}

export function setSpellCheckLang(lang: SpellCheckLang | undefined): void {
  const next = lang ?? 'en'
  if (next === projectLang) return

  projectLang = next
  dictsReady = false
  initPromise = null

  requestIdleCallback(() => {
    try {
      initDict(projectLang)
      dictsReady = true
      initSecondaryDict(projectLang)
    } catch {
      // Ignore — offline check falls back to available dict
    }
  })

  for (const listener of langListeners) listener()
}

export function onSpellCheckLangChange(cb: () => void): () => void {
  langListeners.add(cb)
  return () => langListeners.delete(cb)
}

function initDict(lang: 'en' | 'es'): void {
  if (lang === 'en' && !spellEn) spellEn = nspell(DICTS.en)
  if (lang === 'es' && !spellEs) spellEs = nspell(DICTS.es)
}

function initSecondaryDict(primary: 'en' | 'es'): void {
  try {
    initDict(primary === 'en' ? 'es' : 'en')
  } catch {
    // Secondary dictionary is optional
  }
}

function ensureDictsReady(): Promise<void> {
  if (dictsReady) return Promise.resolve()
  if (!initPromise) {
    initPromise = new Promise((resolve) => {
      queueMicrotask(() => {
        try {
          initDict(projectLang)
          dictsReady = true
          requestIdleCallback(() => initSecondaryDict(projectLang))
          resolve()
        } catch {
          initPromise = null
          resolve()
        }
      })
    })
  }
  return initPromise
}

function rememberLang(code: string): void {
  const lang: SpellCheckLang = code.startsWith('es') ? 'es' : 'en'
  if (lang === projectLang) return

  setSpellCheckLang(lang)

  const { isProjectOpen, projectMeta, setProjectMeta } = useAppStore.getState()
  if (!isProjectOpen || !projectMeta) return

  void window.electronAPI.tomes.updateProjectMeta({ spellCheckLang: lang }).then((meta) => {
    setProjectMeta(meta)
  })
}

interface LTResponse {
  language: { code: string }
  matches: Array<{
    message: string
    offset: number
    length: number
    replacements: Array<{ value: string }>
    rule: { category: { id: string } }
  }>
}

async function checkOnline(
  text: string,
  signal?: AbortSignal,
  excludeRanges?: Array<{ from: number; to: number }>
): Promise<SpellMatch[] | null> {
  if (text.length > LT_MAX_CHARS) return null

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LT_TIMEOUT_MS)

  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const body = new URLSearchParams({ text, language: 'auto' })
    const res = await fetch(LT_URL, { method: 'POST', body, signal: controller.signal })
    if (!res.ok) return null

    const data = (await res.json()) as LTResponse
    rememberLang(data.language.code)

    return filterExcludedMatches(
      data.matches
        .filter((m) => {
          const word = text.slice(m.offset, m.offset + m.length)
          return !isCustomWord(word)
        })
        .map((m) => ({
          from: m.offset,
          to: m.offset + m.length,
          word: text.slice(m.offset, m.offset + m.length),
          suggestions: m.replacements.slice(0, 6).map((r) => r.value),
          message: m.message
        })),
      excludeRanges
    )
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onAbort)
  }
}

const WORD_RE = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ']+/g

async function checkOffline(
  text: string,
  signal?: AbortSignal,
  excludeRanges?: Array<{ from: number; to: number }>
): Promise<SpellMatch[]> {
  await ensureDictsReady()
  if (!dictsReady) return []

  if (!spellEn) initDict('en')
  if (!spellEs) initDict('es')

  const primary = projectLang === 'es' ? spellEs : spellEn
  const secondary = projectLang === 'es' ? spellEn : spellEs
  if (!primary) return []

  const matches: SpellMatch[] = []
  let wordCount = 0
  let m: RegExpExecArray | null
  WORD_RE.lastIndex = 0

  while ((m = WORD_RE.exec(text)) !== null) {
    if (signal?.aborted) return matches

    wordCount++
    if (wordCount % OFFLINE_YIELD_EVERY === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (signal?.aborted) return matches
    }

    const word = m[0]
    const from = m.index
    const to = m.index + word.length
    if (overlapsExcludeRange(from, to, excludeRanges)) continue
    if (word.length < 2) continue
    if (isCustomWord(word)) continue
    if (primary.correct(word)) continue
    if (secondary?.correct(word)) continue

    matches.push({
      from,
      to,
      word,
      suggestions: [
        ...primary.suggest(word).slice(0, 4),
        ...(secondary?.suggest(word).slice(0, 2) ?? [])
      ].filter((s, i, arr) => arr.indexOf(s) === i).slice(0, 6)
    })
  }
  return matches
}

export async function check(text: string, options?: CheckOptions): Promise<SpellMatch[]> {
  if (!text.trim()) return []
  if (options?.signal?.aborted) return []

  const excludeRanges = options?.excludeRanges

  if (navigator.onLine && text.length <= LT_MAX_CHARS) {
    const online = await checkOnline(text, options?.signal, excludeRanges)
    if (options?.signal?.aborted) return []
    if (online !== null) return online
  }

  return checkOffline(text, options?.signal, excludeRanges)
}
