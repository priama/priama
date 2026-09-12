export function resolveCollapsibleWidth(
  proposed: number,
  options: {
    wasOpen: boolean
    min: number
    max: number
    collapseBelow: number
    expandAbove?: number
    collapsedWidth?: number
  }
): number {
  const { wasOpen, min, max, collapseBelow, expandAbove = min, collapsedWidth = 0 } = options
  if (!wasOpen) {
    if (proposed < expandAbove) return collapsedWidth
    return Math.min(max, Math.max(min, proposed))
  }
  if (proposed < collapseBelow) return collapsedWidth
  return Math.min(max, Math.max(min, proposed))
}
