import { describe, expect, it } from 'vitest'
import {
  WORD_RE,
  isCyrillicWord,
  latinPair,
  spellCheckLangFromLtCode
} from './spellCheck'

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
