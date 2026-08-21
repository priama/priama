/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { htmlToSearchText } from '@/lib/htmlToSearchText'
import {
  cachedHtmlToSearchText,
  clearProjectSearchCache,
  projectSearchCacheSize
} from '@/lib/projectSearch'

afterEach(() => {
  clearProjectSearchCache()
})

describe('htmlToSearchText', () => {
  it('joins mark-split words without spaces', () => {
    expect(htmlToSearchText('<p>ob<span class="entity-mention">sidian</span></p>')).toBe(
      'obsidian'
    )
  })

  it('decodes HTML entities', () => {
    expect(htmlToSearchText('<p>Tom &amp; Jerry</p>')).toBe('Tom & Jerry')
  })

  it('separates adjacent paragraphs with a space', () => {
    expect(htmlToSearchText('<p>Hello</p><p>world</p>')).toBe('Hello world')
  })

  it('does not include tag or attribute names in extracted text', () => {
    const text = htmlToSearchText(
      '<p><span class="entity-mention" data-entity-name="obsidian">Hero</span></p>'
    )
    expect(text).toBe('Hero')
    expect(text.toLowerCase()).not.toContain('entity')
    expect(text.toLowerCase()).not.toContain('obsidian')
  })

  it('returns empty for empty html', () => {
    expect(htmlToSearchText('')).toBe('')
    expect(htmlToSearchText('<p></p>')).toBe('')
  })
})

describe('cachedHtmlToSearchText', () => {
  it('reuses extract when content string is unchanged', () => {
    const html = '<p>Hello <strong>world</strong></p>'
    const a = cachedHtmlToSearchText('n1', html)
    expect(projectSearchCacheSize()).toBe(1)
    const b = cachedHtmlToSearchText('n1', html)
    expect(a).toBe(b)
    expect(a).toBe('Hello world')
    expect(projectSearchCacheSize()).toBe(1)
  })

  it('recomputes when content changes', () => {
    cachedHtmlToSearchText('n1', '<p>one</p>')
    const next = cachedHtmlToSearchText('n1', '<p>two</p>')
    expect(next).toBe('two')
  })
})
