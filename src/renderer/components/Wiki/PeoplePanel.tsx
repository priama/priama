import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { ComboField } from '@/components/UI/ComboField'
import { Input } from '@/components/UI/input'
import { Button } from '@/components/UI/button'
import { EntityImageBanner } from '@/components/Wiki/EntityImageBanner'
import { useAppStore } from '@/store/appStore'
import { useEntryFieldSuggestions } from '@/hooks/useEntryFieldSuggestions'
import {
  FixedFields,
  PANEL_TITLE_CLASS,
  ProseRow,
  ValueRow,
  type PanelField
} from '@/components/Wiki/PanelKit'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { PanelNameField } from '@/components/Wiki/PanelNameField'
import { cn } from '@/lib/utils'
import {
  DEFAULT_PEOPLE_META,
  NF_PEOPLE_CATEGORY_ID,
  PEOPLE_INTERVIEW_STATUS_OPTIONS,
  PEOPLE_RELATIONSHIP_TYPES,
  type PeopleMeta,
  type PeopleRelationship,
  type PeopleRelationshipType,
  type TreeNode
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

const selectClassName =
  'flex h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

function PeopleSearchSelect({
  value,
  people,
  onChange
}: {
  value: string
  people: TreeNode[]
  onChange: (personId: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = people.find((p) => p.id === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => p.title.toLowerCase().includes(q))
  }, [people, query])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <Input
        value={open ? query : (selected?.title ?? '')}
        placeholder="Select person"
        className="h-8"
        onFocus={() => {
          setOpen(true)
          setQuery(selected?.title ?? '')
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-input bg-popover">
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No people found</p>
          ) : (
            filtered.map((person) => (
              <button
                key={person.id}
                type="button"
                className={cn(
                  'block w-full px-2 py-1.5 text-left text-sm hover:bg-accent',
                  person.id === value && 'bg-accent'
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(person.id)
                  setQuery('')
                  setOpen(false)
                }}
              >
                {person.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function PeoplePanel({
  nodeId,
  title,
  metadata,
  metadataSource,
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: PeopleMeta
  metadataSource: string
  onUpdate: (meta: PeopleMeta, title?: string) => void
}): React.JSX.Element {
  const nodes = useAppStore((s) => s.nodes)
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata,
    metadataSource
  })

  const otherPeople = useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.type === 'entry' &&
          n.categoryId === NF_PEOPLE_CATEGORY_ID &&
          !n.deletedAt &&
          n.id !== nodeId
      ),
    [nodes, nodeId]
  )
  const ethnicitySuggestions = useEntryFieldSuggestions(
    NF_PEOPLE_CATEGORY_ID,
    'ethnicity',
    nodeId,
    DEFAULT_PEOPLE_META
  )
  const genderSuggestions = useEntryFieldSuggestions(
    NF_PEOPLE_CATEGORY_ID,
    'gender',
    nodeId,
    DEFAULT_PEOPLE_META
  )

  const save = useCallback(() => {
    onUpdate(meta, name !== title ? name : undefined)
  }, [meta, name, title, onUpdate])

  const saveMeta = useCallback(
    (next: PeopleMeta) => {
      setMeta(next)
      onUpdate(next, name !== title ? name : undefined)
    },
    [name, title, onUpdate]
  )

  const updateRelationship = (index: number, updates: Partial<PeopleRelationship>): void => {
    const relationships = meta.relationships.map((rel, i) =>
      i === index ? { ...rel, ...updates } : rel
    )
    const next = { ...meta, relationships }
    setMeta(next)
    onUpdate(next, name !== title ? name : undefined)
  }

  const addRelationship = (): void => {
    const next = {
      ...meta,
      relationships: [...meta.relationships, { personId: '', type: 'Unknown' as const }]
    }
    setMeta(next)
    onUpdate(next, name !== title ? name : undefined)
  }

  const removeRelationship = (index: number): void => {
    const next = {
      ...meta,
      relationships: meta.relationships.filter((_, i) => i !== index)
    }
    setMeta(next)
    onUpdate(next, name !== title ? name : undefined)
  }

  const [editing, setEditing] = useState<string | null>(null)
  const done = (): void => {
    save()
    setEditing(null)
  }

  const line = (id: string, label: string, value: string): PanelField => ({
    id,
    label,
    filled: Boolean(value),
    display: <ValueRow label={label} value={value} onEdit={() => setEditing(id)} />,
    editor: (
      <Field label={label}>
        <SpellCheckedInput
          value={value}
          onChange={(e) => setMeta({ ...meta, [id]: e.target.value })}
          onBlur={save}
        />
      </Field>
    )
  })

  const prose = (id: string, label: string, value: string, rows = 3): PanelField => ({
    id,
    label,
    filled: Boolean(value),
    display: <ProseRow label={label} value={value} onEdit={() => setEditing(id)} />,
    editor: (
      <Field label={label}>
        <SpellCheckedTextarea
          measureKey={id === 'general' ? `${nodeId}-general` : nodeId}
          value={value}
          onChange={(e) => setMeta({ ...meta, [id]: e.target.value })}
          onBlur={save}
          rows={rows}
        />
      </Field>
    )
  })

  const combo = (
    id: string,
    label: string,
    value: string,
    suggestions: string[]
  ): PanelField => ({
    id,
    label,
    filled: Boolean(value),
    display: <ValueRow label={label} value={value} onEdit={() => setEditing(id)} />,
    editor: (
      <Field label={label}>
        <ComboField
          value={value}
          suggestions={suggestions}
          onChange={(v) => setMeta({ ...meta, [id]: v })}
          onBlur={save}
        />
      </Field>
    )
  })

  const atAGlance: PanelField[] = [
    line('knownAs', 'Known as', meta.knownAs),
    combo('ethnicity', 'Ethnicity', meta.ethnicity, ethnicitySuggestions),
    combo('gender', 'Gender', meta.gender, genderSuggestions),
    line('age', 'Age', meta.age),
    line('roleTitle', 'Role / title', meta.roleTitle),
    line('organization', 'Organization', meta.organization)
  ]

  const description: PanelField[] = [
    prose('general', 'General', meta.general),
    prose('keyQuotes', 'Key quotes', meta.keyQuotes, 4),
    prose('relevance', 'Relevance', meta.relevance, 2),
    prose('notes', 'Notes', meta.notes)
  ]

  const interview: PanelField = {
    id: 'interviewStatus',
    label: 'Interview status',
    filled: Boolean(meta.interviewStatus),
    display: (
      <ValueRow
        label="Interview status"
        value={meta.interviewStatus}
        onEdit={() => setEditing('interviewStatus')}
      />
    ),
    editor: (
      <Field label="Interview status">
        <select
          value={meta.interviewStatus}
          onChange={(e) => {
            const next = { ...meta, interviewStatus: e.target.value }
            setMeta(next)
            onUpdate(next, name !== title ? name : undefined)
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">— none —</option>
          {PEOPLE_INTERVIEW_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>
    )
  }

  // Each link carries its own word — Source, Colleague — so it keeps its own editor.
  const relationships: PanelField = {
    id: 'relationships',
    label: 'Relationships',
    filled: meta.relationships.length > 0,
    display: (
      <button
        type="button"
        onClick={() => setEditing('relationships')}
        className="w-full rounded-md px-1 py-0.5 text-left hover:bg-accent/40"
      >
        {meta.relationships.map((rel, i) => {
          const other = otherPeople.find((c) => c.id === rel.personId)
          return (
            <span key={`${rel.personId}-${i}`} className="flex min-w-0 items-center gap-2 py-0.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-semibold">
                {(other?.title ?? '?').slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{other?.title ?? 'Nobody yet'}</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {rel.type}
              </span>
            </span>
          )
        })}
      </button>
    ),
    editor: (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Relationships</label>
        <div className="space-y-2">
          {meta.relationships.map((rel, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <select
                value={rel.type}
                onChange={(e) => {
                  updateRelationship(index, { type: e.target.value as PeopleRelationshipType })
                }}
                className={selectClassName}
                style={{ flex: '0 0 7.5rem' }}
              >
                {PEOPLE_RELATIONSHIP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <PeopleSearchSelect
                value={rel.personId}
                people={otherPeople}
                onChange={(personId) => updateRelationship(index, { personId })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removeRelationship(index)}
                title="Remove relationship"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={addRelationship}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add relationship
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <EntityImageBanner
        nodeId={nodeId}
        title={name}
        imagePath={meta.imagePath}
        secondaryImagePaths={meta.secondaryImagePaths}
        imageFocus={meta.imageFocus}
        entityType="entry"
        onImagesChange={({ imagePath, secondaryImagePaths, imageFocus }) =>
          saveMeta({ ...meta, imagePath, secondaryImagePaths, imageFocus })
        }
      />

      <PanelNameField
        nodeId={nodeId}
        name={name}
        setName={setName}
        onSave={(n) => onUpdate(meta, n !== title ? n : undefined)}
        onSaveMetaOnly={() => onUpdate(meta)}
        className={PANEL_TITLE_CLASS}
      />

      <FixedFields title="At a glance" fields={atAGlance} editing={editing} setEditing={setEditing} onDone={done} />
      <FixedFields title="Description" fields={description} editing={editing} setEditing={setEditing} onDone={done} />
      <FixedFields title="Interview" fields={[interview]} editing={editing} setEditing={setEditing} onDone={done} />
      <FixedFields title="Relationships" fields={[relationships]} editing={editing} setEditing={setEditing} onDone={done} />
    </div>
  )
}
