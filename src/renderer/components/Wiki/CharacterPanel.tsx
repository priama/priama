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
import { usePendingPanelRename } from '@/hooks/usePendingPanelRename'
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
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: CharacterMeta
  onUpdate: (meta: CharacterMeta, title?: string) => void
}): React.JSX.Element {
  const nodes = useAppStore((s) => s.nodes)
  const [meta, setMeta] = useState(metadata)
  const [name, setName] = useState(title)
  const { inputRef: nameRef, handleFocus, handleBlur, handleKeyDown } =
    usePendingPanelRename(nodeId)

  const otherCharacters = useMemo(
    () => nodes.filter((n) => n.type === 'character' && !n.deletedAt && n.id !== nodeId),
    [nodes, nodeId]
  )
  const raceSuggestions = useFieldSuggestions('character', 'race', nodeId)
  const genderSuggestions = useFieldSuggestions('character', 'gender', nodeId)
  const professionSuggestions = useArrayFieldSuggestions('character', 'professions', nodeId)

  useEffect(() => {
    setMeta(metadata)
    setName(title)
  }, [nodeId, metadata, title])

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

  return (
    <div className="space-y-4">
      <EntityImageBanner
        nodeId={nodeId}
        title={name}
        imagePath={meta.imagePath}
        secondaryImagePaths={meta.secondaryImagePaths}
        entityType="character"
        onImagesChange={({ imagePath, secondaryImagePaths }) =>
          saveMeta({ ...meta, imagePath, secondaryImagePaths })
        }
      />

      <Field label="Name">
        <SpellCheckedInput
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={(e) => handleKeyDown(e, save)}
          onBlur={() => {
            handleBlur()
            save()
          }}
        />
      </Field>
      <Field label="Also known as">
        <CommaSeparatedField
          value={meta.aliases}
          onChange={(aliases) => setMeta({ ...meta, aliases })}
          onBlur={save}
        />
      </Field>
      <Field label="General">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-general`}
          value={meta.general}
          onChange={(e) => setMeta({ ...meta, general: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Age">
          <SpellCheckedInput value={meta.age} onChange={(e) => setMeta({ ...meta, age: e.target.value })} onBlur={save} />
        </Field>
        <Field label="Race">
          <ComboField
            value={meta.race}
            suggestions={raceSuggestions}
            onChange={(v) => setMeta({ ...meta, race: v })}
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
      </div>
      <Field label="Profession">
        <ComboTagsField
          value={meta.professions}
          suggestions={professionSuggestions}
          onChange={(professions) => setMeta({ ...meta, professions })}
          onBlur={save}
        />
      </Field>
      <Field label="Physical Description">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={meta.physicalDescription}
          onChange={(e) => setMeta({ ...meta, physicalDescription: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
      <Field label="Personality">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={meta.personality}
          onChange={(e) => setMeta({ ...meta, personality: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
      <Field label="Background">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={meta.background}
          onChange={(e) => setMeta({ ...meta, background: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
      <Field label="Role in Story">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={meta.role}
          onChange={(e) => setMeta({ ...meta, role: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
      <Field label="Notes">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={meta.notes}
          onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
          onBlur={save}
          rows={3}
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

      <Field label="Starts as">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={meta.startsAs}
          onChange={(e) => setMeta({ ...meta, startsAs: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
      <Field label="Ends as">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={meta.endsAs}
          onChange={(e) => setMeta({ ...meta, endsAs: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>
    </div>
  )
}
