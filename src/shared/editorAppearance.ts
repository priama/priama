export const EDITOR_FONT_IDS = ['Literata', 'Georgia', 'Merriweather', 'Lora', 'Inter'] as const

export type EditorFontId = (typeof EDITOR_FONT_IDS)[number]

export interface EditorAppearance {
  font: EditorFontId
  size: number
  leading: number
  measure: number
}

export type EditorSizeStep = 'in' | 'out' | 'reset'

export const EDITOR_SIZE_MIN = 16
export const EDITOR_SIZE_MAX = 24
export const EDITOR_SIZE_STEP = 1
export const EDITOR_SIZE_DEFAULT = 18

export const EDITOR_LEADING_MIN = 1.4
export const EDITOR_LEADING_MAX = 2.0
export const EDITOR_LEADING_STEP = 0.125
export const EDITOR_LEADING_DEFAULT = 1.625

export const EDITOR_MEASURE_MIN = 60
export const EDITOR_MEASURE_MAX = 80
export const EDITOR_MEASURE_STEP = 1
export const EDITOR_MEASURE_DEFAULT = 80

/** Hardcoded stacks — the only strings that become CSS font-family. */
export const EDITOR_FONT_CSS: Record<EditorFontId, string> = {
  Literata: 'Literata, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  Georgia: 'Georgia, serif',
  Merriweather: 'Merriweather, serif',
  Lora: 'Lora, serif',
  Inter: 'Inter, system-ui, sans-serif'
}

export const DEFAULT_EDITOR_APPEARANCE: EditorAppearance = {
  font: 'Literata',
  size: EDITOR_SIZE_DEFAULT,
  leading: EDITOR_LEADING_DEFAULT,
  measure: EDITOR_MEASURE_DEFAULT
}

const FONT_ID_SET = new Set<string>(EDITOR_FONT_IDS)

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function snapLeading(value: number): number {
  const snapped = Math.round(value / EDITOR_LEADING_STEP) * EDITOR_LEADING_STEP
  const rounded = Math.round(snapped * 1000) / 1000
  return Math.min(EDITOR_LEADING_MAX, Math.max(EDITOR_LEADING_MIN, rounded))
}

function isEditorFontId(value: unknown): value is EditorFontId {
  return typeof value === 'string' && FONT_ID_SET.has(value)
}

export function clampEditorAppearance(raw: unknown): EditorAppearance {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const font = isEditorFontId(input.font) ? input.font : DEFAULT_EDITOR_APPEARANCE.font

  const size = Math.round(
    clampNumber(input.size, EDITOR_SIZE_MIN, EDITOR_SIZE_MAX, EDITOR_SIZE_DEFAULT)
  )

  const leadingRaw = clampNumber(
    input.leading,
    EDITOR_LEADING_MIN,
    EDITOR_LEADING_MAX,
    EDITOR_LEADING_DEFAULT
  )
  const leading = snapLeading(leadingRaw)

  const measure = Math.round(
    clampNumber(input.measure, EDITOR_MEASURE_MIN, EDITOR_MEASURE_MAX, EDITOR_MEASURE_DEFAULT)
  )

  return { font, size, leading, measure }
}

export function stepEditorSize(
  current: EditorAppearance,
  direction: EditorSizeStep
): EditorAppearance {
  if (direction === 'reset') {
    return clampEditorAppearance({ ...current, size: EDITOR_SIZE_DEFAULT })
  }
  const delta = direction === 'in' ? EDITOR_SIZE_STEP : -EDITOR_SIZE_STEP
  return clampEditorAppearance({ ...current, size: current.size + delta })
}

/** True when family is empty (inherit) or matches an allowlisted font id prefix. */
export function isSupportedFamily(family: string): boolean {
  if (!family) return true
  return EDITOR_FONT_IDS.some((id) => family.startsWith(id))
}

export function editorFontCss(font: EditorFontId): string {
  return EDITOR_FONT_CSS[font]
}
