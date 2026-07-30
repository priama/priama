import type { CategoryDefinition } from '@shared/types'
import {
  DEFAULT_BESTIARY_META,
  DEFAULT_PEOPLE_META,
  NF_PEOPLE_CATEGORY_ID,
  OPTIONAL_BESTIARY_CATEGORY_ID,
  normalizeBestiaryMeta,
  normalizePeopleMeta,
  parseMetadata,
  serializeMetadata,
  type BestiaryMeta,
  type PeopleMeta
} from '@shared/types'
import { BestiaryPanel } from '@/components/Wiki/BestiaryPanel'
import { EntryPanel } from '@/components/Wiki/EntryPanel'
import { PeoplePanel } from '@/components/Wiki/PeoplePanel'

/** Unified props for entry panel rendering. EntityPanel passes raw node.metadata. */
export interface EntryPanelRenderProps {
  nodeId: string
  title: string
  rawMetadata: string
  category: CategoryDefinition
  onUpdate: (updates: { title?: string; metadata?: string }) => void
}

type EntryPanelComponent = React.FC<EntryPanelRenderProps>

function BestiaryEntryPanel(props: EntryPanelRenderProps): React.JSX.Element {
  const meta = normalizeBestiaryMeta(
    parseMetadata<BestiaryMeta>(props.rawMetadata, DEFAULT_BESTIARY_META) as Partial<BestiaryMeta> &
      Record<string, unknown>
  )
  return (
    <BestiaryPanel
      nodeId={props.nodeId}
      title={props.title}
      metadata={meta}
      metadataSource={props.rawMetadata}
      onUpdate={(m, title) =>
        props.onUpdate({
          metadata: serializeMetadata(m),
          ...(title !== undefined ? { title } : {})
        })
      }
    />
  )
}

function PeopleEntryPanel(props: EntryPanelRenderProps): React.JSX.Element {
  const meta = normalizePeopleMeta(
    parseMetadata<PeopleMeta>(props.rawMetadata, DEFAULT_PEOPLE_META) as Partial<PeopleMeta> &
      Record<string, unknown>
  )
  return (
    <PeoplePanel
      nodeId={props.nodeId}
      title={props.title}
      metadata={meta}
      metadataSource={props.rawMetadata}
      onUpdate={(m, title) =>
        props.onUpdate({
          metadata: serializeMetadata(m),
          ...(title !== undefined ? { title } : {})
        })
      }
    />
  )
}

function GenericEntryPanel(props: EntryPanelRenderProps): React.JSX.Element {
  return (
    <EntryPanel
      nodeId={props.nodeId}
      title={props.title}
      metadata={props.rawMetadata}
      category={props.category}
      onUpdate={props.onUpdate}
    />
  )
}

const ENTRY_PANEL_REGISTRY: Record<string, EntryPanelComponent> = {
  [OPTIONAL_BESTIARY_CATEGORY_ID]: BestiaryEntryPanel,
  [NF_PEOPLE_CATEGORY_ID]: PeopleEntryPanel
}

export function renderEntryPanel(
  category: CategoryDefinition,
  props: EntryPanelRenderProps
): React.JSX.Element {
  const Panel = ENTRY_PANEL_REGISTRY[category.id] ?? GenericEntryPanel
  return <Panel key={props.nodeId} {...props} />
}
