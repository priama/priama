import { describe, expect, it } from 'vitest'
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { parseDocxBuffer } from './parseDocx'
import { splitManuscriptAuto } from '@shared/import/splitManuscript'

async function docxBuffer(children: Paragraph[], title?: string, creator?: string): Promise<Buffer> {
  const doc = new Document({
    title,
    creator,
    sections: [{ children }]
  })
  return Buffer.from(await Packer.toBuffer(doc))
}

describe('parseDocxBuffer', () => {
  it('converts Heading 1 chapters and suggested title from core properties', async () => {
    const buffer = await docxBuffer(
      [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Chapter 1')] }),
        new Paragraph({ children: [new TextRun('Once upon a time.')] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Chapter 2')] }),
        new Paragraph({ children: [new TextRun('The next day.')] })
      ],
      'The Wind',
      'Ada'
    )

    const parsed = await parseDocxBuffer(buffer, 'ignored-name.docx')
    expect(parsed.suggestedTitle).toBe('The Wind')
    expect(parsed.suggestedAuthor).toBe('Ada')
    expect(parsed.html).toContain('<h1>Chapter 1</h1>')
    expect(parsed.html).toContain('Once upon a time')

    const split = splitManuscriptAuto(parsed.html)
    expect(split.mode).toBe('heading1')
    expect(split.chapters.map((c) => c.title)).toEqual(['Chapter 1', 'Chapter 2'])
    expect(split.chapters[0].html).toContain('Once upon a time')
    expect(split.chapters[0].html).not.toContain('<h1>')
  })

  it('does not treat an in-body Heading 2 as a chapter', async () => {
    const buffer = await docxBuffer([
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('One')] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('A scene')] }),
      new Paragraph({ children: [new TextRun('Body copy.')] })
    ])

    const parsed = await parseDocxBuffer(buffer, 'draft.docx')
    const split = splitManuscriptAuto(parsed.html)
    expect(split.chapters).toHaveLength(1)
    expect(split.chapters[0].title).toBe('One')
    expect(split.chapters[0].html).toContain('A scene')
  })

  it('uses the filename when Word has no title property', async () => {
    const buffer = await docxBuffer([
      new Paragraph({ children: [new TextRun('Hello world.')] })
    ])
    const parsed = await parseDocxBuffer(buffer, 'My_Draft.docx')
    expect(parsed.suggestedTitle).toBe('My Draft')
    expect(parsed.html).toContain('Hello world')
  })

  it('does not treat Word Title style as a chapter heading', async () => {
    const buffer = await docxBuffer([
      new Paragraph({ style: 'Title', children: [new TextRun('The Wind')] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Chapter 1')] }),
      new Paragraph({ children: [new TextRun('Once upon a time.')] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Chapter 2')] }),
      new Paragraph({ children: [new TextRun('The next day.')] })
    ])

    const parsed = await parseDocxBuffer(buffer, 'the-wind.docx')
    expect(parsed.html).not.toMatch(/<h1>The Wind<\/h1>/)
    const split = splitManuscriptAuto(parsed.html)
    expect(split.chapters.map((c) => c.title)).toEqual(['Front matter', 'Chapter 1', 'Chapter 2'])
  })
})
