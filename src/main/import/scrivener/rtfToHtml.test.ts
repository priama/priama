import { describe, expect, it } from 'vitest'
import { rtfToHtml } from './rtfToHtml'
import { parseRtf, RtfParseError } from './rtfParse'

/** RTF shaped like Scrivener's Files/Data output: header tables + \pard\plain runs. */
function scrivenerRtf(body: string): string {
  return [
    '{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0',
    '{\\fonttbl{\\f0\\froman Georgia;}}',
    '{\\colortbl;\\red0\\green0\\blue0;\\red227\\green28\\blue35;}',
    body,
    '}'
  ].join('\n')
}

describe('rtfToHtml', () => {
  it('renders paragraphs with inline marks', () => {
    const { html } = rtfToHtml(
      scrivenerRtf(
        '{\\pard\\plain \\f0\\fs24 The letter arrived \\b at dawn\\b0 , stamped \\i red\\i0 .\\par}'
      )
    )
    expect(html).toBe('<p>The letter arrived <strong>at dawn</strong>, stamped <em>red</em>.</p>')
  })

  it('handles underline, strike, super and sub', () => {
    const { html } = rtfToHtml(
      scrivenerRtf(
        '{\\pard\\plain \\ul under\\ulnone  \\strike struck\\strike0  H\\super 2\\super0  and x\\sub 1\\sub0 .\\par}'
      )
    )
    expect(html).toBe(
      '<p><u>under</u> <s>struck</s> H<sup>2</sup> and x<sub>1</sub>.</p>'
    )
  })

  it('keeps interior empty paragraphs and trims trailing ones', () => {
    const { html } = rtfToHtml(
      scrivenerRtf('{\\pard\\plain One\\par}{\\pard\\plain \\par}{\\pard\\plain Two\\par}{\\pard\\plain \\par}')
    )
    expect(html).toBe('<p>One</p><p></p><p>Two</p>')
  })

  it('decodes \\\'xx bytes through the declared codepage', () => {
    const { html } = rtfToHtml(scrivenerRtf("{\\pard\\plain caf\\'e9 na\\'efve \\'97 done\\par}"))
    expect(html).toBe('<p>café naïve — done</p>')
  })

  it('decodes cp1251 Cyrillic bytes when declared', () => {
    const rtf = scrivenerRtf('{\\pard\\plain \\par}').replace('\\ansicpg1252', '\\ansicpg1251')
    // П (0xCF) р (0xF0) и (0xE8) в (0xE2) е (0xE5) т (0xF2)
    const { html } = rtfToHtml(
      rtf.replace('{\\pard\\plain \\par}', "{\\pard\\plain \\'cf\\'f0\\'e8\\'e2\\'e5\\'f2\\par}")
    )
    expect(html).toBe('<p>Привет</p>')
  })

  it('decodes \\uN escapes and swallows the fallback chars per \\uc', () => {
    // \uc1\u233? → é, skipping the '?' fallback.
    const { html } = rtfToHtml(scrivenerRtf('{\\pard\\plain caf\\uc1\\u233?\\par}'))
    expect(html).toBe('<p>café</p>')
  })

  it('collects footnotes to an end-of-document notes list', () => {
    const { html, footnoteCount } = rtfToHtml(
      scrivenerRtf(
        '{\\pard\\plain He knew{\\super\\chftn}{\\footnote {\\pard\\plain {\\super\\chftn} it was over.}} then.\\par}' +
          '{\\pard\\plain Second para{\\super\\chftn}{\\footnote {\\pard\\plain {\\super\\chftn} another note.}}\\par}'
      )
    )
    expect(footnoteCount).toBe(2)
    expect(html).toBe(
      '<p>He knew<sup>1</sup> then.</p><p>Second para<sup>2</sup></p>' +
        '<hr><p><strong>Notes</strong></p><ol><li>it was over.</li><li>another note.</li></ol>'
    )
  })

  it('drops annotation runs that precede atnid markers', () => {
    const { html } = rtfToHtml(
      scrivenerRtf(
        '{\\pard\\plain Keep this {\\cf2\\ul fix this pacing}{\\*\\atnid Author}{\\*\\atndate 2026-11-13 10:00:00 +0000}{\\*\\atnref ABC-123} and this.\\par}'
      )
    )
    expect(html).toBe('<p>Keep this  and this.</p>')
  })

  it('keeps plain text before an atnid marker when it is not annotation-styled', () => {
    const { html } = rtfToHtml(
      scrivenerRtf(
        '{\\pard\\plain {\\f0\\fs24 manuscript words}{\\*\\atnid Author}{\\*\\atnref ABC} after.\\par}'
      )
    )
    expect(html).toBe('<p>manuscript words after.</p>')
  })

  it('skips images, headers and unknown \\* destinations', () => {
    const { html } = rtfToHtml(
      scrivenerRtf(
        '{\\pard\\plain A{\\pict\\pngblip\\picw100 89504e47}B{\\*\\somethingweird junk}C\\par}'
      )
    )
    expect(html).toBe('<p>ABC</p>')
  })

  it('maps control symbols to their characters', () => {
    const { html } = rtfToHtml(
      scrivenerRtf('{\\pard\\plain \\lquote quoted\\rquote  \\emdash  pause \\bullet  item\\par}')
    )
    expect(html).toBe('<p>\u2018quoted\u2019 \u2014 pause \u2022 item</p>')
  })

  it('escapes HTML-significant characters in text', () => {
    const { html } = rtfToHtml(scrivenerRtf('{\\pard\\plain 5 < 6 & 7 > 3\\par}'))
    expect(html).toBe('<p>5 &lt; 6 &amp; 7 &gt; 3</p>')
  })

  it('scopes formatting to its group', () => {
    const { html } = rtfToHtml(
      scrivenerRtf('{\\pard\\plain normal {\\b bold} normal\\par}')
    )
    expect(html).toBe('<p>normal <strong>bold</strong> normal</p>')
  })

  it('resets character formatting on \\plain', () => {
    const { html } = rtfToHtml(
      scrivenerRtf('{\\pard\\plain \\b\\i styled\\plain  reset\\par}')
    )
    expect(html).toBe('<p><strong><em>styled</em></strong> reset</p>')
  })

  it('turns \\line into <br>', () => {
    const { html } = rtfToHtml(scrivenerRtf('{\\pard\\plain one\\line two\\par}'))
    expect(html).toBe('<p>one<br>two</p>')
  })
})

describe('parseRtf', () => {
  it('rejects unbalanced groups', () => {
    expect(() => parseRtf('{\\rtf1\\ansi oops')).toThrow(RtfParseError)
    expect(() => parseRtf('{\\rtf1\\ansi ok}}')).toThrow(RtfParseError)
  })

  it('parses escaped braces as text', () => {
    const root = parseRtf('{\\rtf1 a \\{ b \\} c}')
    const texts = JSON.stringify(root)
    expect(texts).toContain('a ')
    expect(texts).toContain('{')
    expect(texts).toContain('}')
  })
})
