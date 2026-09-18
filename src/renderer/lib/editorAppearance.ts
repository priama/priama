import type { EditorAppearance } from '@shared/types'
import { EDITOR_FONT_CSS, clampEditorAppearance } from '@shared/types'
import { loadEditorFont } from '@/lib/editorFonts'

/** Apply allowlisted appearance as CSS variables on :root. Never writes document HTML. */
export function applyEditorAppearanceToDocument(raw: EditorAppearance): void {
  const appearance = clampEditorAppearance(raw)
  void loadEditorFont(appearance.font)
  const root = document.documentElement
  root.style.setProperty('--editor-font', EDITOR_FONT_CSS[appearance.font])
  root.style.setProperty('--editor-size', `${appearance.size}px`)
  root.style.setProperty('--editor-leading', String(appearance.leading))
  root.style.setProperty('--editor-measure', `${appearance.measure}ch`)
}
