import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AutoGrowTextarea } from '@/components/UI/auto-grow-textarea'
import { cn } from '@/lib/utils'
import { countNodeWords, isChapterFolder } from '@/lib/treeUtils'
import { useAppStore } from '@/store/appStore'
import {
  formatWordProgress,
  planningMetaFor,
  scenesChapterStats
} from '@shared/manuscriptMeta'
import type { ManuscriptStatus, TreeNode } from '@shared/types'
import {
  COVER_COLORS,
  MANUSCRIPT_STATUSES,
  normalizeChapterMeta,
  normalizeSceneMeta,
  parseMetadata,
  serializeMetadata,
  DEFAULT_CHAPTER_META,
  DEFAULT_SCENE_META
} from '@shared/types'
import type { ChapterMeta, SceneMeta } from '@shared/types'

const STATUS_LABELS: Record<ManuscriptStatus, string> = {
  outline: 'Outline',
  draft: 'Draft',
  revise: 'Revise',
  done: 'Done'
}

const STATUS_CHIP_CLASS: Record<ManuscriptStatus, string> = {
  outline: 'bg-muted text-muted-foreground',
  draft: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  revise: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  done: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
}

export const MAX_SYNOPSIS_LINES = 4

export async function persistPlanningMeta(
  node: TreeNode,
  patch: Partial<ChapterMeta & SceneMeta>
): Promise<void> {
  const { updateNodeInStore, setDirty } = useAppStore.getState()
  let nextMeta: ChapterMeta | SceneMeta
  if (node.type === 'chapter') {
    const current = normalizeChapterMeta(parseMetadata(node.metadata, DEFAULT_CHAPTER_META))
    nextMeta = { ...current, ...patch, structure: current.structure }
  } else {
    const current = normalizeSceneMeta(parseMetadata(node.metadata, DEFAULT_SCENE_META))
    nextMeta = { ...current, ...patch }
  }
  const metadata = serializeMetadata(nextMeta)
  const updated = await window.electronAPI.tree.update(node.id, { metadata })
  updateNodeInStore(node.id, { metadata: updated.metadata })
  setDirty(true)
}

function useClickOutside(open: boolean, onClose: () => void): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handle = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, onClose])
  return ref
}

export function ColorSwatchRow({
  color,
  onChange
}: {
  color: string | null
  onChange: (color: string | null) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        className={cn(
          'h-6 w-6 rounded-full border border-border bg-neutral-300/80 dark:bg-neutral-600/80',
          color === null && 'ring-2 ring-ring ring-offset-1 ring-offset-background'
        )}
        title="Default grey"
        onClick={() => onChange(null)}
      />
      {COVER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={cn(
            'h-6 w-6 rounded-full border border-transparent',
            color === c && 'ring-2 ring-ring ring-offset-1 ring-offset-background'
          )}
          style={{ backgroundColor: c }}
          title={c}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

function ColorPicker({
  color,
  readOnly,
  onChange
}: {
  color: string | null
  readOnly?: boolean
  onChange: (color: string | null) => void
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickOutside(open, close)

  if (readOnly && !color) {
    return (
      <div
        className="pointer-events-none absolute inset-y-[14px] left-0 z-10 w-[3px] rounded-[2px] bg-neutral-300/80 dark:bg-neutral-600/80"
        aria-hidden
      />
    )
  }

  return (
    <div ref={ref} className="absolute inset-y-[14px] left-0 z-10 w-[3px]">
      <button
        type="button"
        className={cn(
          'absolute inset-0 rounded-[2px]',
          !color && 'bg-neutral-300/80 dark:bg-neutral-600/80',
          readOnly && 'pointer-events-none'
        )}
        style={color ? { backgroundColor: color } : undefined}
        disabled={readOnly}
        aria-label="Label color"
        onClick={(e) => {
          e.stopPropagation()
          if (!readOnly) setOpen((v) => !v)
        }}
      />
      {open && (
        <div
          className="absolute left-2 top-0 z-30 rounded-md border border-border bg-popover p-1.5 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <ColorSwatchRow
            color={color}
            onChange={(c) => {
              onChange(c)
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

function StatusChip({
  status,
  readOnly,
  onChange
}: {
  status: ManuscriptStatus | ''
  readOnly?: boolean
  onChange: (status: ManuscriptStatus | '') => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickOutside(open, close)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={readOnly}
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          status ? STATUS_CHIP_CLASS[status] : 'bg-muted text-muted-foreground',
          !readOnly && 'hover:opacity-90'
        )}
        onClick={(e) => {
          e.stopPropagation()
          if (!readOnly) setOpen((v) => !v)
        }}
      >
        {status ? STATUS_LABELS[status] : 'Status'}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[7rem] rounded-md border border-border bg-popover p-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full rounded-sm px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            None
          </button>
          {MANUSCRIPT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                'block w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent',
                status === s && 'bg-accent'
              )}
              onClick={() => {
                onChange(s)
                setOpen(false)
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatWordsLabel(current: number, goal: number | null): string {
  const progress = formatWordProgress(current, goal)
  const unit = current === 1 && goal == null ? 'word' : 'words'
  return `${progress} ${unit}`
}

export function DigitOnlyGoalInput({
  value,
  onChange,
  onCommit,
  onCancel,
  className,
  autoFocus
}: {
  value: string
  onChange: (digits: string) => void
  onCommit: () => void
  onCancel?: () => void
  className?: string
  autoFocus?: boolean
}): React.JSX.Element {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommit()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel?.()
        }
      }}
      className={cn(
        'h-5 w-16 rounded border border-input bg-background px-1 text-xs tabular-nums outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
        className
      )}
      placeholder="goal"
    />
  )
}

function WordGoalControl({
  current,
  goal,
  sceneCount,
  readOnly,
  onChange
}: {
  current: number
  goal: number | null
  sceneCount?: number
  readOnly?: boolean
  onChange: (goal: number | null) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(goal != null ? String(goal) : '')

  const commit = (): void => {
    const trimmed = draft.trim()
    if (!trimmed) {
      onChange(null)
    } else {
      const n = Number.parseInt(trimmed, 10)
      onChange(Number.isFinite(n) && n > 0 ? n : null)
    }
    setEditing(false)
  }

  const prefix =
    sceneCount != null
      ? `${sceneCount} ${sceneCount === 1 ? 'scene' : 'scenes'} · `
      : ''

  if (editing && !readOnly) {
    return (
      <div
        className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {prefix}
        <span className="tabular-nums">{current.toLocaleString()} /</span>
        <DigitOnlyGoalInput
          autoFocus
          value={draft}
          onChange={setDraft}
          onCommit={commit}
          onCancel={() => {
            setDraft(goal != null ? String(goal) : '')
            setEditing(false)
          }}
        />
        <span>words</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={readOnly}
      className={cn(
        'min-w-0 truncate text-left text-xs tabular-nums text-muted-foreground',
        !readOnly && 'hover:text-foreground'
      )}
      onClick={(e) => {
        e.stopPropagation()
        if (readOnly) return
        setDraft(goal != null ? String(goal) : '')
        setEditing(true)
      }}
    >
      {prefix}
      {formatWordsLabel(current, goal)}
    </button>
  )
}

function readTextareaLineMetrics(el: HTMLTextAreaElement): {
  lineHeight: number
  chrome: number
} {
  const cs = getComputedStyle(el)
  const parsedLine = parseFloat(cs.lineHeight)
  const lineHeight =
    Number.isFinite(parsedLine) && parsedLine > 0
      ? parsedLine
      : (parseFloat(cs.fontSize) || 14) * 1.5
  const chrome =
    (parseFloat(cs.paddingTop) || 0) +
    (parseFloat(cs.paddingBottom) || 0) +
    (parseFloat(cs.borderTopWidth) || 0) +
    (parseFloat(cs.borderBottomWidth) || 0)
  return { lineHeight, chrome }
}

export function synopsisFitsInLines(
  el: HTMLTextAreaElement,
  text: string,
  maxLines: number
): boolean {
  const { lineHeight, chrome } = readTextareaLineMetrics(el)
  const maxScroll = lineHeight * maxLines + chrome + 2

  const prevValue = el.value
  const prevHeight = el.style.height
  const prevMaxHeight = el.style.maxHeight
  const prevOverflow = el.style.overflowY
  el.value = text
  el.style.height = '0px'
  el.style.maxHeight = 'none'
  el.style.overflowY = 'hidden'
  const scrollHeight = el.scrollHeight
  el.value = prevValue
  el.style.height = prevHeight
  el.style.maxHeight = prevMaxHeight
  el.style.overflowY = prevOverflow
  return scrollHeight <= maxScroll
}

export function clampSynopsisToLines(
  el: HTMLTextAreaElement,
  text: string,
  maxLines: number
): string {
  if (synopsisFitsInLines(el, text, maxLines)) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (synopsisFitsInLines(el, text.slice(0, mid), maxLines)) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo)
}

function SynopsisField({
  nodeId,
  synopsis,
  readOnly,
  onSave
}: {
  nodeId: string
  synopsis: string
  readOnly?: boolean
  onSave: (synopsis: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(synopsis)
  const revertRef = useRef(synopsis)
  const skipSaveRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const clampedOnOpenRef = useRef(false)

  useEffect(() => {
    if (!editing) {
      setDraft(synopsis)
      revertRef.current = synopsis
      clampedOnOpenRef.current = false
    }
  }, [synopsis, editing])

  useLayoutEffect(() => {
    if (!editing || clampedOnOpenRef.current) return
    const el = textareaRef.current
    if (!el || el.clientWidth <= 0) return
    clampedOnOpenRef.current = true
    const clamped = clampSynopsisToLines(el, draft, MAX_SYNOPSIS_LINES)
    if (clamped !== draft) setDraft(clamped)
  }, [editing, draft])

  const commitSave = (): void => {
    const el = textareaRef.current
    const toSave = el ? clampSynopsisToLines(el, draft, MAX_SYNOPSIS_LINES) : draft
    onSave(toSave)
    setEditing(false)
  }

  if (editing && !readOnly) {
    return (
      <div className="mt-2 flex-1" onClick={(e) => e.stopPropagation()}>
        <AutoGrowTextarea
          ref={textareaRef}
          measureKey={`${nodeId}-synopsis`}
          rows={2}
          growCap={2}
          value={draft}
          autoFocus
          placeholder="Add synopsis"
          className="min-h-0 resize-none overflow-hidden text-sm"
          onChange={(e) => {
            const el = e.currentTarget
            const next = e.target.value
            if (synopsisFitsInLines(el, next, MAX_SYNOPSIS_LINES)) {
              setDraft(next)
              return
            }
            setDraft(clampSynopsisToLines(el, next, MAX_SYNOPSIS_LINES))
          }}
          onBlur={() => {
            if (skipSaveRef.current) {
              skipSaveRef.current = false
              setEditing(false)
              return
            }
            commitSave()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              skipSaveRef.current = true
              setDraft(revertRef.current)
              setEditing(false)
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              commitSave()
            }
          }}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={readOnly}
      className={cn(
        'mt-2 flex-1 text-left text-sm',
        synopsis.trim()
          ? 'text-muted-foreground line-clamp-4'
          : 'text-muted-foreground/70 italic',
        !readOnly && !synopsis.trim() && 'hover:text-foreground'
      )}
      onClick={(e) => {
        if (synopsis.trim()) {
          // Let the card open the chapter/scene; edit via Info panel.
          return
        }
        e.stopPropagation()
        if (!readOnly) setEditing(true)
      }}
    >
      {synopsis.trim() || 'Add synopsis'}
    </button>
  )
}

export function isManuscriptPlanningNode(node: TreeNode): boolean {
  return node.type === 'chapter' || node.type === 'scene'
}

export function ManuscriptCardBody({
  node,
  allNodes,
  readOnly
}: {
  node: TreeNode
  allNodes: TreeNode[]
  readOnly?: boolean
}): React.JSX.Element {
  const meta = planningMetaFor(node)
  const sceneChapter = isChapterFolder(node)
  const stats = sceneChapter
    ? scenesChapterStats(node, allNodes)
    : { sceneCount: undefined as number | undefined, wordCount: countNodeWords(node) }

  const save = useCallback(
    (patch: Partial<ChapterMeta & SceneMeta>) => {
      void persistPlanningMeta(node, patch)
    },
    [node]
  )

  return (
    <>
      <SynopsisField
        nodeId={node.id}
        synopsis={meta.synopsis}
        readOnly={readOnly}
        onSave={(synopsis) => save({ synopsis })}
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <WordGoalControl
          current={stats.wordCount}
          goal={meta.wordGoal}
          sceneCount={stats.sceneCount}
          readOnly={readOnly}
          onChange={(wordGoal) => save({ wordGoal })}
        />
        <StatusChip
          status={meta.status}
          readOnly={readOnly}
          onChange={(status) => save({ status })}
        />
      </div>
    </>
  )
}

export function ManuscriptColorStrip({
  node,
  readOnly
}: {
  node: TreeNode
  readOnly?: boolean
}): React.JSX.Element {
  const meta = planningMetaFor(node)
  return (
    <ColorPicker
      color={meta.color}
      readOnly={readOnly}
      onChange={(color) => void persistPlanningMeta(node, { color })}
    />
  )
}

export function manuscriptStatusLabel(status: ManuscriptStatus | ''): string {
  return status ? STATUS_LABELS[status] : '—'
}

export { STATUS_CHIP_CLASS }
