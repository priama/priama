export interface HtmlBlock {
  tag: string
  inner: string
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'source', 'col', 'area'])

function isTagBoundary(ch: string | undefined): boolean {
  return ch === undefined || /[\s>/]/.test(ch)
}

function indexOfTag(html: string, tag: string, from: number, closing: boolean): number {
  const needle = closing ? `</${tag}` : `<${tag}`
  const src = html.toLowerCase()
  const n = needle.toLowerCase()
  let i = from
  while (i < src.length) {
    const idx = src.indexOf(n, i)
    if (idx === -1) return -1
    if (isTagBoundary(src[idx + n.length])) return idx
    i = idx + 1
  }
  return -1
}

function findMatchingClose(html: string, tag: string, from: number): number {
  let depth = 1
  let i = from
  while (i < html.length) {
    const nextOpen = indexOfTag(html, tag, i, false)
    const nextClose = indexOfTag(html, tag, i, true)
    if (nextClose === -1) return -1
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const end = html.indexOf('>', nextOpen)
      if (end === -1) return -1
      const openTag = html.slice(nextOpen, end + 1)
      if (!/\/\s*>$/.test(openTag)) depth += 1
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

function parseOpenTag(
  html: string,
  at: number
): { tag: string; end: number; selfClosing: boolean } | null {
  if (html[at] !== '<') return null
  const match = html.slice(at).match(/^<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/)
  if (!match) return null
  const full = match[0]
  const tag = match[1].toLowerCase()
  const closing = full.startsWith('</')
  if (closing) {
    return { tag, end: at + full.length, selfClosing: true }
  }
  const selfClosing = VOID_TAGS.has(tag) || /\/\s*>$/.test(full)
  return { tag, end: at + full.length, selfClosing }
}

/** Top-level HTML elements. Loose Word/mammoth markup becomes paragraph blocks. */
export function extractTopLevelBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = []
  const source = html.replace(/<!--[\s\S]*?-->/g, '')
  let i = 0

  while (i < source.length) {
    const next = source.indexOf('<', i)
    if (next === -1) {
      const text = source.slice(i).trim()
      if (text) blocks.push({ tag: 'p', inner: text })
      break
    }

    if (next > i) {
      const text = source.slice(i, next).trim()
      if (text) blocks.push({ tag: 'p', inner: text })
    }

    const parsed = parseOpenTag(source, next)
    if (!parsed) {
      i = next + 1
      continue
    }

    if (source[next + 1] === '/') {
      i = parsed.end
      continue
    }

    if (parsed.selfClosing) {
      blocks.push({ tag: parsed.tag, inner: '' })
      i = parsed.end
      continue
    }

    const closeAt = findMatchingClose(source, parsed.tag, parsed.end)
    if (closeAt === -1) {
      blocks.push({ tag: parsed.tag, inner: source.slice(parsed.end) })
      break
    }
    blocks.push({ tag: parsed.tag, inner: source.slice(parsed.end, closeAt) })
    const closeEnd = source.indexOf('>', closeAt)
    i = closeEnd === -1 ? source.length : closeEnd + 1
  }

  return blocks
}
