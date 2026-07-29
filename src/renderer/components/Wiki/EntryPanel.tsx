import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { useAppStore } from '@/store/appStore'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { usePendingPanelRename } from '@/hooks/usePendingPanelRename'
import type {
  CategoryDefinition,
  PanelBlock,
  PanelBlockRelationships,
  PanelBlockStatus,
  PanelBlockTags,
  PanelBlockText,
  PanelBlockTextarea
} from '@shared/types'

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

function RelationshipsBlock({
  block,
  value,
  onChange
}: {
  block: PanelBlockRelationships
  value: string[]
  onChange: (v: string[]) => void
}): React.JSX.Element {
  const nodes = useAppStore((s) => s.nodes)
  const categories = useAppStore((s) => s.categories)

  const candidates = nodes.filter((n) => {
    if (n.deletedAt) return false
    if (n.type !== 'entry') return false
    if (!block.allowedCategoryIds || block.allowedCategoryIds.length === 0) return true
    return n.categoryId ? block.allowedCategoryIds.includes(n.categoryId) : false
  })

  const linked = value
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as typeof nodes

  const unlinked = candidates.filter((n) => !value.includes(n.id))

  const addLink = (id: string): void => {
    if (!value.includes(id)) onChange([...value, id])
  }

  const removeLink = (id: string): void => {
    onChange(value.filter((v) => v !== id))
  }

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return ''
    return categories.find((c) => c.id === categoryId)?.name ?? ''
  }

  return (
    <Field label={block.label}>
      <div className="space-y-1.5">
        {linked.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {linked.map((n) => (
              <span
                key={n.id}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
              >
                {n.title}
                <button
                  type="button"
                  onClick={() => removeLink(n.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {unlinked.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addLink(e.target.value)
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">+ Add link…</option>
            {unlinked.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
                {getCategoryName(n.categoryId) ? ` (${getCategoryName(n.categoryId)})` : ''}
              </option>
            ))}
          </select>
        )}

        {candidates.length === 0 && (
          <p className="text-xs italic text-muted-foreground/60">No entries to link yet.</p>
        )}
      </div>
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

export function EntryPanel({
  nodeId,
  title,
  metadata,
  category,
  onUpdate
}: EntryPanelProps): React.JSX.Element {
  const { inputRef: nameRef, handleFocus, handleBlur, handleKeyDown } =
    usePendingPanelRename(nodeId)
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata: parseEntryMeta(metadata),
    metadataSource: metadata,
    nameInputRef: nameRef
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

  const blocks = category.panelBlocks ?? []

  return (
    <div className="space-y-4">
      <Field label="Name">
        <SpellCheckedInput
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={(e) => handleKeyDown(e, () => save(undefined, name))}
          onBlur={() => {
            handleBlur()
            save(undefined, name)
          }}
        />
      </Field>

      {blocks.map((block: PanelBlock) => {
        switch (block.type) {
          case 'text':
            return (
              <TextBlock
                key={block.id}
                block={block}
                value={getStringValue(meta, block.id)}
                onChange={(v) => setMeta({ ...meta, [block.id]: v })}
                onBlur={() => save()}
              />
            )
          case 'textarea':
            return (
              <TextareaBlock
                key={block.id}
                block={block}
                measureKey={nodeId}
                value={getStringValue(meta, block.id)}
                onChange={(v) => setMeta({ ...meta, [block.id]: v })}
                onBlur={() => save()}
              />
            )
          case 'status':
            return (
              <StatusBlock
                key={block.id}
                block={block}
                value={getStringValue(meta, block.id)}
                onChange={(v) => updateField(block.id, v)}
              />
            )
          case 'tags':
            return (
              <TagsBlock
                key={block.id}
                block={block as PanelBlockTags}
                value={getArrayValue(meta, block.id)}
                onChange={(v) => setMeta({ ...meta, [block.id]: v })}
                onBlur={() => save()}
              />
            )
          case 'relationships':
            return (
              <RelationshipsBlock
                key={block.id}
                block={block as PanelBlockRelationships}
                value={getArrayValue(meta, block.id)}
                onChange={(v) => updateField(block.id, v)}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
