import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { CommaSeparatedField } from '@/components/UI/CommaSeparatedField'
import { ComboField } from '@/components/UI/ComboField'
import { ComboTagsField } from '@/components/UI/ComboTagsField'
import { Input } from '@/components/UI/input'
import { Button } from '@/components/UI/button'
import { EntityImageBanner } from '@/components/Wiki/EntityImageBanner'
import { useAppStore } from '@/store/appStore'
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions'
import {
  FixedFields,
  PANEL_TITLE_CLASS,
  ProseRow,
  TagsRow,
  ValueRow,
  type PanelField
} from '@/components/Wiki/PanelKit'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { PanelNameField } from '@/components/Wiki/PanelNameField'
import { useArrayFieldSuggestions } from '@/hooks/useArrayFieldSuggestions'
import { cn } from '@/lib/utils'
import {
  CHARACTER_RELATIONSHIP_TYPES,
  type CharacterMeta,
  type CharacterRelationship,
  type CharacterRelationshipType,
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

function CharacterSearchSelect({
  value,
  characters,
  onChange
}: {
  value: string
  characters: TreeNode[]
  onChange: (characterId: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = characters.find((c) => c.id === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return characters
    return characters.filter((c) => c.title.toLowerCase().includes(q))
  }, [characters, query])

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
        placeholder="Select character"
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
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No characters found</p>
          ) : (
            filtered.map((character) => (
              <button
                key={character.id}
                type="button"
                className={cn(
                  'block w-full px-2 py-1.5 text-left text-sm hover:bg-accent',
                  character.id === value && 'bg-accent'
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(character.id)
                  setQuery('')
                  setOpen(false)
                }}
              >
                {character.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function CharacterPanel({
  nodeId,
  title,
  metadata,
  metadataSource,
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: CharacterMeta
  metadataSource: string
  onUpdate: (meta: CharacterMeta, title?: string) => void
}): React.JSX.Element {
  const nodes = useAppStore((s) => s.nodes)
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata,
    metadataSource
  })

  const otherCharacters = useMemo(
    () => nodes.filter((n) => n.type === 'character' && !n.deletedAt && n.id !== nodeId),
    [nodes, nodeId]
  )
  const raceSuggestions = useFieldSuggestions('character', 'race', nodeId)
  const genderSuggestions = useFieldSuggestions('character', 'gender', nodeId)
  const professionSuggestions = useArrayFieldSuggestions('character', 'professions', nodeId)

  const save = useCallback(() => {
    onUpdate(meta, name !== title ? name : undefined)
  }, [meta, name, title, onUpdate])

  const saveMeta = useCallback(
    (next: CharacterMeta) => {
      setMeta(next)
      onUpdate(next, name !== title ? name : undefined)
    },
    [name, title, onUpdate]
  )

  const updateRelationship = (index: number, updates: Partial<CharacterRelationship>): void => {
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
      relationships: [...meta.relationships, { characterId: '', type: 'Unknown' as const }]
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

  const atAGlance: PanelField[] = [
    {
      id: 'aliases',
      label: 'Also known as',
      filled: meta.aliases.length > 0,
      display: (
        <TagsRow label="Also known as" values={meta.aliases} onEdit={() => setEditing('aliases')} />
      ),
      editor: (
        <Field label="Also known as">
          <CommaSeparatedField
            value={meta.aliases}
            onChange={(aliases) => setMeta({ ...meta, aliases })}
            onBlur={save}
          />
        </Field>
      )
    },
    {
      id: 'age',
      label: 'Age',
      filled: Boolean(meta.age),
      display: <ValueRow label="Age" value={meta.age} onEdit={() => setEditing('age')} />,
      editor: (
        <Field label="Age">
          <SpellCheckedInput
            value={meta.age}
            onChange={(e) => setMeta({ ...meta, age: e.target.value })}
            onBlur={save}
          />
        </Field>
      )
    },
    {
      id: 'race',
      label: 'Race',
      filled: Boolean(meta.race),
      display: <ValueRow label="Race" value={meta.race} onEdit={() => setEditing('race')} />,
      editor: (
        <Field label="Race">
          <ComboField
            value={meta.race}
            suggestions={raceSuggestions}
            onChange={(v) => setMeta({ ...meta, race: v })}
            onBlur={save}
          />
        </Field>
      )
    },
    {
      id: 'gender',
      label: 'Gender',
      filled: Boolean(meta.gender),
      display: <ValueRow label="Gender" value={meta.gender} onEdit={() => setEditing('gender')} />,
      editor: (
        <Field label="Gender">
          <ComboField
            value={meta.gender}
            suggestions={genderSuggestions}
            onChange={(v) => setMeta({ ...meta, gender: v })}
            onBlur={save}
          />
        </Field>
      )
    },
    {
      id: 'professions',
      label: 'Profession',
      filled: meta.professions.length > 0,
      display: (
        <TagsRow
          label="Profession"
          values={meta.professions}
          onEdit={() => setEditing('professions')}
        />
      ),
      editor: (
        <Field label="Profession">
          <ComboTagsField
            value={meta.professions}
            suggestions={professionSuggestions}
            onChange={(professions) => setMeta({ ...meta, professions })}
            onBlur={save}
          />
        </Field>
      )
    },
    prose('role', 'Role in story', meta.role)
  ]

  const description: PanelField[] = [
    prose('general', 'General', meta.general),
    prose('physicalDescription', 'Physical description', meta.physicalDescription),
    prose('personality', 'Personality', meta.personality),
    prose('background', 'Background', meta.background),
    prose('notes', 'Notes', meta.notes)
  ]

  const arc: PanelField[] = [
    prose('startsAs', 'Starts as', meta.startsAs),
    prose('endsAs', 'Ends as', meta.endsAs)
  ]

  // Relationships carry a word of their own — Friend, Rival — so they are their own shape.
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
          const other = otherCharacters.find((c) => c.id === rel.characterId)
          return (
            <span key={`${rel.characterId}-${i}`} className="flex min-w-0 items-center gap-2 py-0.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-semibold">
                {(other?.title ?? '?').slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {other?.title ?? 'Nobody yet'}
              </span>
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
                  updateRelationship(index, { type: e.target.value as CharacterRelationshipType })
                }}
                className={selectClassName}
                style={{ flex: '0 0 7.5rem' }}
              >
                {CHARACTER_RELATIONSHIP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <CharacterSearchSelect
                value={rel.characterId}
                characters={otherCharacters}
                onChange={(characterId) => updateRelationship(index, { characterId })}
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
        entityType="character"
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

      <FixedFields
        title="At a glance"
        fields={atAGlance}
        editing={editing}
        setEditing={setEditing}
        onDone={done}
      />
      <FixedFields
        title="Description"
        fields={description}
        editing={editing}
        setEditing={setEditing}
        onDone={done}
      />
      <FixedFields
        title="Relationships"
        fields={[relationships]}
        editing={editing}
        setEditing={setEditing}
        onDone={done}
      />
      <FixedFields
        title="Arc"
        fields={arc}
        editing={editing}
        setEditing={setEditing}
        onDone={done}
      />
    </div>
  )
}
