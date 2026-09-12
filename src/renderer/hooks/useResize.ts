import { useEffect, useRef, useCallback, useState } from 'react'
import { resolveCollapsibleWidth } from '@/lib/collapsiblePanelWidth'

export function useResizeHandle(
  width: number,
  onWidthChange: (w: number) => void,
  min: number,
  max: number,
  side: 'left' | 'right' = 'left',
  collapseBelow?: number,
  expandAbove?: number,
  collapsedWidth = 0
): {
  dragging: boolean
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void
    className: string
  }
} {
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingRef.current = true
      setDragging(true)
      const startX = e.clientX
      const startWidth = width

      const onMove = (ev: MouseEvent): void => {
        if (!draggingRef.current) return
        const delta = ev.clientX - startX
        const proposed = side === 'left' ? startWidth + delta : startWidth - delta
        if (collapseBelow == null) {
          onWidthChange(Math.min(max, Math.max(min, proposed)))
          return
        }
        onWidthChange(
          resolveCollapsibleWidth(proposed, {
            wasOpen: startWidth >= min,
            min,
            max,
            collapseBelow,
            expandAbove,
            collapsedWidth
          })
        )
      }

      const onUp = (): void => {
        draggingRef.current = false
        setDragging(false)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [width, onWidthChange, min, max, side, collapseBelow, expandAbove, collapsedWidth]
  )

  return {
    dragging,
    handleProps: {
      onMouseDown,
      className:
        'absolute top-0 z-10 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-primary/30 active:bg-primary/50 transition-colors'
    }
  }
}

export function usePersistLayout(width: number, key: 'sidebarWidth' | 'rightPanelWidth'): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      void window.electronAPI.windows.updateLayout({ [key]: width })
    }, 300)
    return () => clearTimeout(timer)
  }, [width, key])
}
