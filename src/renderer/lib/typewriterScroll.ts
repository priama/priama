/** Target caret Y as a fraction of the scrollport height (from the top). */
export const TYPEWRITER_RATIO = 0.45

export function clampScrollTop(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const max = Math.max(0, scrollHeight - clientHeight)
  return Math.min(max, Math.max(0, scrollTop))
}

/**
 * Delta to add to scrollTop so the caret's viewport Y lands on the typewriter line.
 * caretTop / scrollRectTop / scrollRectHeight are in viewport (client) coordinates.
 */
export function caretScrollDelta(params: {
  caretTop: number
  scrollRectTop: number
  scrollRectHeight: number
  ratio?: number
}): number {
  const ratio = params.ratio ?? TYPEWRITER_RATIO
  const targetY = params.scrollRectTop + params.scrollRectHeight * ratio
  return params.caretTop - targetY
}

export function nextScrollTop(params: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  caretTop: number
  scrollRectTop: number
  scrollRectHeight: number
  ratio?: number
}): number {
  const delta = caretScrollDelta(params)
  if (Math.abs(delta) < 0.5) return params.scrollTop
  return clampScrollTop(params.scrollTop + delta, params.scrollHeight, params.clientHeight)
}
