import { parseRtf, type RtfGroup, type RtfNode } from './rtfParse'
import { decodeAnsiByte } from './cpTables'

/**
 * RTF → Priama HTML, for the dialect Scrivener writes into Files/Data/*.rtf.
 *
 * Output is restricted to what sanitizeImportedHtml keeps: <p>, <br>, and the
 * inline marks strong/em/u/s/sup/sub. Footnotes are pulled out of the flow and
 * rendered as an end-of-document notes list (product decision); annotations are
 * dropped; images, colors, fonts and alignment do not survive the sanitizer and
 * are not modeled here.
 */

/** Destinations whose entire group is skipped. */
const SKIP_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'listtable',
  'listoverridetable',
  'info',
  'generator',
  'header',
  'footer',
  'headerl',
  'headerr',
  'headerf',
  'footerl',
  'footerr',
  'footerf',
  'pict',
  'shppict',
  'nonshppict',
  'blipuid',
  'colorschememapping',
  'themedata',
  'latentstyles',
  'datastore',
  'annotation',
  'atnid',
  'atndate',
  'atnref',
  'atnauthor',
  'atntime',
  'bkmkstart',
  'bkmkend',
  'revtbl',
  'filetbl',
  'objdata',
  'mmath'
])

interface CharState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  superscript: boolean
  subscript: boolean
}

const PLAIN_STATE: CharState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  superscript: false,
  subscript: false
}

interface EmitContext {
  paragraphs: string[]
  inline: string[]
  footnotes: string[]
  codepage: number
  ucSkip: number
  /** Fallback chars still to swallow after a \uN escape. */
  pendingSkip: number
  inFootnote: boolean
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function destinationOf(group: RtfGroup): string | null {
  const first = group.children[0]
  if (!first || first.type !== 'control') return null
  if (first.word === '*') {
    // {\*\atnid ...} — the real destination name follows the \* marker.
    const second = group.children[1]
    return second && second.type === 'control' ? second.word : '*'
  }
  return first.word
}

function isStarred(group: RtfGroup): boolean {
  const first = group.children[0]
  return !!first && first.type === 'control' && first.word === '*'
}

function isDestination(node: RtfNode, name: string): boolean {
  return node.type === 'group' && destinationOf(node) === name
}

function groupContainsControl(group: RtfNode, test: (word: string, param?: number) => boolean): boolean {
  if (group.type === 'control') return test(group.word, group.param)
  if (group.type !== 'group') return false
  return group.children.some((c) => groupContainsControl(c, test))
}

/**
 * Scrivener stores an annotation as a styled run (colored and/or highlighted)
 * immediately followed by {\*\atnid}{\*\atndate}{\*\atnref} marker groups.
 * Drop the run when the markers are present — but only when the run really is
 * annotation-styled, so a manuscript word that happens to sit before an anchor
 * is never deleted. VERIFY against a real .scriv fixture.
 */
function stripAnnotationRuns(group: RtfGroup): void {
  for (const child of group.children) {
    if (child.type === 'group') stripAnnotationRuns(child)
  }

  for (let i = 0; i < group.children.length; i++) {
    if (!isDestination(group.children[i], 'atnid')) continue
    const prev = group.children[i - 1]
    if (!prev || prev.type !== 'group') continue
    const colored = groupContainsControl(
      prev,
      (w, p) => (w === 'cf' && p !== undefined && p >= 2) || (w === 'cb' && p !== undefined && p >= 1)
    )
    const marked = groupContainsControl(prev, (w) => w === 'ul' || w === 'chshdng')
    if (colored && marked) {
      group.children.splice(i - 1, 1)
      i--
    }
  }
}

function openTags(state: CharState): string {
  let out = ''
  if (state.superscript) out += '<sup>'
  if (state.subscript) out += '<sub>'
  if (state.bold) out += '<strong>'
  if (state.italic) out += '<em>'
  if (state.underline) out += '<u>'
  if (state.strike) out += '<s>'
  return out
}

function closeTags(state: CharState): string {
  let out = ''
  if (state.strike) out += '</s>'
  if (state.underline) out += '</u>'
  if (state.italic) out += '</em>'
  if (state.bold) out += '</strong>'
  if (state.subscript) out += '</sub>'
  if (state.superscript) out += '</sup>'
  return out
}

function pushText(ctx: EmitContext, state: CharState, text: string): void {
  if (!text) return
  if (ctx.pendingSkip > 0) {
    const skipped = Math.min(ctx.pendingSkip, text.length)
    ctx.pendingSkip -= skipped
    text = text.slice(skipped)
    if (!text) return
  }
  ctx.inline.push(openTags(state) + escapeHtml(text) + closeTags(state))
}

function flushParagraph(ctx: EmitContext): void {
  const inner = ctx.inline.join('')
  ctx.inline = []
  ctx.paragraphs.push(`<p>${inner}</p>`)
}

const CONTROL_SYMBOL_TEXT: Record<string, string> = {
  '~': '\u00A0',
  emdash: '\u2014',
  endash: '\u2013',
  emspace: '\u2003',
  enspace: '\u2002',
  qmspace: '\u2005',
  lquote: '\u2018',
  rquote: '\u2019',
  ldblquote: '\u201C',
  rdblquote: '\u201D',
  bullet: '\u2022',
  _: '' // non-breaking space variant
}

function applyControl(
  ctx: EmitContext,
  state: CharState,
  word: string,
  param: number | undefined
): void {
  switch (word) {
    case 'b':
      state.bold = param !== 0
      return
    case 'i':
      state.italic = param !== 0
      return
    case 'ul':
      state.underline = param !== 0
      return
    case 'ulnone':
      state.underline = false
      return
    case 'strike':
      state.strike = param !== 0
      return
    case 'super':
      state.superscript = param !== 0
      state.subscript = false
      return
    case 'sub':
      state.subscript = param !== 0
      state.superscript = false
      return
    case 'plain':
      Object.assign(state, PLAIN_STATE)
      return
    case 'par':
    case 'row':
      flushParagraph(ctx)
      return
    case 'line':
      ctx.inline.push('<br>')
      return
    case 'tab':
    case 'cell':
      pushText(ctx, state, ' ')
      return
    case "'":
      if (param !== undefined) pushText(ctx, state, decodeAnsiByte(ctx.codepage, param))
      return
    case 'u':
      if (param !== undefined) {
        const code = param < 0 ? param + 65536 : param
        pushText(ctx, state, String.fromCharCode(code))
        ctx.pendingSkip = ctx.ucSkip
      }
      return
    case 'uc':
      ctx.ucSkip = param ?? 1
      return
    case 'ansicpg':
      if (param) ctx.codepage = param
      return
    case 'chftn':
      // Footnote reference marker — the <sup> is emitted by the footnote group.
      return
    default:
      if (word in CONTROL_SYMBOL_TEXT) {
        pushText(ctx, state, CONTROL_SYMBOL_TEXT[word])
      }
      // Everything else (fonts, sizes, colors, spacing, sect/page furniture)
      // has no representation in the Priama HTML subset and is ignored.
      return
  }
}

function walk(ctx: EmitContext, state: CharState, nodes: RtfNode[]): void {
  for (const node of nodes) {
    if (node.type === 'text') {
      pushText(ctx, state, node.text)
      continue
    }

    if (node.type === 'control') {
      applyControl(ctx, state, node.word, node.param)
      continue
    }

    // Group.
    // \* marks a destination this reader does not implement — per the RTF spec
    // the whole group must be skipped (annotations' atn* markers land here).
    if (isStarred(node)) continue

    const dest = destinationOf(node)
    if (dest && SKIP_DESTINATIONS.has(dest)) continue

    if (dest === 'footnote') {
      const footnoteCtx: EmitContext = {
        paragraphs: [],
        inline: [],
        footnotes: [],
        codepage: ctx.codepage,
        ucSkip: ctx.ucSkip,
        pendingSkip: 0,
        inFootnote: true
      }
      walk(footnoteCtx, { ...PLAIN_STATE }, node.children.slice(1))
      if (footnoteCtx.inline.length > 0) flushParagraph(footnoteCtx)
      // Drop the trailing empty paragraph most writers emit.
      while (
        footnoteCtx.paragraphs.length > 1 &&
        footnoteCtx.paragraphs[footnoteCtx.paragraphs.length - 1] === '<p></p>'
      ) {
        footnoteCtx.paragraphs.pop()
      }
      ctx.footnotes.push(
        footnoteCtx.paragraphs
          .map((p) => p.replace(/<\/?p>/g, ''))
          .join(' ')
          .trim()
      )
      const n = ctx.footnotes.length
      ctx.inline.push(`<sup>${n}</sup>`)
      continue
    }

    // A plain formatting group: state changes are scoped to the group.
    walk(ctx, { ...state }, node.children)
  }
}

export interface RtfConversion {
  html: string
  footnoteCount: number
}

export function rtfToHtml(rtf: string): RtfConversion {
  const root = parseRtf(rtf)
  stripAnnotationRuns(root)

  const ctx: EmitContext = {
    paragraphs: [],
    inline: [],
    footnotes: [],
    codepage: 1252,
    ucSkip: 1,
    pendingSkip: 0,
    inFootnote: false
  }

  walk(ctx, { ...PLAIN_STATE }, root.children)
  if (ctx.inline.length > 0) flushParagraph(ctx)

  // Trim trailing empty paragraphs; keep interior ones (scene spacing).
  while (
    ctx.paragraphs.length > 0 &&
    ctx.paragraphs[ctx.paragraphs.length - 1] === '<p></p>'
  ) {
    ctx.paragraphs.pop()
  }

  let html = ctx.paragraphs.join('')

  if (ctx.footnotes.length > 0) {
    const items = ctx.footnotes.map((f) => `<li>${f}</li>`).join('')
    html += `<hr><p><strong>Notes</strong></p><ol>${items}</ol>`
  }

  return { html, footnoteCount: ctx.footnotes.length }
}
