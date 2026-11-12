import type { ExportFormatting } from '../types'
import { DEFAULT_EXPORT_FORMATTING } from '../types'

/** Which layout the export dialog applies to this export. */
export type ExportFormatPreset = 'book' | 'manuscript'

/** Scene break marker expected by standard manuscript format. */
export const MANUSCRIPT_SCENE_BREAK_MARKER = '#'

/**
 * Standard manuscript header: "Author / TITLE", with the page number appended
 * by the exporter. Uppercase title is the convention agents expect.
 */
export function manuscriptHeaderText(title: string, author: string): string {
  return [author.trim(), title.trim().toUpperCase()].filter(Boolean).join(' / ')
}

/**
 * The "standard manuscript format" agents and editors ask for: Times New Roman
 * 12, double-spaced, one-inch margins, author + title and page number in the
 * header, # scene breaks. Built fresh per export — nothing here is written
 * back to the project's book settings, so ebook exports stay untouched.
 */
export function manuscriptFormatting(title: string, author: string): ExportFormatting {
  return {
    ...DEFAULT_EXPORT_FORMATTING,
    fontFamily: 'times',
    fontSize: 12,
    lineSpacing: 'double',
    marginPreset: 'normal',
    pageSize: 'letter',
    headerText: manuscriptHeaderText(title, author),
    headerPageNumber: true,
    sceneBreakMarker: MANUSCRIPT_SCENE_BREAK_MARKER
  }
}
