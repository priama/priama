import * as React from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Input } from '@/components/UI/input'
import { AutoGrowTextarea } from '@/components/UI/auto-grow-textarea'
import { SpellSuggestions } from '@/components/Editor/SpellSuggestions'
import { useSpellCheckField } from '@/hooks/useSpellCheckField'
import type { SpellMatch } from '@/lib/spellCheck'
import { cn } from '@/lib/utils'

function buildMirrorContent(text: string, matches: SpellMatch[]): React.ReactNode {
  if (!text) return ' '

  if (matches.length === 0) return text

  const sorted = [...matches].sort((a, b) => a.from - b.from)
  const nodes: React.ReactNode[] = []
  let cursor = 0

  for (const match of sorted) {
    if (match.from > cursor) {
      nodes.push(text.slice(cursor, match.from))
    }
    nodes.push(
      <span key={`${match.from}-${match.to}`} className="spell-error-mirror">
        {text.slice(match.from, match.to)}
      </span>
    )
    cursor = match.to
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes
}

/** Layout metrics copied from the real field so underlines track glyph positions. */
interface FieldMirrorMetrics {
  top: number
  left: number
  width: number
  height: number
  paddingTop: string
  paddingRight: string
  paddingBottom: string
  paddingLeft: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  fontStyle: string
  lineHeight: string
  letterSpacing: string
  wordSpacing: string
  textTransform: string
  textAlign: string
}

function readFieldMirrorMetrics(el: HTMLElement): FieldMirrorMetrics {
  const cs = getComputedStyle(el)
  return {
    top: el.clientTop,
    left: el.clientLeft,
    width: el.clientWidth,
    height: el.clientHeight,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    wordSpacing: cs.wordSpacing,
    textTransform: cs.textTransform,
    textAlign: cs.textAlign
  }
}

function metricsEqual(a: FieldMirrorMetrics | null, b: FieldMirrorMetrics): boolean {
  if (!a) return false
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height &&
    a.paddingTop === b.paddingTop &&
    a.paddingRight === b.paddingRight &&
    a.paddingBottom === b.paddingBottom &&
    a.paddingLeft === b.paddingLeft &&
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.fontStyle === b.fontStyle &&
    a.lineHeight === b.lineHeight &&
    a.letterSpacing === b.letterSpacing &&
    a.wordSpacing === b.wordSpacing &&
    a.textTransform === b.textTransform &&
    a.textAlign === b.textAlign
  )
}

function useFieldMirrorMetrics(
  fieldRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  /** Structural changes that affect typography or box size (not every keystroke). */
  layoutKey: string,
  /** Content changes that may resize an auto-growing field. */
  contentKey: string
): FieldMirrorMetrics | null {
  const [metrics, setMetrics] = useState<FieldMirrorMetrics | null>(null)

  useLayoutEffect(() => {
    if (!enabled) {
      setMetrics(null)
      return
    }

    const el = fieldRef.current
    if (!el) return

    const sync = (): void => {
      const next = readFieldMirrorMetrics(el)
      setMetrics((prev) => (metricsEqual(prev, next) ? prev : next))
    }

    sync()

    const observer = new ResizeObserver(sync)
    observer.observe(el)
    window.addEventListener('resize', sync)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [enabled, fieldRef, layoutKey])

  useLayoutEffect(() => {
    if (!enabled) return
    const el = fieldRef.current
    if (!el) return
    const next = readFieldMirrorMetrics(el)
    setMetrics((prev) => (metricsEqual(prev, next) ? prev : next))
  }, [enabled, fieldRef, contentKey])

  return metrics
}

interface SpellMirrorProps {
  text: string
  matches: SpellMatch[]
  multiline?: boolean
  scrollLeft?: number
  scrollTop?: number
  metrics: FieldMirrorMetrics | null
}

function SpellMirror({
  text,
  matches,
  multiline,
  scrollLeft = 0,
  scrollTop = 0,
  metrics
}: SpellMirrorProps): React.JSX.Element | null {
  if (!metrics) return null

  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      aria-hidden
      style={{
        top: metrics.top,
        left: metrics.left,
        width: metrics.width,
        height: metrics.height,
        paddingTop: metrics.paddingTop,
        paddingRight: metrics.paddingRight,
        paddingBottom: metrics.paddingBottom,
        paddingLeft: metrics.paddingLeft,
        boxSizing: 'border-box'
      }}
    >
      <div
        className={cn(
          'text-transparent',
          multiline ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
        )}
        style={{
          transform:
            scrollLeft || scrollTop
              ? `translate(${scrollLeft ? -scrollLeft : 0}px, ${scrollTop ? -scrollTop : 0}px)`
              : undefined,
          fontFamily: metrics.fontFamily,
          fontSize: metrics.fontSize,
          fontWeight: metrics.fontWeight,
          fontStyle: metrics.fontStyle,
          lineHeight: metrics.lineHeight,
          letterSpacing: metrics.letterSpacing,
          wordSpacing: metrics.wordSpacing,
          textTransform: metrics.textTransform as React.CSSProperties['textTransform'],
          textAlign: metrics.textAlign as React.CSSProperties['textAlign']
        }}
      >
        {buildMirrorContent(text, matches)}
      </div>
    </div>
  )
}

type SpellCheckedInputProps = React.ComponentProps<typeof Input> & {
  spellCheckEnabled?: boolean
}

export const SpellCheckedInput = React.forwardRef<HTMLInputElement, SpellCheckedInputProps>(
  (
    {
      className,
      value = '',
      onChange,
      onFocus,
      onBlur,
      onContextMenu,
      onScroll,
      spellCheckEnabled = true,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLInputElement>(null)
    const text = String(value ?? '')
    const [mirrorScrollLeft, setMirrorScrollLeft] = useState(0)
    const metrics = useFieldMirrorMetrics(
      innerRef,
      spellCheckEnabled,
      className ?? '',
      text
    )

    const {
      matches,
      menu,
      closeMenu,
      onFocus: spellFocus,
      onBlur: spellBlur,
      markDirty,
      handleContextMenu,
      applySuggestion,
      addToDictionary
    } = useSpellCheckField(text, { enabled: spellCheckEnabled })

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref]
    )

    useLayoutEffect(() => {
      const el = innerRef.current
      if (!el || !spellCheckEnabled) return

      const update = (): void => setMirrorScrollLeft(el.scrollLeft)
      update()
      el.addEventListener('scroll', update)
      el.addEventListener('input', update)
      return () => {
        el.removeEventListener('scroll', update)
        el.removeEventListener('input', update)
      }
    }, [text, spellCheckEnabled])

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>): void => {
      spellFocus()
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
      spellBlur()
      onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
      markDirty()
      onChange?.(e)
    }

    const handleScroll = (e: React.UIEvent<HTMLInputElement>): void => {
      setMirrorScrollLeft(e.currentTarget.scrollLeft)
      onScroll?.(e)
    }

    const handleCtx = (e: React.MouseEvent<HTMLInputElement>): void => {
      if (innerRef.current) handleContextMenu(e, innerRef.current)
      onContextMenu?.(e)
    }

    const handleSelectSuggestion = (replacement: string): void => {
      const next = applySuggestion(replacement)
      if (next === null) return
      onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLInputElement>)
      innerRef.current?.focus()
    }

    return (
      <>
        <div className="relative">
          {spellCheckEnabled && (
            <SpellMirror
              text={text}
              matches={matches}
              scrollLeft={mirrorScrollLeft}
              metrics={metrics}
            />
          )}
          <Input
            ref={setRefs}
            value={value}
            spellCheck={false}
            className={cn('relative z-[1] bg-transparent', className)}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onContextMenu={handleCtx}
            onScroll={handleScroll}
            {...props}
          />
        </div>
        {menu && spellCheckEnabled && (
          <SpellSuggestions
            x={menu.x}
            y={menu.y}
            word={menu.match.word}
            suggestions={menu.match.suggestions}
            message={menu.match.message}
            onSelect={handleSelectSuggestion}
            onAddToDictionary={addToDictionary}
            onClose={closeMenu}
          />
        )}
      </>
    )
  }
)
SpellCheckedInput.displayName = 'SpellCheckedInput'

type SpellCheckedTextareaProps = React.ComponentProps<typeof AutoGrowTextarea> & {
  spellCheckEnabled?: boolean
}

export const SpellCheckedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  SpellCheckedTextareaProps
>(
  (
    {
      className,
      value = '',
      onChange,
      onFocus,
      onBlur,
      onContextMenu,
      spellCheckEnabled = true,
      rows,
      measureKey,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLTextAreaElement>(null)
    const text = String(value ?? '')
    const [mirrorScrollTop, setMirrorScrollTop] = useState(0)
    const metrics = useFieldMirrorMetrics(
      innerRef,
      spellCheckEnabled,
      `${className ?? ''}\0${measureKey ?? ''}\0${rows ?? ''}`,
      text
    )

    const {
      matches,
      menu,
      closeMenu,
      onFocus: spellFocus,
      onBlur: spellBlur,
      markDirty,
      handleContextMenu,
      applySuggestion,
      addToDictionary
    } = useSpellCheckField(text, { enabled: spellCheckEnabled })

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref]
    )

    useLayoutEffect(() => {
      const el = innerRef.current
      if (!el || !spellCheckEnabled) return

      const update = (): void => setMirrorScrollTop(el.scrollTop)
      update()
      el.addEventListener('scroll', update)
      return () => {
        el.removeEventListener('scroll', update)
      }
    }, [text, spellCheckEnabled])

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>): void => {
      spellFocus()
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>): void => {
      spellBlur()
      onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      markDirty()
      onChange?.(e)
    }

    const handleCtx = (e: React.MouseEvent<HTMLTextAreaElement>): void => {
      if (innerRef.current) handleContextMenu(e, innerRef.current)
      onContextMenu?.(e)
    }

    const handleSelectSuggestion = (replacement: string): void => {
      const next = applySuggestion(replacement)
      if (next === null) return
      onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLTextAreaElement>)
      innerRef.current?.focus()
    }

    return (
      <>
        <div className="relative">
          {spellCheckEnabled && (
            <SpellMirror
              text={text}
              matches={matches}
              multiline
              scrollTop={mirrorScrollTop}
              metrics={metrics}
            />
          )}
          <AutoGrowTextarea
            ref={setRefs}
            value={value}
            rows={rows}
            measureKey={measureKey}
            spellCheck={false}
            className={cn('relative z-[1] bg-transparent', className)}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onContextMenu={handleCtx}
            {...props}
          />
        </div>
        {menu && spellCheckEnabled && (
          <SpellSuggestions
            x={menu.x}
            y={menu.y}
            word={menu.match.word}
            suggestions={menu.match.suggestions}
            message={menu.match.message}
            onSelect={handleSelectSuggestion}
            onAddToDictionary={addToDictionary}
            onClose={closeMenu}
          />
        )}
      </>
    )
  }
)
SpellCheckedTextarea.displayName = 'SpellCheckedTextarea'
