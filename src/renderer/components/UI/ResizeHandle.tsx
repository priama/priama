import { useCallback, useEffect, useRef, useState } from 'react'
import { useResizeHandle } from '@/hooks/useResize'
import { RESIZE_HANDLE_PILL_HEIGHT, resizeHandlePillTop } from '@/lib/resizeHandlePill'
import { cn } from '@/lib/utils'

type ResizeHandleProps = {
  width: number
  onWidthChange: (width: number) => void
  min: number
  max: number
  side?: 'left' | 'right'
  collapseBelow?: number
  expandAbove?: number
  collapsedWidth?: number
}

export function ResizeHandle({
  width,
  onWidthChange,
  min,
  max,
  side = 'left',
  collapseBelow,
  expandAbove,
  collapsedWidth
}: ResizeHandleProps): React.JSX.Element {
  const { dragging, handleProps } = useResizeHandle(
    width,
    onWidthChange,
    min,
    max,
    side,
    collapseBelow,
    expandAbove,
    collapsedWidth
  )
  const handleRef = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)
  const [pillTop, setPillTop] = useState(0)

  const updatePill = useCallback((clientY: number) => {
    const el = handleRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPillTop(resizeHandlePillTop(clientY - rect.top, rect.height))
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (event: MouseEvent): void => {
      updatePill(event.clientY)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [dragging, updatePill])

  const edge = side === 'left' ? 'right' : 'left'
  const visible = hovering || dragging

  return (
    <div
      ref={handleRef}
      onMouseDown={handleProps.onMouseDown}
      onMouseEnter={(event) => {
        setHovering(true)
        updatePill(event.clientY)
      }}
      onMouseMove={(event) => updatePill(event.clientY)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        'absolute top-0 z-10 h-full w-2 cursor-col-resize',
        edge === 'right' ? 'right-0' : 'left-0'
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-0 w-0.5 rounded-full transition-opacity duration-150 motion-reduce:transition-none',
          edge === 'right' ? 'right-0' : 'left-0',
          dragging ? 'bg-foreground/60' : 'bg-foreground/40',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          height: RESIZE_HANDLE_PILL_HEIGHT,
          transform: `translateY(${pillTop}px)`
        }}
      />
    </div>
  )
}
