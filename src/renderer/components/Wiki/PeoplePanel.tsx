import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { ComboField } from '@/components/UI/ComboField'
import { Input } from '@/components/UI/input'
import { Button } from '@/components/UI/button'
import { EntityImageBanner } from '@/components/Wiki/EntityImageBanner'
import { useAppStore } from '@/store/appStore'
import { useEntryFieldSuggestions } from '@/hooks/useEntryFieldSuggestions'
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

      <Field label="Name">
        <PanelNameField
          nodeId={nodeId}
          name={name}
          setName={setName}
          onSave={(n) => onUpdate(meta, n !== title ? n : undefined)}
          onSaveMetaOnly={() => onUpdate(meta)}
        />
      </Field>
      <Field label="Known As">
        <SpellCheckedInput
          value={meta.knownAs}
          onChange={(e) => setMeta({ ...meta, knownAs: e.target.value })}
          onBlur={save}
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Ethnicity">
          <ComboField
            value={meta.ethnicity}
            suggestions={ethnicitySuggestions}
            onChange={(v) => setMeta({ ...meta, ethnicity: v })}
            onBlur={save}
          />
        </Field>
        <Field label="Gender">
          <ComboField
            value={meta.gender}
            suggestions={genderSuggestions}
            onChange={(v) => setMeta({ ...meta, gender: v })}
            onBlur={save}
          />
        </Field>
        <Field label="Age">
          <SpellCheckedInput
            value={meta.age}
            onChange={(e) => setMeta({ ...meta, age: e.target.value })}
            onBlur={save}
          />
        </Field>
      </div>
      <Field label="General">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-general`}
          value={meta.general}
          onChange={(e) => setMeta({ ...meta, general: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
      <Field label="Role / Title">
        <SpellCheckedInput
          value={meta.roleTitle}
          onChange={(e) => setMeta({ ...meta, roleTitle: e.target.value })}
          onBlur={save}
        />
      </Field>
      <Field label="Organization">
        <SpellCheckedInput
          value={meta.organization}
          onChange={(e) => setMeta({ ...meta, organization: e.target.value })}
          onBlur={save}
        />
      </Field>
      <Field label="Interview Status">
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
      <Field label="Key Quotes">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={meta.keyQuotes}
          onChange={(e) => setMeta({ ...meta, keyQuotes: e.target.value })}
          onBlur={save}
          rows={4}
        />
      </Field>
      <Field label="Relevance">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-relevance`}
          value={meta.relevance}
          onChange={(e) => setMeta({ ...meta, relevance: e.target.value })}
          onBlur={save}
          rows={2}
        />
      </Field>

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

      <Field label="Notes">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-notes`}
          value={meta.notes}
          onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
    </div>
  )
}
