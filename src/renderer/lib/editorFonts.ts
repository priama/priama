import type { EditorFontId } from '@shared/types'

// Literata (the default face) ships with index.css and Georgia is a system font. The other
// faces register their @font-face rules the first time something shows them.
const FONT_LOADERS: Partial<Record<EditorFontId, () => Promise<unknown>>> = {
  Merriweather: () =>
    Promise.all([
      import('@fontsource/merriweather/400.css'),
      import('@fontsource/merriweather/400-italic.css'),
      import('@fontsource/merriweather/700.css')
    ]),
  Lora: () =>
    Promise.all([
      import('@fontsource/lora/400.css'),
      import('@fontsource/lora/400-italic.css'),
      import('@fontsource/lora/600.css'),
      import('@fontsource/lora/700.css')
    ]),
  Inter: () =>
    Promise.all([
      import('@fontsource/inter/400.css'),
      import('@fontsource/inter/500.css'),
      import('@fontsource/inter/600.css'),
      import('@fontsource/inter/700.css')
    ])
}

const requested = new Map<EditorFontId, Promise<void>>()

export function loadEditorFont(font: EditorFontId): Promise<void> {
  const loader = FONT_LOADERS[font]
  if (!loader) return Promise.resolve()
  let pending = requested.get(font)
  if (!pending) {
    pending = loader().then(
      () => undefined,
      (err) => {
        requested.delete(font)
        console.error(`Failed to load the ${font} font:`, err)
      }
    )
    requested.set(font, pending)
  }
  return pending
}

// The toolbar font picker (since removed) wrote spans like style="font-family: Lora, serif".
const INLINE_FAMILY_RE = /font-family:\s*(?:&quot;|["'])?(Merriweather|Lora|Inter)\b/g

/** Load the faces that older documents still name in inline styles. */
export function loadEditorFontsUsedIn(html: string): void {
  for (const match of html.matchAll(INLINE_FAMILY_RE)) {
    void loadEditorFont(match[1] as EditorFontId)
  }
}
