import {
  HeadingLevel,
  Paragraph,
  TextRun,
  UnderlineType,
  AlignmentType,
  type IParagraphOptions
} from 'docx'
import type { BookSettings, ExportFontFamily } from '@shared/types'
import { docxFontName } from './formatting'

type InlineStyle = {
  bold?: boolean
  italics?: boolean
  // docx expects an object here, not a boolean — same shape used for headings below.
  underline?: { type?: (typeof UnderlineType)[keyof typeof UnderlineType] }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''))
}

function paragraphStyleOptions(bookSettings: BookSettings): IParagraphOptions {
  const alignment =
    bookSettings.textAlign === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT
  if (bookSettings.paragraphStyle === 'first-line-indent') {
    return {
      alignment,
      indent: { firstLine: 360 }
    }
  }
  return {
    alignment,
    spacing: { after: 240 }
  }
}

function runsFromHtml(html: string, fontFamily: ExportFontFamily, fontSize: number, style: InlineStyle = {}): TextRun[] {
  const runs: TextRun[] = []
  const font = docxFontName(fontFamily)
  const base = { font, size: fontSize * 2, ...style }

  if (!html.includes('<')) {
    const text = decodeEntities(html)
    if (text) runs.push(new TextRun({ text, ...base }))
    return runs.length ? runs : [new TextRun({ text: '', ...base })]
  }

  const tokenRegex = /<(strong|b|em|i|u|br\s*\/?)>(.*?)<\/\1>|<br\s*\/?>/gis
  let lastIndex = 0
  let match: RegExpExecArray | null

  const pushPlain = (text: string, extra: InlineStyle): void => {
    const decoded = decodeEntities(text)
    if (decoded) runs.push(new TextRun({ text: decoded, ...base, ...extra }))
  }

  while ((match = tokenRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(html.slice(lastIndex, match.index), style)
    }
    const tag = match[1]?.toLowerCase()
    if (!tag || tag.startsWith('br')) {
      runs.push(new TextRun({ break: 1, ...base, ...style }))
    } else {
      const inner = match[2] ?? ''
      const next: InlineStyle = { ...style }
      if (tag === 'strong' || tag === 'b') next.bold = true
      if (tag === 'em' || tag === 'i') next.italics = true
      if (tag === 'u') next.underline = { type: UnderlineType.SINGLE }
      runs.push(...runsFromHtml(inner, fontFamily, fontSize, next))
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < html.length) {
    pushPlain(html.slice(lastIndex), style)
  }

  return runs.length ? runs : [new TextRun({ text: stripTags(html), ...base, ...style })]
}

function paragraphFromHtml(
  html: string,
  fontFamily: ExportFontFamily,
  fontSize: number,
  bookSettings: BookSettings,
  options?: IParagraphOptions
): Paragraph {
  const runs = runsFromHtml(html, fontFamily, fontSize)
  return new Paragraph({ children: runs, ...paragraphStyleOptions(bookSettings), ...options })
}

function listParagraphs(
  html: string,
  fontFamily: ExportFontFamily,
  fontSize: number,
  bookSettings: BookSettings,
  ordered: boolean
): Paragraph[] {
  const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  const items: string[] = []
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(html)) !== null) {
    items.push(match[1])
  }
  const font = docxFontName(fontFamily)
  const size = fontSize * 2
  return items.map((item, index) => {
    const contentRuns = runsFromHtml(item, fontFamily, fontSize)
    if (ordered) {
      return new Paragraph({
        children: [new TextRun({ text: `${index + 1}. `, font, size }), ...contentRuns],
        ...paragraphStyleOptions(bookSettings)
      })
    }
    return new Paragraph({
      children: contentRuns,
      bullet: { level: 0 },
      ...paragraphStyleOptions(bookSettings)
    })
  })
}

const BLOCK_REGEX =
  /<(h1|h2|h3|h4|p|blockquote|ul|ol|hr)[^>]*>([\s\S]*?)<\/\1>|<(h1|h2|h3|h4|p|blockquote|ul|ol|hr)[^>]*\/>/gi

export function htmlToDocxParagraphs(
  html: string,
  fontFamily: ExportFontFamily,
  fontSize: number,
  bookSettings: BookSettings
): Paragraph[] {
  const trimmed = html.trim()
  if (!trimmed) return [new Paragraph({ children: [new TextRun({ text: '' })] })]

  const paragraphs: Paragraph[] = []
  let match: RegExpExecArray | null
  let found = false

  while ((match = BLOCK_REGEX.exec(trimmed)) !== null) {
    found = true
    const tag = (match[1] ?? match[3]).toLowerCase()
    const inner = match[2] ?? ''

    switch (tag) {
      case 'h1':
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: runsFromHtml(inner, fontFamily, fontSize, { bold: true })
          })
        )
        break
      case 'h2':
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: runsFromHtml(inner, fontFamily, fontSize, { bold: true })
          })
        )
        break
      case 'h3':
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: runsFromHtml(inner, fontFamily, fontSize, { bold: true })
          })
        )
        break
      case 'h4':
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_4,
            children: runsFromHtml(inner, fontFamily, fontSize, { bold: true })
          })
        )
        break
      case 'blockquote':
        paragraphs.push(
          paragraphFromHtml(inner, fontFamily, fontSize, bookSettings, { indent: { left: 720 } })
        )
        break
      case 'ul':
        paragraphs.push(...listParagraphs(inner, fontFamily, fontSize, bookSettings, false))
        break
      case 'ol':
        paragraphs.push(...listParagraphs(inner, fontFamily, fontSize, bookSettings, true))
        break
      case 'hr':
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: '―'.repeat(20) })] }))
        break
      default:
        paragraphs.push(paragraphFromHtml(inner || stripTags(html), fontFamily, fontSize, bookSettings))
    }
  }

  if (!found) {
    paragraphs.push(paragraphFromHtml(trimmed, fontFamily, fontSize, bookSettings))
  }

  return paragraphs
}

export function titleParagraph(
  displayHeading: string,
  level: 'chapter' | 'scene',
  fontFamily: ExportFontFamily,
  fontSize: number
): Paragraph {
  const heading = level === 'chapter' ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2
  return new Paragraph({
    heading,
    children: [
      new TextRun({
        text: displayHeading,
        font: docxFontName(fontFamily),
        size: (level === 'chapter' ? fontSize + 6 : fontSize + 3) * 2,
        bold: true,
        underline: level === 'chapter' ? { type: UnderlineType.SINGLE } : undefined
      })
    ]
  })
}

export function sceneBreakParagraph(marker: string, fontFamily: ExportFontFamily, fontSize: number): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
    children: [
      new TextRun({
        text: marker,
        font: docxFontName(fontFamily),
        size: fontSize * 2
      })
    ]
  })
}

export function centeredTextParagraph(
  text: string,
  fontFamily: ExportFontFamily,
  fontSize: number,
  options?: { bold?: boolean; sizeOffset?: number; italics?: boolean }
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      new TextRun({
        text,
        font: docxFontName(fontFamily),
        size: (fontSize + (options?.sizeOffset ?? 0)) * 2,
        bold: options?.bold,
        italics: options?.italics
      })
    ]
  })
}

export function pageBreakParagraph(): Paragraph {
  return new Paragraph({ children: [new TextRun({ break: 1 })] })
}
