/** Block / break tags that should insert a space so adjacent paragraphs don't glue. */
const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'BR',
  'LI',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'TR',
  'HR',
  'PRE'
])

/**
 * Extract searchable plain text from TipTap/HTML content.
 * Concatenates text nodes (so mark-split words like `ob<span>sidian</span>` stay
 * `obsidian`), inserts spaces at block boundaries, and collapses whitespace.
 * Entities are decoded via DOMParser.
 */
export function htmlToSearchText(html: string): string {
  if (!html) return ''

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const parts: string[] = []

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as Element
    const tag = el.tagName
    if (tag === 'SCRIPT' || tag === 'STYLE') return

    if (tag === 'BR') {
      parts.push(' ')
      return
    }

    const isBlock = BLOCK_TAGS.has(tag)
    if (isBlock) parts.push(' ')

    for (const child of Array.from(el.childNodes)) {
      walk(child)
    }

    if (isBlock) parts.push(' ')
  }

  walk(doc.body)
  return parts.join('').replace(/\s+/g, ' ').trim()
}
