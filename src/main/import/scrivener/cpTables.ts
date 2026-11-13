/**
 * Byte → character tables for the Windows codepages Scrivener's RTF may declare
 * via \ansicpg. Only the ranges that differ from Latin-1 need explicit entries;
 * everything else maps identity.
 */

const CP1252_HIGH: Record<number, string> = {
  0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026',
  0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6', 0x89: '\u2030', 0x8A: '\u0160',
  0x8B: '\u2039', 0x8C: '\u0152', 0x8E: '\u017D', 0x91: '\u2018', 0x92: '\u2019',
  0x93: '\u201C', 0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A', 0x9C: '\u0153',
  0x9E: '\u017E', 0x9F: '\u0178'
}

function cp1251Table(): Record<number, string> {
  const t: Record<number, string> = { ...CP1252_HIGH }
  // 0x80-0x9F Cyrillic-specific overrides.
  const high = 'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—\u0098™љ›њќћџ'
  for (let i = 0; i < high.length; i++) {
    const ch = high[i]
    if (ch !== '\u0098') t[0x80 + i] = ch
  }
  // 0xA0-0xBF
  const mid = '\u00A0ЎўЈ¤Ґ¦§Ё©Є«¬\u00AD®Ї°±Ііґµ¶·ё№є»јЅѕї'
  for (let i = 0; i < mid.length; i++) t[0xA0 + i] = mid[i]
  // 0xC0-0xFF: А-Я then а-я, contiguous.
  for (let i = 0; i < 64; i++) t[0xC0 + i] = String.fromCharCode(0x0410 + i)
  return t
}

const CP1251 = cp1251Table()

/** Decode one \'xx byte under the given ANSI codepage. */
export function decodeAnsiByte(codepage: number, byte: number): string {
  if (byte < 0x80) return String.fromCharCode(byte)
  if (codepage === 1251) return CP1251[byte] ?? String.fromCharCode(byte)
  // 1252 is the default; other Western codepages differ from Latin-1 only in
  // rarely-used bytes, close enough for manuscript prose.
  if (codepage === 1252 || codepage === 0) return CP1252_HIGH[byte] ?? String.fromCharCode(byte)
  return String.fromCharCode(byte)
}
