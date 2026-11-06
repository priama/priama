import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { useAppStore } from '@/store/appStore'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { PanelNameField } from '@/components/Wiki/PanelNameField'
import { EntityImageBanner } from '@/components/Wiki/EntityImageBanner'
import { resolveCategoryForNode } from '@shared/categoryNodeKind'
import { DEFAULT_IMAGE_FOCUS } from '@shared/types'
import type {
  CategoryDefinition,
  ImageFocus,
  PanelBlock,
  PanelBlockDate,
  PanelBlockNumber,
  PanelBlockRelationships,
  PanelBlockStatus,
  PanelBlockTags,
  PanelBlockText,
  PanelBlockTextarea,
  PanelBlockUrl,
  PanelLinkValue
} from '@shared/types'

const FIELD_INPUT =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring'

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function TextBlock({
  block,
  value,
  onChange,
  onBlur
}: {
  block: PanelBlockText
  value: string
  onChange: (v: string) => void
  onBlur: () => void
}): React.JSX.Element {
  return (
    <Field label={block.label}>
      <SpellCheckedInput
        value={value}
        placeholder={block.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </Field>
  )
}

function TextareaBlock({
  block,
  measureKey,
  value,
  onChange,
  onBlur
}: {
  block: PanelBlockTextarea
  measureKey: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
}): React.JSX.Element {
  return (
    <Field label={block.label}>
      <SpellCheckedTextarea
        measureKey={`${measureKey}-${block.id}`}
        value={value}
        placeholder={block.placeholder}
        rows={block.rows ?? 3}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </Field>
  )
}

function StatusBlock({
  block,
  value,
  onChange
}: {
  block: PanelBlockStatus
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <Field label={block.label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— none —</option>
        {block.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </Field>
  )
}

function TagsBlock({
  block,
  value,
  onChange,
  onBlur
}: {
  block: PanelBlockTags
  value: string[]
  onChange: (v: string[]) => void
  onBlur: () => void
}): React.JSX.Element {
  const [raw, setRaw] = useState(value.join(', '))

  useEffect(() => {
    setRaw(value.join(', '))
  }, [value])

  const commit = (): void => {
    const next = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onChange(next)
    onBlur()
  }

  return (
    <Field label={block.label}>
      <SpellCheckedInput
        value={raw}
        placeholder={block.placeholder ?? 'separate with ,'}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
      />
    </Field>
  )
}

/**
 * Three shapes reach this: a bare id, {id, note}, and the typed relationships the
 * hand-written panels have always written — {characterId, type} and {personId, type}.
 * Reading only the first two would make every Character and People relationship
 * vanish the moment those categories are drawn from their field list.
 */
function normalizeLinks(raw: unknown): PanelLinkValue[] {
  if (!Array.isArray(raw)) return []
  const out: PanelLinkValue[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      out.push({ id: item })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const id =
      typeof rec.id === 'string'
        ? rec.id
        : typeof rec.characterId === 'string'
          ? rec.characterId
          : typeof rec.personId === 'string'
            ? rec.personId
            : null
    if (!id) continue
    const note = typeof rec.note === 'string' ? rec.note : typeof rec.type === 'string' ? rec.type : undefined
    out.push(note ? { id, note } : { id })
  }
  return out
}

function RelationshipsBlock({
  block,
  value,
  onChange
}: {
  block: PanelBlockRelationships
  value: PanelLinkValue[]
  onChange: (v: PanelLinkValue[]) => void
}): React.JSX.Element {
  const nodes = useAppStore((s) => s.nodes)
  const categories = useAppStore((s) => s.categories)

  const allowed = block.allowedCategoryIds ?? []

  // Every wiki node can be linked to, not only entries — a Faction's leader is a Character.
  const candidates = nodes.filter((n) => {
    if (n.deletedAt) return false
    const categoryId = resolveCategoryForNode(n)
    if (!categoryId) return false
    return allowed.length === 0 || allowed.includes(categoryId)
  })

  const linkedIds = new Set(value.map((v) => v.id))
  const unlinked = candidates.filter((n) => !linkedIds.has(n.id))

  const addLink = (id: string): void => {
    if (!linkedIds.has(id)) onChange([...value, { id }])
  }

  const removeLink = (id: string): void => {
    onChange(value.filter((v) => v.id !== id))
  }

  const setNote = (id: string, note: string): void => {
    onChange(value.map((v) => (v.id === id ? { ...v, note } : v)))
  }

  const categoryNameOf = (nodeId: string): string => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return ''
    const categoryId = resolveCategoryForNode(node)
    return categories.find((c) => c.id === categoryId)?.name ?? ''
  }

  return (
    <Field label={block.label}>
      <div className="space-y-1.5">
        {value.map((link) => {
          const node = nodes.find((n) => n.id === link.id)
          if (!node) return null
          return (
            <div key={link.id} className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{node.title}</span>
              {block.allowNote && (
                <input
                  type="text"
                  value={link.note ?? ''}
                  placeholder="—"
                  aria-label={`A word on ${node.title}`}
                  onChange={(e) => setNote(link.id, e.target.value)}
                  className="h-7 w-24 shrink-0 rounded-md border border-input bg-background px-2 text-xs shadow-sm outline-none"
                />
              )}
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {categoryNameOf(link.id)}
              </span>
              <button
                type="button"
                onClick={() => removeLink(link.id)}
                aria-label={`Unlink ${node.title}`}
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
            aria-label={`Add to ${block.label}`}
            onChange={(e) => {
              if (e.target.value) addLink(e.target.value)
            }}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none"
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
    </Field>
  )
}

function NumberBlock({
  block,
  value,
  onChange,
  onBlur
}: {
  block: PanelBlockNumber
  value: string
  onChange: (v: string) => void
  onBlur: () => void
}): React.JSX.Element {
  return (
    <Field label={block.label}>
      <input
        type="number"
        value={value}
        placeholder={block.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={FIELD_INPUT}
      />
    </Field>
  )
}

function DateBlock({
  block,
  value,
  onChange
}: {
  block: PanelBlockDate
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <Field label={block.label}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_INPUT}
      />
    </Field>
  )
}

function UrlBlock({
  block,
  value,
  onChange,
  onBlur
}: {
  block: PanelBlockUrl
  value: string
  onChange: (v: string) => void
  onBlur: () => void
}): React.JSX.Element {
  return (
    <Field label={block.label}>
      <input
        type="url"
        value={value}
        placeholder={block.placeholder ?? 'https://'}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={FIELD_INPUT}
      />
    </Field>
  )
}

interface EntryPanelProps {
  nodeId: string
  title: string
  metadata: string
  category: CategoryDefinition
  onUpdate: (updates: { title?: string; metadata?: string }) => void
}

type MetaRecord = Record<string, unknown>

function parseEntryMeta(raw: string): MetaRecord {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as MetaRecord) : {}
  } catch {
    return {}
  }
}

function getStringValue(meta: MetaRecord, key: string): string {
  const v = meta[key]
  return typeof v === 'string' ? v : ''
}

function getArrayValue(meta: MetaRecord, key: string): string[] {
  const v = meta[key]
  return Array.isArray(v) ? (v as string[]) : []
}

/** Wraps a field while it is being edited: focuses it, and closes when focus leaves. */
function EditShell({
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

export function EntryPanel({
  nodeId,
  title,
  metadata,
  category,
  onUpdate
}: EntryPanelProps): React.JSX.Element {
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata: parseEntryMeta(metadata),
    metadataSource: metadata
  })

  const save = useCallback(
    (nextMeta?: MetaRecord, nextName?: string) => {
      const updates: { title?: string; metadata?: string } = {}
      const finalName = nextName ?? name
      if (finalName !== title) updates.title = finalName
      const finalMeta = nextMeta ?? meta
      updates.metadata = JSON.stringify(finalMeta)
      if (Object.keys(updates).length > 0) onUpdate(updates)
    },
    [meta, name, title, onUpdate]
  )

  const updateField = (key: string, value: unknown): void => {
    const next = { ...meta, [key]: value }
    setMeta(next)
    save(next)
  }

  /** Images write three fixed keys at once, not one keyed by block id. */
  const updateFields = (patch: MetaRecord): void => {
    const next = { ...meta, ...patch }
    setMeta(next)
    save(next)
  }

  const allNodes = useAppStore((s) => s.nodes)
  const allCategories = useAppStore((s) => s.categories)
  const [editingId, setEditingId] = useState<string | null>(null)

  const blocks = category.panelBlocks ?? []
  const imagesBlock = blocks.find((b) => b.type === 'images')
  const fieldBlocks = blocks.filter((b) => b.type !== 'images')

  /** A heading cuts the list; whatever comes before the first one is the opening section. */
  const sections: { id: string; title: string | null; blocks: PanelBlock[] }[] = []
  let current: { id: string; title: string | null; blocks: PanelBlock[] } = {
    id: '__opening',
    title: null,
    blocks: []
  }
  for (const block of fieldBlocks) {
    if (block.type === 'heading') {
      if (current.blocks.length > 0 || current.title) sections.push(current)
      current = { id: block.id, title: block.label, blocks: [] }
    } else {
      current.blocks.push(block)
    }
  }
  sections.push(current)

  const hasValue = (block: PanelBlock): boolean => {
    switch (block.type) {
      case 'tags':
        return getArrayValue(meta, block.id).length > 0
      case 'relationships':
        return normalizeLinks(meta[block.id]).length > 0
      default:
        return getStringValue(meta, block.id).trim().length > 0
    }
  }

  const stopEditing = (): void => {
    save()
    setEditingId(null)
  }

  /** The editors are unchanged — a field in edit mode is exactly what it always was. */
  const editorFor = (block: PanelBlock): React.ReactNode => {
    switch (block.type) {
      case 'text':
        return (
          <TextBlock
            block={block as PanelBlockText}
            value={getStringValue(meta, block.id)}
            onChange={(v) => setMeta({ ...meta, [block.id]: v })}
            onBlur={() => save()}
          />
        )
      case 'textarea':
        return (
          <TextareaBlock
            block={block as PanelBlockTextarea}
            measureKey={nodeId}
            value={getStringValue(meta, block.id)}
            onChange={(v) => setMeta({ ...meta, [block.id]: v })}
            onBlur={() => save()}
          />
        )
      case 'status':
        return (
          <StatusBlock
            block={block as PanelBlockStatus}
            value={getStringValue(meta, block.id)}
            onChange={(v) => updateField(block.id, v)}
          />
        )
      case 'tags':
        return (
          <TagsBlock
            block={block as PanelBlockTags}
            value={getArrayValue(meta, block.id)}
            onChange={(v) => setMeta({ ...meta, [block.id]: v })}
            onBlur={() => save()}
          />
        )
      case 'relationships':
        return (
          <RelationshipsBlock
            block={block as PanelBlockRelationships}
            value={normalizeLinks(meta[block.id])}
            onChange={(v) => updateField(block.id, v)}
          />
        )
      case 'number':
        return (
          <NumberBlock
            block={block as PanelBlockNumber}
            value={getStringValue(meta, block.id)}
            onChange={(v) => setMeta({ ...meta, [block.id]: v })}
            onBlur={() => save()}
          />
        )
      case 'date':
        return (
          <DateBlock
            block={block as PanelBlockDate}
            value={getStringValue(meta, block.id)}
            onChange={(v) => updateField(block.id, v)}
          />
        )
      case 'url':
        return (
          <UrlBlock
            block={block as PanelBlockUrl}
            value={getStringValue(meta, block.id)}
            onChange={(v) => setMeta({ ...meta, [block.id]: v })}
            onBlur={() => save()}
          />
        )
      default:
        return null
    }
  }

  const displayFor = (block: PanelBlock): React.ReactNode => {
    const open = (): void => setEditingId(block.id)

    if (block.type === 'textarea') {
      return (
        <button
          key={block.id}
          type="button"
          onClick={open}
          className="w-full rounded-md px-1 py-0.5 text-left hover:bg-accent/40"
        >
          <span className="block text-xs font-medium text-muted-foreground">{block.label}</span>
          <span className="mt-0.5 block whitespace-pre-wrap text-sm leading-relaxed">
            {getStringValue(meta, block.id)}
          </span>
        </button>
      )
    }

    if (block.type === 'tags') {
      return (
        <button
          key={block.id}
          type="button"
          onClick={open}
          className="w-full rounded-md px-1 py-0.5 text-left hover:bg-accent/40"
        >
          <span className="block text-xs font-medium text-muted-foreground">{block.label}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {getArrayValue(meta, block.id).map((t) => (
              <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {t}
              </span>
            ))}
          </span>
        </button>
      )
    }

    if (block.type === 'relationships') {
      const links = normalizeLinks(meta[block.id])
      return (
        <button
          key={block.id}
          type="button"
          onClick={open}
          className="w-full rounded-md px-1 py-0.5 text-left hover:bg-accent/40"
        >
          <span className="block text-xs font-medium text-muted-foreground">{block.label}</span>
          <span className="mt-0.5 block">
            {links.map((link) => {
              const node = allNodes.find((n) => n.id === link.id)
              if (!node) return null
              const categoryId = resolveCategoryForNode(node)
              const categoryName = allCategories.find((c) => c.id === categoryId)?.name ?? ''
              return (
                <span key={link.id} className="flex min-w-0 items-center gap-2 py-0.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-semibold">
                    {node.title.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{node.title}</span>
                  {link.note && (
                    <span className="shrink-0 text-xs text-muted-foreground">{link.note}</span>
                  )}
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {categoryName}
                  </span>
                </span>
              )
            })}
          </span>
        </button>
      )
    }

    // text, number, date, url, status — label left, value right
    const raw = getStringValue(meta, block.id)
    return (
      <button
        key={block.id}
        type="button"
        onClick={open}
        className="flex w-full min-w-0 items-baseline gap-3 rounded-md px-1 py-1 text-left hover:bg-accent/40"
      >
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{block.label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-sm">
          {block.type === 'status' ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{raw}</span>
          ) : (
            raw
          )}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {imagesBlock && (
        <EntityImageBanner
          nodeId={nodeId}
          title={name}
          imagePath={typeof meta.imagePath === 'string' ? meta.imagePath : null}
          secondaryImagePaths={
            Array.isArray(meta.secondaryImagePaths) ? (meta.secondaryImagePaths as string[]) : []
          }
          imageFocus={
            meta.imageFocus && typeof meta.imageFocus === 'object'
              ? (meta.imageFocus as ImageFocus)
              : DEFAULT_IMAGE_FOCUS
          }
          entityType="entry"
          onImagesChange={(next) =>
            updateFields({
              imagePath: next.imagePath,
              secondaryImagePaths: next.secondaryImagePaths,
              imageFocus: next.imageFocus
            })
          }
        />
      )}

      {/* The title, once. It used to be a field labelled "Name" under the header. */}
      <PanelNameField
        nodeId={nodeId}
        name={name}
        setName={setName}
        onSave={(n) => save(undefined, n)}
        onSaveMetaOnly={() => onUpdate({ metadata: JSON.stringify(meta) })}
        className="h-auto border-0 bg-transparent px-0 text-lg font-semibold leading-snug shadow-none focus-visible:ring-0"
      />

      {sections.map((section) => {
        const filled = section.blocks.filter(hasValue)
        const blank = section.blocks.filter((b) => !hasValue(b))
        const chips = blank.filter((b) => b.id !== editingId)
        if (section.blocks.length === 0) return null

        return (
          <section key={section.id} className="space-y-1.5">
            {section.title && (
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
            )}

            {filled.map((block) =>
              editingId === block.id ? (
                <EditShell key={block.id} onDone={stopEditing}>
                  {editorFor(block)}
                </EditShell>
              ) : (
                displayFor(block)
              )
            )}

            {blank
              .filter((b) => b.id === editingId)
              .map((block) => (
                <EditShell key={block.id} onDone={stopEditing}>
                  {editorFor(block)}
                </EditShell>
              ))}

            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {chips.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => setEditingId(block.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  >
                    + {block.label}
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
