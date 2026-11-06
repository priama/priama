import { useCallback, useState } from 'react'
import { SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { ComboField } from '@/components/UI/ComboField'
import { EntityImageBanner } from '@/components/Wiki/EntityImageBanner'
import { useEntryFieldSuggestions } from '@/hooks/useEntryFieldSuggestions'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { PanelNameField } from '@/components/Wiki/PanelNameField'
import {
  FixedFields,
  PANEL_TITLE_CLASS,
  ProseRow,
  ValueRow,
  type PanelField
} from '@/components/Wiki/PanelKit'
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
  metadataSource,
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: BestiaryMeta
  metadataSource: string
  onUpdate: (meta: BestiaryMeta, title?: string) => void
}): React.JSX.Element {
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata,
    metadataSource
  })

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

  const [editing, setEditing] = useState<string | null>(null)
  const done = (): void => {
    save()
    setEditing(null)
  }

  const combo = (id: string, label: string, value: string, suggestions: string[]): PanelField => ({
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
    combo('species', 'Species', meta.species, speciesSuggestions),
    combo('type', 'Type', meta.type, typeSuggestions),
    combo('habitat', 'Habitat', meta.habitat, habitatSuggestions)
  ]

  const description: PanelField[] = [
    prose('general', 'General', meta.general),
    prose('physicalDescription', 'Physical description', meta.physicalDescription),
    prose('behavior', 'Behavior', meta.behavior)
  ]

  const lore: PanelField[] = [
    prose('origin', 'Origin', meta.origin),
    prose('abilities', 'Abilities', meta.abilities),
    prose('weaknesses', 'Weaknesses', meta.weaknesses),
    prose('notes', 'Notes', meta.notes)
  ]

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
      <FixedFields title="Lore" fields={lore} editing={editing} setEditing={setEditing} onDone={done} />
    </div>
  )
}
