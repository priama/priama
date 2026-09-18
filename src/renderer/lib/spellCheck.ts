import nspell from 'nspell'
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

/** Latin (EN/ES) words and Cyrillic (RU) words. */
export const WORD_RE = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ']+|[\u0400-\u04FF]+/g

export function isCyrillicWord(word: string): boolean {
  return /[\u0400-\u04FF]/.test(word)
}

/** Latin primary/secondary pair. Russian project lang still uses EN as Latin primary. */
export function latinPair(projectLang: SpellCheckLang): {
  primary: 'en' | 'es'
  secondary: 'en' | 'es'
} {
  const primary = projectLang === 'es' ? 'es' : 'en'
  return { primary, secondary: primary === 'en' ? 'es' : 'en' }
}

export function spellCheckLangFromLtCode(code: string): SpellCheckLang {
  const lower = code.toLowerCase()
  if (lower.startsWith('ru')) return 'ru'
  if (lower.startsWith('es')) return 'es'
  return 'en'
}

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

type NSpellInstance = ReturnType<typeof nspell>

const instances: Partial<Record<SpellCheckLang, NSpellInstance>> = {}
const loading: Partial<Record<SpellCheckLang, Promise<NSpellInstance | null>>> = {}

let projectLang: SpellCheckLang = 'en'
const settingsListeners = new Set<() => void>()

function notifySettingsChange(): void {
  for (const listener of settingsListeners) listener()
}

// Flipping the online preference swaps engines; open text should be checked again.
useAppStore.subscribe((state, prev) => {
  if (state.spellCheckOnline !== prev.spellCheckOnline) notifySettingsChange()
})

type RawModule = { default: string }

// One chunk per language (EN ~0.55 MB, ES ~0.9 MB, RU ~3.5 MB), loaded the first time text
// in that language needs checking instead of being parsed with the app at every launch.
const DICTIONARY_LOADERS: Record<SpellCheckLang, () => Promise<[RawModule, RawModule]>> = {
  en: () =>
    Promise.all([
      import('../../../node_modules/dictionary-en/index.aff?raw'),
      import('../../../node_modules/dictionary-en/index.dic?raw')
    ]),
  es: () =>
    Promise.all([
      import('../../../node_modules/dictionary-es/index.aff?raw'),
      import('../../../node_modules/dictionary-es/index.dic?raw')
    ]),
  ru: () =>
    Promise.all([
      import('../../../node_modules/dictionary-ru/index.aff?raw'),
      import('../../../node_modules/dictionary-ru/index.dic?raw')
    ])
}

async function loadDictData(lang: SpellCheckLang): Promise<{ aff: string; dic: string }> {
  const [aff, dic] = await DICTIONARY_LOADERS[lang]()
  return { aff: aff.default, dic: dic.default }
}

async function getSpell(lang: SpellCheckLang): Promise<NSpellInstance | null> {
  const existing = instances[lang]
  if (existing) return existing

  const inFlight = loading[lang]
  if (inFlight) return inFlight

  const promise = (async (): Promise<NSpellInstance | null> => {
    try {
      const data = await loadDictData(lang)
      const spell = nspell(data)
      instances[lang] = spell
      return spell
    } catch {
      return null
    } finally {
      delete loading[lang]
    }
  })()

  loading[lang] = promise
  return promise
}

function warmDict(lang: SpellCheckLang): void {
  requestIdleCallback(() => {
    void getSpell(lang)
  })
}

export function setSpellCheckLang(lang: SpellCheckLang | undefined): void {
  const next = lang ?? 'en'
  const changed = next !== projectLang
  projectLang = next

  if (next === 'ru') {
    warmDict('ru')
  } else {
    const { primary, secondary } = latinPair(next)
    warmDict(primary)
    requestIdleCallback(() => {
      void getSpell(secondary)
    })
  }

  if (!changed) return
  notifySettingsChange()
}

/** Fires when the language or the checking engine changes, so open text should be re-checked. */
export function onSpellCheckSettingsChange(cb: () => void): () => void {
  settingsListeners.add(cb)
  return () => settingsListeners.delete(cb)
}

function rememberLang(code: string): void {
  const lang = spellCheckLangFromLtCode(code)
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

async function checkOffline(
  text: string,
  signal?: AbortSignal,
  excludeRanges?: Array<{ from: number; to: number }>
): Promise<SpellMatch[]> {
  const needsCyrillic = /[\u0400-\u04FF]/.test(text)
  const needsLatin = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(text)

  const spellRu = needsCyrillic ? await getSpell('ru') : null
  if (signal?.aborted) return []

  let spellLatinPrimary: NSpellInstance | null = null
  let spellLatinSecondary: NSpellInstance | null = null
  if (needsLatin) {
    const { primary, secondary } = latinPair(projectLang)
    spellLatinPrimary = await getSpell(primary)
    if (signal?.aborted) return []
    spellLatinSecondary = await getSpell(secondary)
    if (signal?.aborted) return []
  }

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

    if (isCyrillicWord(word)) {
      if (!spellRu || spellRu.correct(word)) continue
      matches.push({
        from,
        to,
        word,
        suggestions: spellRu.suggest(word).slice(0, 6)
      })
      continue
    }

    if (!spellLatinPrimary) continue
    if (spellLatinPrimary.correct(word)) continue
    if (spellLatinSecondary?.correct(word)) continue

    matches.push({
      from,
      to,
      word,
      suggestions: [
        ...spellLatinPrimary.suggest(word).slice(0, 4),
        ...(spellLatinSecondary?.suggest(word).slice(0, 2) ?? [])
      ]
        .filter((s, i, arr) => arr.indexOf(s) === i)
        .slice(0, 6)
    })
  }

  return matches
}

export async function check(text: string, options?: CheckOptions): Promise<SpellMatch[]> {
  if (!text.trim()) return []
  if (options?.signal?.aborted) return []

  const excludeRanges = options?.excludeRanges

  // Offline (nspell) is the default. LanguageTool sends the text to a server, so it only
  // runs when the writer opted in, and falls back to offline on any failure.
  const onlineAllowed = useAppStore.getState().spellCheckOnline
  if (onlineAllowed && navigator.onLine && text.length <= LT_MAX_CHARS) {
    const online = await checkOnline(text, options?.signal, excludeRanges)
    if (options?.signal?.aborted) return []
    if (online !== null) return online
  }

  return checkOffline(text, options?.signal, excludeRanges)
}
