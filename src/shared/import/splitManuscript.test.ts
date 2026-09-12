import { describe, expect, it } from 'vitest'
import { sanitizeImportedHtml } from './sanitizeImportedHtml'
import { detectSplitMode, splitManuscript, splitManuscriptAuto } from './splitManuscript'

describe('sanitizeImportedHtml', () => {
  it('keeps headings, paragraphs, and basic marks', () => {
    const html = sanitizeImportedHtml(
      '<h1>Ch 1</h1><p>Hello <strong>there</strong> <em>world</em></p>'
    )
    expect(html).toContain('<h1>Ch 1</h1>')
    expect(html).toContain('<strong>there</strong>')
    expect(html).toContain('<em>world</em>')
  })

  it('drops images, scripts, and unwraps links', () => {
    const html = sanitizeImportedHtml(
      '<p>See <a href="https://example.com">this</a></p><img src="x.png" alt="cover"><script>alert(1)</script>'
    )
    expect(html).toBe('<p>See this</p>')
    expect(html).not.toContain('img')
    expect(html).not.toContain('script')
    expect(html).not.toContain('href')
  })

  it('rewrites h5 to h4 and b/i to strong/em', () => {
    const html = sanitizeImportedHtml('<h5>Small</h5><p><b>Bold</b> <i>Ital</i></p>')
    expect(html).toContain('<h4>Small</h4>')
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain('<em>Ital</em>')
  })

  it('turns table cells into paragraphs', () => {
    const html = sanitizeImportedHtml('<table><tr><td>Alpha</td><td>Beta</td></tr></table>')
    expect(html).toContain('<p>Alpha</p>')
    expect(html).toContain('<p>Beta</p>')
    expect(html).not.toContain('<table')
  })
})

describe('splitManuscript', () => {
  it('splits on Heading 1 and uses the heading as the chapter title', () => {
    const html =
      '<h1>Chapter 1</h1><p>Once upon a time.</p><h1>Chapter 2</h1><p>The next day.</p>'
    const result = splitManuscript(html, 'heading1')
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0].title).toBe('Chapter 1')
    expect(result.chapters[0].html).toBe('<p>Once upon a time.</p>')
    expect(result.chapters[1].title).toBe('Chapter 2')
    expect(result.chapters[1].html).toBe('<p>The next day.</p>')
  })

  it('does not treat Heading 2 as a chapter', () => {
    const html = '<h1>One</h1><h2>Scene break</h2><p>Body</p>'
    const result = splitManuscript(html, 'heading1')
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].title).toBe('One')
    expect(result.chapters[0].html).toContain('<h2>Scene break</h2>')
  })

  it('keeps leading copy as Front matter', () => {
    const html = '<p>For my mother.</p><h1>Chapter 1</h1><p>Body</p>'
    const result = splitManuscript(html, 'heading1')
    expect(result.chapters[0].title).toBe('Front matter')
    expect(result.chapters[0].html).toBe('<p>For my mother.</p>')
    expect(result.chapters[1].title).toBe('Chapter 1')
  })

  it('strips a repeated title paragraph after the heading', () => {
    const html = '<h1>The Crossing</h1><p>The Crossing</p><p>Snow fell.</p>'
    const result = splitManuscript(html, 'heading1')
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].html).toBe('<p>Snow fell.</p>')
  })

  it('splits on Chapter N paragraphs when styles are missing', () => {
    const html =
      '<p>Chapter 1</p><p>It was night.</p><p>Chapter 2: Dawn</p><p>The sun rose.</p>'
    const result = splitManuscript(html, 'chapter-pattern')
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0].title).toBe('Chapter 1')
    expect(result.chapters[0].html).toBe('<p>It was night.</p>')
    expect(result.chapters[1].title).toBe('Chapter 2: Dawn')
  })

  it('imports as a single document when asked', () => {
    const html = '<h1>Only</h1><p>One body.</p>'
    const result = splitManuscript(html, 'single')
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].title).toBe('Only')
    expect(result.chapters[0].html).toBe('<p>One body.</p>')
  })

  it('detects heading 1 when there are two chapters', () => {
    expect(
      detectSplitMode('<h1>A</h1><p>aaa</p><h1>B</h1><p>bbb</p>')
    ).toBe('heading1')
  })

  it('falls back to chapter titles when Heading 1 is only the book title', () => {
    const html =
      '<h1>My Novel</h1><p>Chapter 1</p><p>Start</p><p>Chapter 2</p><p>Continue</p>'
    expect(detectSplitMode(html)).toBe('chapter-pattern')
    const result = splitManuscriptAuto(html)
    expect(result.mode).toBe('chapter-pattern')
    expect(result.chapters.map((c) => c.title)).toEqual(['Front matter', 'Chapter 1', 'Chapter 2'])
  })
})
