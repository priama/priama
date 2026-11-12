import fse from 'fs-extra'
import { extname, join } from 'path'
import imageSize from 'image-size'
import {
  Document,
  Packer,
  Paragraph,
  ImageRun,
  AlignmentType,
  Header,
  TextRun,
  PageNumber,
  convertInchesToTwip
} from 'docx'
import type { BookSettings, ExportFormatting, ExportOptions, ExportSection } from '@shared/types'
import { buildFrontMatterBlocks } from '@shared/export/frontMatter'
import {
  docxFontName,
  effectiveSceneBreakMarker,
  marginInches,
  pageDimensions
} from '@shared/export/formatting'
import {
  centeredTextParagraph,
  htmlToDocxParagraphs,
  pageBreakParagraph,
  sceneBreakParagraph,
  titleParagraph
} from './htmlToDocx'
import { getProjectRootPath } from '../tomes/projectStore'

function sectionsToParagraphs(
  sections: ExportSection[],
  formatting: ExportFormatting,
  bookSettings: BookSettings
): Paragraph[] {
  const { fontFamily, fontSize } = formatting
  const sceneBreakMarker = effectiveSceneBreakMarker(formatting, bookSettings)
  const paragraphs: Paragraph[] = []

  for (const section of sections) {
    if (section.sceneBreakBefore && sceneBreakMarker) {
      paragraphs.push(sceneBreakParagraph(sceneBreakMarker, formatting))
    }

    if (section.displayHeading) {
      paragraphs.push(titleParagraph(section.displayHeading, section.level, fontFamily, fontSize))
    }

    if (section.html.trim()) {
      paragraphs.push(...htmlToDocxParagraphs(section.html, formatting, bookSettings))
    }
  }

  return paragraphs
}

function frontMatterParagraphs(
  bookSettings: BookSettings,
  title: string,
  author: string,
  formatting: ExportFormatting
): Paragraph[] {
  const { fontFamily, fontSize } = formatting
  const paragraphs: Paragraph[] = []
  const { htmlBlocks } = buildFrontMatterBlocks(bookSettings, { title, author })

  for (const block of htmlBlocks) {
    if (block.includes('title-page')) {
      paragraphs.push(centeredTextParagraph(title, fontFamily, fontSize, { bold: true, sizeOffset: 10 }))
      if (author) {
        paragraphs.push(centeredTextParagraph(author, fontFamily, fontSize, { italics: true, sizeOffset: 2 }))
      }
    } else if (block.includes('dedication-page')) {
      const text = bookSettings.dedication.trim()
      for (const line of text.split(/\n{2,}/).filter(Boolean)) {
        paragraphs.push(centeredTextParagraph(line.replace(/\n/g, ' '), fontFamily, fontSize))
      }
    } else if (block.includes('copyright-page')) {
      const text = bookSettings.copyrightText.trim()
      for (const line of text.split(/\n{2,}/).filter(Boolean)) {
        paragraphs.push(centeredTextParagraph(line.replace(/\n/g, ' '), fontFamily, fontSize))
      }
    }
    paragraphs.push(pageBreakParagraph())
  }

  return paragraphs
}

async function coverParagraphs(
  bookSettings: BookSettings,
  pageWidthTwip: number,
  pageHeightTwip: number,
  marginTwip: number
): Promise<Paragraph[]> {
  if (!bookSettings.coverImagePath) return []
  const root = getProjectRootPath()
  if (!root) return []

  const absolutePath = join(root, bookSettings.coverImagePath)
  if (!(await fse.pathExists(absolutePath))) return []

  try {
    const buffer = await fse.readFile(absolutePath)
    const dimensions = imageSize(buffer)
    if (!dimensions.width || !dimensions.height) return []

    const ext = extname(absolutePath).toLowerCase()
    const type =
      ext === '.png' ? 'png' : ext === '.gif' ? 'gif' : ext === '.bmp' ? 'bmp' : 'jpg'

    const maxWidth = pageWidthTwip - marginTwip * 2
    const maxHeight = pageHeightTwip - marginTwip * 2
    const widthRatio = maxWidth / dimensions.width
    const heightRatio = maxHeight / dimensions.height
    const scale = Math.min(widthRatio, heightRatio, 1)
    const width = Math.round(dimensions.width * scale)
    const height = Math.round(dimensions.height * scale)

    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: buffer,
            transformation: { width, height },
            type
          })
        ]
      }),
      pageBreakParagraph()
    ]
  } catch {
    return []
  }
}

/**
 * Page header for this export, when the formatting asks for one: header text
 * and/or the page number, right-aligned in the manuscript's own font.
 * Standard manuscript format puts "Author / TITLE / page" at the top right.
 */
function buildPageHeader(formatting: ExportFormatting): Header | undefined {
  const { headerText, headerPageNumber, fontFamily, fontSize } = formatting
  const text = headerText.trim()
  if (!text && !headerPageNumber) return undefined

  const font = docxFontName(fontFamily)
  const size = fontSize * 2
  const children: TextRun[] = []
  if (text) {
    children.push(new TextRun({ text: headerPageNumber ? `${text} / ` : text, font, size }))
  }
  if (headerPageNumber) {
    children.push(new TextRun({ children: [PageNumber.CURRENT], font, size }))
  }

  return new Header({
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children })]
  })
}

export async function exportDocx(
  savePath: string,
  options: ExportOptions,
  sections: ExportSection[],
  bookSettings: BookSettings
): Promise<void> {
  const { formatting, title, author } = options
  const margin = marginInches(formatting.marginPreset)
  const { width, height } = pageDimensions(formatting.pageSize)
  const marginTwip = convertInchesToTwip(margin)
  const widthTwip = convertInchesToTwip(width)
  const heightTwip = convertInchesToTwip(height)

  const cover = await coverParagraphs(bookSettings, widthTwip, heightTwip, marginTwip)
  const frontMatter = frontMatterParagraphs(bookSettings, title, author, formatting)
  const body = sectionsToParagraphs(sections, formatting, bookSettings)
  const header = buildPageHeader(formatting)

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: widthTwip, height: heightTwip },
            margin: {
              top: marginTwip,
              bottom: marginTwip,
              left: marginTwip,
              right: marginTwip
            }
          }
        },
        // docx v9 wants headers at the section level, not inside `properties`.
        ...(header ? { headers: { default: header } } : {}),
        children: [...cover, ...frontMatter, ...body]
      }
    ]
  })

  const buffer = await Packer.toBuffer(doc)
  await fse.writeFile(savePath, buffer)
}
