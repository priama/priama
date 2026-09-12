export const RESIZE_HANDLE_PILL_HEIGHT = 36

/** Top offset so a short pill stays centered on the pointer and inside the track. */
export function resizeHandlePillTop(
  pointerY: number,
  trackHeight: number,
  pillHeight = RESIZE_HANDLE_PILL_HEIGHT
): number {
  if (!Number.isFinite(pointerY) || !Number.isFinite(trackHeight) || trackHeight <= 0) return 0
  const height = Math.min(pillHeight, trackHeight)
  if (trackHeight <= height) return 0
  return Math.min(trackHeight - height, Math.max(0, pointerY - height / 2))
}
