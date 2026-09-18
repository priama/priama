import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WORD_RE,
  check,
  isCyrillicWord,
  latinPair,
  onSpellCheckSettingsChange,
  spellCheckLangFromLtCode
} from './spellCheck'
import { useAppStore } from '@/store/appStore'

describe('WORD_RE', () => {
  it('matches Latin and Cyrillic words separately', () => {
    const text = "Hello мир — don't café"
    const words = [...text.matchAll(WORD_RE)].map((m) => m[0])
    expect(words).toEqual(['Hello', 'мир', "don't", 'café'])
  })
})

describe('isCyrillicWord', () => {
  it('detects Cyrillic', () => {
    expect(isCyrillicWord('Привет')).toBe(true)
    expect(isCyrillicWord('ёлка')).toBe(true)
  })

  it('rejects Latin', () => {
    expect(isCyrillicWord('Hello')).toBe(false)
    expect(isCyrillicWord('café')).toBe(false)
  })
})

describe('latinPair', () => {
  it('uses EN primary for English and Russian project langs', () => {
    expect(latinPair('en')).toEqual({ primary: 'en', secondary: 'es' })
    expect(latinPair('ru')).toEqual({ primary: 'en', secondary: 'es' })
  })

  it('uses ES primary for Spanish', () => {
    expect(latinPair('es')).toEqual({ primary: 'es', secondary: 'en' })
  })
})

describe('spellCheckLangFromLtCode', () => {
  it('maps LanguageTool codes', () => {
    expect(spellCheckLangFromLtCode('ru-RU')).toBe('ru')
    expect(spellCheckLangFromLtCode('es')).toBe('es')
    expect(spellCheckLangFromLtCode('en-US')).toBe('en')
    expect(spellCheckLangFromLtCode('de-DE')).toBe('en')
  })
})

describe('check engine', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('navigator', { onLine: true })
    useAppStore.setState({ spellCheckOnline: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.setState({ spellCheckOnline: false })
  })

  it('checks on this machine by default, even with a network connection', async () => {
    const matches = await check('Teh cat sat')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(matches.map((m) => m.word)).toEqual(['Teh'])
  })

  it('uses LanguageTool only after the writer opts in', async () => {
    useAppStore.setState({ spellCheckOnline: true })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        language: { code: 'en-US' },
        matches: [
          {
            message: 'Possible typo',
            offset: 0,
            length: 3,
            replacements: [{ value: 'The' }],
            rule: { category: { id: 'TYPOS' } }
          }
        ]
      })
    })

    const matches = await check('Teh cat sat')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('languagetool.org')
    expect(matches).toEqual([
      { from: 0, to: 3, word: 'Teh', suggestions: ['The'], message: 'Possible typo' }
    ])
  })

  it('falls back to the offline dictionary when LanguageTool fails', async () => {
    useAppStore.setState({ spellCheckOnline: true })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const matches = await check('Teh cat sat')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(matches.map((m) => m.word)).toEqual(['Teh'])
  })

  it('asks open text to re-check when the online preference flips', () => {
    const listener = vi.fn()
    const unsubscribe = onSpellCheckSettingsChange(listener)

    useAppStore.getState().setSpellCheckOnline(true, { persist: false })
    useAppStore.getState().setSpellCheckOnline(true, { persist: false })
    unsubscribe()

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
