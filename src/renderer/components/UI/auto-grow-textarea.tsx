import * as React from 'react'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { Textarea } from '@/components/UI/textarea'
import { cn } from '@/lib/utils'

const GROW_CAP = 3.5

/** Pure baseline height from rows + box metrics (content-independent). */
export function computeRowsBaselineHeight(metrics: {
  lineHeightPx: number
  rows: number
  paddingTop: number
  paddingBottom: number
  borderTop: number
  borderBottom: number
}): number {
  const line = Number.isFinite(metrics.lineHeightPx) && metrics.lineHeightPx > 0
    ? metrics.lineHeightPx
    : 20
  const rows = Math.max(1, metrics.rows)
  return (
    line * rows +
    metrics.paddingTop +
    metrics.paddingBottom +
    metrics.borderTop +
    metrics.borderBottom
  )
}

function readRowsBaseline(el: HTMLTextAreaElement, rows: number): number {
  const cs = getComputedStyle(el)
  const parsedLine = parseFloat(cs.lineHeight)
  const lineHeightPx = Number.isFinite(parsedLine) && parsedLine > 0
    ? parsedLine
    : parseFloat(cs.fontSize) * 1.5

  return computeRowsBaselineHeight({
    lineHeightPx,
    rows: el.rows || rows,
    paddingTop: parseFloat(cs.paddingTop) || 0,
    paddingBottom: parseFloat(cs.paddingBottom) || 0,
    borderTop: parseFloat(cs.borderTopWidth) || 0,
    borderBottom: parseFloat(cs.borderBottomWidth) || 0
  })
}

export const AutoGrowTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { rows?: number; measureKey?: string }
>(({ className, rows = 3, value, onChange, measureKey, ...props }, ref) => {
  const innerRef = useRef<HTMLTextAreaElement>(null)
  const minHeightRef = useRef<number | null>(null)

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  const adjustHeight = useCallback(
    (el?: HTMLTextAreaElement | null) => {
      const target = el ?? innerRef.current
      if (!target) return

      if (minHeightRef.current === null) {
        target.style.height = ''
        target.style.minHeight = ''
        target.style.maxHeight = ''
        target.style.overflowY = ''
        minHeightRef.current = readRowsBaseline(target, rows)
      }

      const minH = minHeightRef.current
      const maxH = minH * GROW_CAP

      target.style.minHeight = `${minH}px`
      target.style.maxHeight = `${maxH}px`
      target.style.height = '0'
      target.style.overflowY = 'hidden'
      const contentHeight = target.scrollHeight
      const next = Math.min(Math.max(contentHeight, minH), maxH)
      target.style.height = `${next}px`
      target.style.overflowY = contentHeight > maxH ? 'auto' : 'hidden'
    },
    [rows]
  )

  useLayoutEffect(() => {
    minHeightRef.current = null
    adjustHeight()
  }, [measureKey, rows, adjustHeight])

  useLayoutEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    let lastWidth = el.clientWidth
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth
      if (width === lastWidth) return
      lastWidth = width
      minHeightRef.current = null
      adjustHeight(el)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [adjustHeight, measureKey])

  return (
    <Textarea
      ref={setRefs}
      rows={rows}
      value={value}
      onChange={(e) => {
        onChange?.(e)
        adjustHeight(e.currentTarget)
      }}
      className={cn('panel-textarea-scroll min-h-0 resize-none', className)}
      {...props}
    />
  )
})
AutoGrowTextarea.displayName = 'AutoGrowTextarea'
