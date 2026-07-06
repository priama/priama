import { useCallback, useEffect, useState } from 'react'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { ComboField } from '@/components/UI/ComboField'
import { EntityImageBanner } from '@/components/Wiki/EntityImageBanner'
import { useEntryFieldSuggestions } from '@/hooks/useEntryFieldSuggestions'
import { usePendingPanelRename } from '@/hooks/usePendingPanelRename'
import {
  DEFAULT_BESTIARY_META,
  OPTIONAL_BESTIARY_CATEGORY_ID,
  type BestiaryMeta
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

export function BestiaryPanel({
  nodeId,
  title,
  metadata,
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: BestiaryMeta
  onUpdate: (meta: BestiaryMeta, title?: string) => void
}): React.JSX.Element {
  const [meta, setMeta] = useState(metadata)
  const [name, setName] = useState(title)
  const { inputRef: nameRef, handleFocus, handleBlur } = usePendingPanelRename(nodeId)

  const speciesSuggestions = useEntryFieldSuggestions(
    OPTIONAL_BESTIARY_CATEGORY_ID,
    'species',
    nodeId,
    DEFAULT_BESTIARY_META
  )
  // BestiaryMeta.type — creature type classification, not TreeNode.type
  const typeSuggestions = useEntryFieldSuggestions(
    OPTIONAL_BESTIARY_CATEGORY_ID,
    'type',
    nodeId,
    DEFAULT_BESTIARY_META
  )
  const habitatSuggestions = useEntryFieldSuggestions(
    OPTIONAL_BESTIARY_CATEGORY_ID,
    'habitat',
    nodeId,
    DEFAULT_BESTIARY_META
  )

  useEffect(() => {
    setMeta(metadata)
    setName(title)
  }, [nodeId, metadata, title])

  const save = useCallback(() => {
    onUpdate(meta, name !== title ? name : undefined)
  }, [meta, name, title, onUpdate])

  const saveMeta = useCallback(
    (next: BestiaryMeta) => {
      setMeta(next)
      onUpdate(next, name !== title ? name : undefined)
    },
    [name, title, onUpdate]
  )

  return (
    <div className="space-y-4">
      <EntityImageBanner
        nodeId={nodeId}
        title={name}
        imagePath={meta.imagePath}
        secondaryImagePaths={meta.secondaryImagePaths}
        entityType="entry"
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
          onBlur={() => {
            handleBlur()
            save()
          }}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Species">
          <ComboField
            value={meta.species}
            suggestions={speciesSuggestions}
            onChange={(v) => setMeta({ ...meta, species: v })}
            onBlur={save}
          />
        </Field>
        <Field label="Type">
          <ComboField
            value={meta.type}
            suggestions={typeSuggestions}
            onChange={(v) => setMeta({ ...meta, type: v })}
            onBlur={save}
          />
        </Field>
        <Field label="Habitat">
          <ComboField
            value={meta.habitat}
            suggestions={habitatSuggestions}
            onChange={(v) => setMeta({ ...meta, habitat: v })}
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

      <Field label="Physical Description">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-physical`}
          value={meta.physicalDescription}
          onChange={(e) => setMeta({ ...meta, physicalDescription: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>

      <Field label="Behavior">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-behavior`}
          value={meta.behavior}
          onChange={(e) => setMeta({ ...meta, behavior: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>

      <Field label="Origin">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-origin`}
          value={meta.origin}
          onChange={(e) => setMeta({ ...meta, origin: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>

      <Field label="Abilities">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-abilities`}
          value={meta.abilities}
          onChange={(e) => setMeta({ ...meta, abilities: e.target.value })}
          onBlur={save}
          rows={3}
        />
      </Field>

      <Field label="Weaknesses">
        <SpellCheckedTextarea
          measureKey={`${nodeId}-weaknesses`}
          value={meta.weaknesses}
          onChange={(e) => setMeta({ ...meta, weaknesses: e.target.value })}
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
    </div>
  )
}
