import type { ExportFormatting, BookSettings, ExportSection } from '@shared/types'
import { paragraphBodyCss } from '@shared/export/frontMatter'
import { fontCssFamily, marginCss } from './formatting'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sectionBody(section: ExportSection, settings: BookSettings): string {
  const parts: string[] = []

  if (section.sceneBreakBefore && settings.sceneBreakMarker) {
    parts.push(`<p class="scene-break">${escapeHtml(settings.sceneBreakMarker)}</p>`)
  }

  if (section.displayHeading) {
    const tag = section.level === 'chapter' ? 'h1' : 'h2'
    parts.push(`<${tag}>${escapeHtml(section.displayHeading)}</${tag}>`)
  }

  if (section.html.trim()) {
    parts.push(section.html)
  } else if (!section.displayHeading) {
    parts.push('<p></p>')
  }

  return parts.join('')
}

export function buildManuscriptHtml(
  title: string,
  author: string,
  sections: ExportSection[],
  formatting: ExportFormatting,
  bookSettings: BookSettings,
  options?: { coverDataUri?: string | null; frontMatterHtml?: string[] }
): string {
  const body = sections.map((s) => sectionBody(s, bookSettings)).join('\n')
  const font = fontCssFamily(formatting.fontFamily)
  const margin = marginCss(formatting)
  const fontSize = `${formatting.fontSize}pt`
  const coverHtml = options?.coverDataUri
    ? `<div class="cover-page"><img src="${options.coverDataUri}" alt="" /></div>`
    : ''
  const frontMatter = (options?.frontMatterHtml ?? []).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: ${margin}; }
    body {
      font-family: ${font};
      font-size: ${fontSize};
      line-height: 1.6;
      color: #111;
      margin: ${margin};
      max-width: none;
    }
    h1 { font-size: 1.75em; margin: 1.5em 0 0.75em; page-break-before: always; }
    h1:first-child { page-break-before: avoid; margin-top: 0; }
    h2 { font-size: 1.35em; margin: 1.25em 0 0.5em; }
    h3 { font-size: 1.15em; margin: 1em 0 0.5em; }
    h4 { font-size: 1.05em; margin: 0.75em 0 0.5em; }
    ${paragraphBodyCss(bookSettings)}
    ul, ol { margin: 0 0 0.75em 1.5em; }
    blockquote { margin: 0 0 0.75em; padding-left: 1em; border-left: 3px solid #ccc; color: #444; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    u { text-decoration: underline; }
    .cover-page { page-break-after: always; text-align: center; }
    .cover-page img { max-width: 100%; max-height: 100vh; object-fit: contain; }
    .title-page, .dedication-page, .copyright-page {
      text-align: center;
      margin-bottom: 3em;
      page-break-after: always;
    }
    .title-page h1 { page-break-before: avoid; font-size: 2em; }
    .title-page .author { font-size: 1.1em; color: #444; margin-top: 0.5em; }
    .dedication-page, .copyright-page { padding-top: 30vh; }
    .scene-break { text-align: center; margin: 1.5em 0; }
  </style>
</head>
<body>
  ${coverHtml}
  ${frontMatter}
  ${body}
</body>
</html>`
}
