import { useEffect, useRef, useState } from 'react'
import { SIDEBAR_ICON_ONLY_THRESHOLD } from '@shared/types'

export const SIDEBAR_WIDTH_MOTION_MS = 450

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Animates width when the sidebar snaps between the icon rail and expanded
 * band. Layout mode follows the target immediately so the only motion is width.
 */
export function useSidebarCollapseMotion(width: number): {
  iconOnly: boolean
  animating: boolean
  motionClassName: string
} {
  const collapsed = width <= SIDEBAR_ICON_ONLY_THRESHOLD
  const prevCollapsed = useRef(collapsed)
  const [animating, setAnimating] = useState(false)

  if (prevCollapsed.current !== collapsed) {
    prevCollapsed.current = collapsed
    if (!animating) setAnimating(true)
  }

  useEffect(() => {
    if (!animating) return
    if (prefersReducedMotion()) {
      setAnimating(false)
      return
    }
    const timer = window.setTimeout(() => setAnimating(false), SIDEBAR_WIDTH_MOTION_MS)
    return () => window.clearTimeout(timer)
  }, [animating, collapsed])

  return {
    iconOnly: collapsed,
    animating,
    motionClassName: animating ? 'sidebar-width-motion' : ''
  }
}
