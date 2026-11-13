/**
 * Minimal RTF reader for Scrivener's internal document files.
 *
 * Scope is deliberate: Scrivener emits machine-generated RTF, and Priama's
 * import sanitizer keeps only basic block/inline formatting anyway. This parses
 * the RTF into an AST and renders the subset that survives sanitization —
 * paragraphs, bold/italic/underline/strike/super/sub, line breaks, footnotes
 * (collected for end-of-document rendering) — while dropping destinations
 * (fonts, colors, images), annotations, and page furniture.
 *
 * Not a general RTF implementation, and intentionally so.
 */

export interface RtfGroup {
  type: 'group'
  /** Leading control word of a destination group, e.g. 'footnote', 'atnid', '*'. */
  destination?: string
  children: RtfNode[]
}

export interface RtfText {
  type: 'text'
  text: string
}

export interface RtfControl {
  type: 'control'
  word: string
  param?: number
}

export type RtfNode = RtfGroup | RtfText | RtfControl

export class RtfParseError extends Error {}

/** Tokenize + group-parse an RTF string into an AST. */
export function parseRtf(input: string): RtfGroup {
  const root: RtfGroup = { type: 'group', children: [] }
  const stack: RtfGroup[] = [root]
  let i = 0

  const top = (): RtfGroup => stack[stack.length - 1]

  while (i < input.length) {
    const ch = input[i]

    if (ch === '{') {
      const group: RtfGroup = { type: 'group', children: [] }
      top().children.push(group)
      stack.push(group)
      i++
      continue
    }

    if (ch === '}') {
      if (stack.length === 1) throw new RtfParseError('Unbalanced } in RTF')
      stack.pop()
      i++
      continue
    }

    if (ch === '\\') {
      const next = input[i + 1]

      if (next === undefined) break

      // Escaped literal characters.
      if (next === '{' || next === '}' || next === '\\') {
        top().children.push({ type: 'text', text: next })
        i += 2
        continue
      }

      // Control symbol: \ followed by a non-letter.
      if (!/[a-zA-Z]/.test(next)) {
        // \'xx — codepage byte pair, handled by the emitter via a control node.
        if (next === "'") {
          const hex = input.slice(i + 2, i + 4)
          if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new RtfParseError("Bad \\' escape")
          top().children.push({ type: 'control', word: "'", param: parseInt(hex, 16) })
          i += 4
          continue
        }
        top().children.push({ type: 'control', word: next })
        i += 2
        continue
      }

      // Control word: letters, optional signed numeric param, optional single
      // space delimiter (consumed, not text).
      const match = input.slice(i).match(/^\\([a-zA-Z]+)(-?\d+)? ?/)
      if (!match) throw new RtfParseError(`Bad control word at ${i}`)
      const word = match[1]
      const param = match[2] !== undefined ? parseInt(match[2], 10) : undefined
      top().children.push({ type: 'control', word, param })
      i += match[0].length
      continue
    }

    // Plain text run until the next special character. RTF line breaks in the
    // source are formatting, not content.
    let end = i
    while (end < input.length && input[end] !== '\\' && input[end] !== '{' && input[end] !== '}') {
      end++
    }
    const raw = input.slice(i, end)
    const text = raw.replace(/[\r\n]/g, '')
    if (text) top().children.push({ type: 'text', text })
    i = end
  }

  if (stack.length !== 1) throw new RtfParseError('Unbalanced { in RTF')
  return root
}
