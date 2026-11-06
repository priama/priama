import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import type { TreeNode } from '@shared/types'

/**
 * The shared shape of a v2 entry panel: a filled field reads as a line of text,
 * an empty one is a chip you click to add. Nothing is ever an empty box.
 */

/** Wraps a field while it is being edited: focuses it, and closes when focus leaves. */
export function EditShell({
  onDone,
  children
}: {
  onDone: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const ref = useRef<HTMLFieldSetElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector('input, textarea, select') as HTMLElement | null
    el?.focus()
  }, [])
  return (
    <fieldset
      ref={ref}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDone()
      }}
    >
      {children}
    </fieldset>
  )
}

function PanelSection({
  title,
  children
}: {
  title?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-1.5">
      {title && (
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

/** Short value: label left, value right. */
export function ValueRow({
  label,
  value,
  onEdit
}: {
  label: string
  value: string
  onEdit: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full min-w-0 items-baseline gap-3 rounded-md px-1 py-1 text-left hover:bg-accent/40"
    >
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-sm">{value}</span>
    </button>
  )
}

/** Long value: label above, the writing below. */
export function ProseRow({
  label,
  value,
  onEdit
}: {
  label: string
  value: string
  onEdit: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full rounded-md px-1 py-0.5 text-left hover:bg-accent/40"
    >
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="mt-0.5 block whitespace-pre-wrap text-sm leading-relaxed">{value}</span>
    </button>
  )
}

/** An empty field — one click away, never an empty box. */
function AddChip({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
    >
      + {label}
    </button>
  )
}

function ChipRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-wrap gap-1.5 pt-0.5">{children}</div>
}

function initials(title: string): string {
  return title.slice(0, 2).toUpperCase()
}

/** Read-only list of linked entries: initial, name. */
export function LinkList({
  label,
  ids,
  onEdit
}: {
  label: string
  ids: string[]
  onEdit: () => void
}): React.JSX.Element {
  const nodes = useAppStore((s) => s.nodes)
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full rounded-md px-1 py-0.5 text-left hover:bg-accent/40"
    >
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="mt-0.5 block">
        {ids.map((id) => {
          const node = nodes.find((n) => n.id === id)
          if (!node) return null
          return (
            <span key={id} className="flex min-w-0 items-center gap-2 py-0.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-semibold">
                {initials(node.title)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{node.title}</span>
            </span>
          )
        })}
      </span>
    </button>
  )
}

/** The editor behind LinkList — pick from every node of the given types. */
export function LinkEditor({
  label,
  ids,
  types,
  onChange
}: {
  label: string
  ids: string[]
  types: TreeNode['type'][]
  onChange: (next: string[]) => void
}): React.JSX.Element {
  const nodes = useAppStore((s) => s.nodes)
  const candidates = nodes.filter((n) => !n.deletedAt && types.includes(n.type))
  const unlinked = candidates.filter((n) => !ids.includes(n.id))

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {ids.map((id) => {
        const node = nodes.find((n) => n.id === id)
        if (!node) return null
        return (
          <div key={id} className="flex min-w-0 items-center gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-semibold">
              {initials(node.title)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{node.title}</span>
            <button
              type="button"
              aria-label={`Unlink ${node.title}`}
              onClick={() => onChange(ids.filter((v) => v !== id))}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
      {unlinked.length > 0 ? (
        <select
          value=""
          aria-label={`Add to ${label}`}
          onChange={(e) => {
            if (e.target.value) onChange([...ids, e.target.value])
          }}
          className={cn(
            'h-8 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none'
          )}
        >
          <option value="">+ Add link…</option>
          {unlinked.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs italic text-muted-foreground/60">Nothing left to link.</p>
      )}
    </div>
  )
}

/** Short list of words: label above, chips below. */
export function TagsRow({
  label,
  values,
  onEdit
}: {
  label: string
  values: string[]
  onEdit: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full rounded-md px-1 py-0.5 text-left hover:bg-accent/40"
    >
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="mt-1 flex flex-wrap gap-1">
        {values.map((v) => (
          <span key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {v}
          </span>
        ))}
      </span>
    </button>
  )
}

/** One field of a fixed panel: how it reads when filled, what it becomes when edited. */
export interface PanelField {
  id: string
  label: string
  filled: boolean
  display: React.ReactNode
  editor: React.ReactNode
}

export function FixedFields({
  title,
  fields,
  editing,
  setEditing,
  onDone
}: {
  title?: string
  fields: PanelField[]
  editing: string | null
  setEditing: (id: string | null) => void
  onDone: () => void
}): React.JSX.Element | null {
  if (fields.length === 0) return null
  const chips = fields.filter((f) => !f.filled && f.id !== editing)
  return (
    <PanelSection title={title}>
      {fields.map((f) =>
        f.id === editing ? (
          <EditShell key={f.id} onDone={onDone}>
            {f.editor}
          </EditShell>
        ) : f.filled ? (
          <div key={f.id}>{f.display}</div>
        ) : null
      )}
      {chips.length > 0 && (
        <ChipRow>
          {chips.map((f) => (
            <AddChip key={f.id} label={f.label} onClick={() => setEditing(f.id)} />
          ))}
        </ChipRow>
      )}
    </PanelSection>
  )
}

/** The title, once, at the top of the panel. */
export const PANEL_TITLE_CLASS =
  'h-auto border-0 bg-transparent px-0 text-lg font-semibold leading-snug shadow-none focus-visible:ring-0'
