import type {
  BookSettings,
  ExportFontFamily,
  ExportFormatting,
  ExportMarginPreset,
  ExportPageSize
} from '../types'

export function marginInches(preset: ExportMarginPreset): number {
  switch (preset) {
    case 'narrow':
      return 0.5
    case 'wide':
      return 1.5
    default:
      return 1
  }
}

export function fontCssFamily(family: ExportFontFamily): string {
  switch (family) {
    case 'times':
      return '"Times New Roman", Times, serif'
    case 'serif':
      return 'Georgia, "Times New Roman", Times, serif'
    default:
      return 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  }
}

export function docxFontName(family: ExportFontFamily): string {
  switch (family) {
    case 'times':
      return 'Times New Roman'
    case 'serif':
      return 'Georgia'
    default:
      return 'Calibri'
  }
}

export function pageDimensions(pageSize: ExportPageSize): { width: number; height: number } {
  if (pageSize === 'a4') {
    return { width: 11906, height: 16838 }
  }
  return { width: 12240, height: 15840 }
}

export function pdfPageSize(pageSize: ExportPageSize): 'A4' | 'Letter' {
  return pageSize === 'a4' ? 'A4' : 'Letter'
}

export function marginCss(formatting: ExportFormatting): string {
  const inches = marginInches(formatting.marginPreset)
  return `${inches}in`
}

/** CSS line-height for the exported body text. */
export function bodyLineHeight(formatting: ExportFormatting): number {
  return formatting.lineSpacing === 'double' ? 2 : 1.6
}

/** OOXML line height in 240ths of a line; 480 is double spacing. Undefined means single. */
export function docxLineSpacing(formatting: ExportFormatting): number | undefined {
  return formatting.lineSpacing === 'double' ? 480 : undefined
}

/**
 * The scene break marker for one export. A formatting-level marker (set by a
 * preset) wins; otherwise the project's book setting is used unchanged, so
 * presets never overwrite what the ebook export relies on.
 */
export function effectiveSceneBreakMarker(
  formatting: ExportFormatting,
  bookSettings: BookSettings
): string {
  return formatting.sceneBreakMarker ?? bookSettings.sceneBreakMarker
}
