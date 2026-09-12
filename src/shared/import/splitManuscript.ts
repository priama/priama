import { extractTopLevelBlocks } from './htmlBlocks'
import { decodeHtmlEntities, stripTagsToText } from './htmlEntities'
import { sanitizeImportedHtml } from './sanitizeImportedHtml'
import { countHtmlWords } from '../manuscriptMeta'
import type { ManuscriptImportChapter, ManuscriptSplitMode } from '../types'

const TITLE_MAX = 120

const CHAPTER_HEADING_RE =
  /^(chapter|cap[ií]tulo)\s+\S+/i

const NAMED_FRONT_OR_PART_RE =
  /^(prologue|epilogue|preface|introduction|afterword|foreword|acknowledgements|acknowledgments|part\s+\S+)/i

export interface SplitManuscriptResult {
  chapters: ManuscriptImportChapter[]
  mode: ManuscriptSplitMode
}

function normalizeTitle(raw: string, fallback: string): string {
  const title = stripTagsToText(raw).replace(/\s+/g, ' ').trim()
  if (!title) return fallback
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title
}

function isEmptyBody(html: string): boolean {
  return countHtmlWords(html) === 0
}

function renderBlocks(blocks: { tag: string; inner: string }[]): string {
  return blocks
    .map((block) => {
      if (block.tag === 'hr') return '<hr>'
      if (block.tag === 'br') return ''
      return `<${block.tag}>${block.inner}</${block.tag}>`
    })
    .join('')
}

function looksLikeChapterHeading(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 80) return false
  return CHAPTER_HEADING_RE.test(trimmed) || NAMED_FRONT_OR_PART_RE.test(trimmed)
}

function withoutRedundantTitle(
  title: string,
  bodyBlocks: { tag: string; inner: string }[]
): { tag: string; inner: string }[] {
  const first = bodyBlocks[0]
  if (!first) return bodyBlocks
  if (first.tag !== 'p' && first.tag !== 'h1') return bodyBlocks
  if (stripTagsToText(first.inner) === title.trim()) return bodyBlocks.slice(1)
  return bodyBlocks
}

function pushChapter(
  chapters: ManuscriptImportChapter[],
  title: string,
  bodyBlocks: { tag: string; inner: string }[],
  fallbackTitle: string
): void {
  const normalized = normalizeTitle(title, fallbackTitle)
  const html = sanitizeImportedHtml(renderBlocks(withoutRedundantTitle(normalized, bodyBlocks)))
  if (isEmptyBody(html) && chapters.length > 0) return
  chapters.push({
    title: normalized,
    html: isEmptyBody(html) ? '<p></p>' : html
  })
}

function splitByHeading1(html: string): ManuscriptImportChapter[] {
  const blocks = extractTopLevelBlocks(html)
  const chapters: ManuscriptImportChapter[] = []
  let currentTitle: string | null = null
  let currentBody: { tag: string; inner: string }[] = []

  const flush = (): void => {
    if (currentTitle === null && currentBody.length === 0) return
    if (currentTitle === null) {
      if (!isEmptyBody(sanitizeImportedHtml(renderBlocks(currentBody)))) {
        pushChapter(chapters, 'Front matter', currentBody, 'Front matter')
      }
    } else {
      pushChapter(chapters, currentTitle, currentBody, `Chapter ${chapters.length + 1}`)
    }
    currentBody = []
  }

  for (const block of blocks) {
    if (block.tag === 'h1') {
      flush()
      currentTitle = decodeHtmlEntities(stripTagsToText(block.inner))
      currentBody = []
      continue
    }
    currentBody.push(block)
  }
  flush()
  return chapters
}

function splitByChapterPattern(html: string): ManuscriptImportChapter[] {
  const blocks = extractTopLevelBlocks(html)
  const chapters: ManuscriptImportChapter[] = []
  let currentTitle: string | null = null
  let currentBody: { tag: string; inner: string }[] = []

  const flush = (): void => {
    if (currentTitle === null && currentBody.length === 0) return
    if (currentTitle === null) {
      if (!isEmptyBody(sanitizeImportedHtml(renderBlocks(currentBody)))) {
        pushChapter(chapters, 'Front matter', currentBody, 'Front matter')
      }
    } else {
      pushChapter(chapters, currentTitle, currentBody, `Chapter ${chapters.length + 1}`)
    }
    currentBody = []
  }

  for (const block of blocks) {
    const text = stripTagsToText(block.inner)
    const headingish = block.tag === 'p' || /^h[1-6]$/.test(block.tag)
    if (headingish && looksLikeChapterHeading(text)) {
      flush()
      currentTitle = text
      currentBody = []
      continue
    }
    currentBody.push(block)
  }
  flush()
  return chapters
}

function asSingleDocument(html: string): ManuscriptImportChapter[] {
  const blocks = extractTopLevelBlocks(html)
  let title = 'Chapter 1'
  let body = blocks
  const first = blocks[0]
  if (first && /^h[1-4]$/.test(first.tag)) {
    const heading = stripTagsToText(first.inner)
    if (heading) title = heading
    body = blocks.slice(1)
  }
  const sanitized = sanitizeImportedHtml(renderBlocks(body.length > 0 ? body : blocks))
  return [{ title: normalizeTitle(title, 'Chapter 1'), html: sanitized }]
}

export function detectSplitMode(html: string): ManuscriptSplitMode {
  const sanitized = sanitizeImportedHtml(html)
  const headingChapters = splitByHeading1(sanitized)
  if (headingChapters.length >= 2) return 'heading1'
  const patternChapters = splitByChapterPattern(sanitized)
  if (patternChapters.length >= 2) return 'chapter-pattern'
  return 'single'
}

export function splitManuscript(html: string, mode: ManuscriptSplitMode): SplitManuscriptResult {
  const sanitized = sanitizeImportedHtml(html)
  let chapters: ManuscriptImportChapter[]
  if (mode === 'heading1') chapters = splitByHeading1(sanitized)
  else if (mode === 'chapter-pattern') chapters = splitByChapterPattern(sanitized)
  else chapters = asSingleDocument(sanitized)

  if (chapters.length === 0) {
    chapters = asSingleDocument(sanitized)
    return { chapters, mode: 'single' }
  }
  return { chapters, mode }
}

export function splitManuscriptAuto(html: string): SplitManuscriptResult {
  const mode = detectSplitMode(sanitizeImportedHtml(html))
  return splitManuscript(html, mode)
}
