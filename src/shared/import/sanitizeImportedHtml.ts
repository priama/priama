import { extractTopLevelBlocks } from './htmlBlocks'
import { stripTagsToText } from './htmlEntities'

const BLOCK_REWRITE: Record<string, string> = {
  h5: 'h4',
  h6: 'h4'
}

const ALLOWED_BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'pre', 'hr'])

const ALLOWED_INLINE = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'strike', 'br', 'sub', 'sup', 'code'])

const INLINE_REWRITE: Record<string, string> = {
  b: 'strong',
  i: 'em',
  strike: 's'
}

const UNWRAP_BLOCKS = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'span', 'font'])

const DROP_BLOCKS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'img', 'svg', 'video', 'audio', 'picture'])

function parseInlineOpen(
  html: string,
  at: number
): { tag: string; end: number; closing: boolean; selfClosing: boolean } | null {
  if (html[at] !== '<') return null
  const match = html.slice(at).match(/^<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/)
  if (!match) return null
  const full = match[0]
  const tag = match[1].toLowerCase()
  const closing = full.startsWith('</')
  const selfClosing = closing || tag === 'br' || tag === 'hr' || tag === 'img' || /\/\s*>$/.test(full)
  return { tag, end: at + full.length, closing, selfClosing }
}

function findMatchingClose(html: string, tag: string, from: number): number {
  const lower = html.toLowerCase()
  const openNeedle = `<${tag}`
  const closeNeedle = `</${tag}`
  let depth = 1
  let i = from
  while (i < html.length) {
    const nextOpen = indexOfNamedTag(lower, openNeedle, i)
    const nextClose = indexOfNamedTag(lower, closeNeedle, i)
    if (nextClose === -1) return -1
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const end = html.indexOf('>', nextOpen)
      if (end === -1) return -1
      if (!/\/\s*>$/.test(html.slice(nextOpen, end + 1))) depth += 1
      i = end + 1
    } else {
      const end = html.indexOf('>', nextClose)
      if (end === -1) return -1
      depth -= 1
      if (depth === 0) return nextClose
      i = end + 1
    }
  }
  return -1
}

function indexOfNamedTag(lowerHtml: string, needle: string, from: number): number {
  let i = from
  while (i < lowerHtml.length) {
    const idx = lowerHtml.indexOf(needle, i)
    if (idx === -1) return -1
    const after = lowerHtml[idx + needle.length]
    if (after === undefined || /[\s>\/]/.test(after)) return idx
    i = idx + 1
  }
  return -1
}

function sanitizeInline(html: string): string {
  let out = ''
  let i = 0
  while (i < html.length) {
    const next = html.indexOf('<', i)
    if (next === -1) {
      out += html.slice(i)
      break
    }
    out += html.slice(i, next)
    const parsed = parseInlineOpen(html, next)
    if (!parsed) {
      out += '&lt;'
      i = next + 1
      continue
    }
    if (parsed.closing) {
      i = parsed.end
      continue
    }
    if (parsed.tag === 'br') {
      out += '<br>'
      i = parsed.end
      continue
    }
    if (parsed.selfClosing) {
      i = parsed.end
      continue
    }
    const closeAt = findMatchingClose(html, parsed.tag, parsed.end)
    const inner = closeAt === -1 ? html.slice(parsed.end) : html.slice(parsed.end, closeAt)
    const closeEnd = closeAt === -1 ? html.length : html.indexOf('>', closeAt) + 1
    if (parsed.tag === 'script' || parsed.tag === 'style') {
      i = closeEnd <= 0 ? html.length : closeEnd
      continue
    }
    const rewritten = INLINE_REWRITE[parsed.tag] ?? parsed.tag
    if (ALLOWED_INLINE.has(parsed.tag)) {
      const sanitizedInner = sanitizeInline(inner)
      out += `<${rewritten}>${sanitizedInner}</${rewritten}>`
    } else {
      out += sanitizeInline(inner)
    }
    i = closeEnd <= 0 ? html.length : closeEnd
  }
  return out
}

function cellsToParagraphs(tableHtml: string): string[] {
  const cells = [...tableHtml.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
  const paragraphs: string[] = []
  for (const cell of cells) {
    const text = stripTagsToText(cell[1] ?? '')
    if (text) paragraphs.push(`<p>${escapeText(text)}</p>`)
  }
  return paragraphs
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeList(tag: 'ul' | 'ol', inner: string): string {
  const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  if (items.length === 0) {
    const text = stripTagsToText(inner)
    if (!text) return ''
    return `<${tag}><li>${escapeText(text)}</li></${tag}>`
  }
  const lis = items
    .map((item) => {
      const content = sanitizeInline(item[1] ?? '').trim()
      return content ? `<li>${content}</li>` : ''
    })
    .filter(Boolean)
  if (lis.length === 0) return ''
  return `<${tag}>${lis.join('')}</${tag}>`
}

function flattenBlocks(html: string): { tag: string; inner: string }[] {
  const out: { tag: string; inner: string }[] = []
  for (const block of extractTopLevelBlocks(html)) {
    const tag = block.tag.toLowerCase()
    if (UNWRAP_BLOCKS.has(tag)) {
      out.push(...flattenBlocks(block.inner))
      continue
    }
    if (DROP_BLOCKS.has(tag)) {
      continue
    }
    if (tag === 'table') {
      for (const p of cellsToParagraphs(block.inner)) {
        out.push(...extractTopLevelBlocks(p))
      }
      continue
    }
    out.push(block)
  }
  return out
}

/** Keep the subset of HTML TipTap stores: headings, paragraphs, lists, quotes, basic marks. */
export function sanitizeImportedHtml(html: string): string {
  const blocks = flattenBlocks(html)
  const parts: string[] = []

  for (const block of blocks) {
    const mapped = BLOCK_REWRITE[block.tag] ?? block.tag
    if (mapped === 'hr') {
      parts.push('<hr>')
      continue
    }
    if (mapped === 'ul' || mapped === 'ol') {
      const list = sanitizeList(mapped, block.inner)
      if (list) parts.push(list)
      continue
    }
    if (mapped === 'pre') {
      const text = stripTagsToText(block.inner)
      if (text) parts.push(`<pre><code>${escapeText(text)}</code></pre>`)
      continue
    }
    if (!ALLOWED_BLOCKS.has(mapped)) {
      const text = stripTagsToText(block.inner)
      if (text) parts.push(`<p>${escapeText(text)}</p>`)
      continue
    }
    const inner = sanitizeInline(block.inner).trim()
    if (!inner && mapped !== 'p') continue
    parts.push(`<${mapped}>${inner}</${mapped}>`)
  }

  return parts.join('') || '<p></p>'
}
