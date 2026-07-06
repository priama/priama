import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/UI/button'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { ComboField } from '@/components/UI/ComboField'
import { ScrollArea } from '@/components/UI/scroll-area'
import { CharacterPanel } from '@/components/Wiki/CharacterPanel'
import { renderEntryPanel } from '@/components/Wiki/entryPanelRegistry'
import { EntityImageBanner } from '@/components/Wiki/EntityImageBanner'
import { NotePanel } from '@/components/Wiki/NotePanel'
import { ensureNodeInStore } from '@/lib/categoryNavigation'
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions'
import { usePendingPanelRename } from '@/hooks/usePendingPanelRename'
import { useResizeHandle, usePersistLayout } from '@/hooks/useResize'
import { cn } from '@/lib/utils'
import {
  DEFAULT_CHARACTER_META,
  DEFAULT_LOCATION_META,
  DEFAULT_LORE_META,
  DEFAULT_NOTE_META,
  normalizeCharacterMeta,
  normalizeLocationMeta,
  normalizeLoreMeta,
  normalizeNoteMeta,
  parseMetadata,
  serializeMetadata,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH
} from '@shared/types'
import type { CharacterMeta, LocationMeta, LoreMeta, NoteMeta, TreeNode } from '@shared/types'

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

function LocationPanel({
  nodeId,
  title,
  metadata,
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: LocationMeta
  onUpdate: (meta: LocationMeta, title?: string) => void
}): React.JSX.Element {
  const [meta, setMeta] = useState(metadata)
  const [name, setName] = useState(title)
  const { inputRef: nameRef, handleFocus, handleBlur } = usePendingPanelRename(nodeId)
  const typeSuggestions = useFieldSuggestions('location', 'type', nodeId)

  useEffect(() => {
    setMeta(metadata)
    setName(title)
  }, [nodeId, metadata, title])

  const save = useCallback(() => {
    onUpdate(meta, name !== title ? name : undefined)
  }, [meta, name, title, onUpdate])

  const saveMeta = useCallback(
    (next: LocationMeta) => {
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
        entityType="location"
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
      <Field label="Type">
        <ComboField
          value={meta.type}
          suggestions={typeSuggestions}
          onChange={(v) => setMeta({ ...meta, type: v })}
          onBlur={save}
          placeholder="city, forest, dungeon..."
        />
      </Field>
      <Field label="General">
        <SpellCheckedTextarea measureKey={`${nodeId}-general`} value={meta.general} onChange={(e) => setMeta({ ...meta, general: e.target.value })} onBlur={save} rows={3} />
      </Field>
      <Field label="Description">
        <SpellCheckedTextarea measureKey={nodeId} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} onBlur={save} rows={4} />
      </Field>
      <Field label="Notes">
        <SpellCheckedTextarea measureKey={nodeId} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} onBlur={save} rows={3} />
      </Field>
    </div>
  )
}

function LorePanel({
  nodeId,
  title,
  metadata,
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: LoreMeta
  onUpdate: (meta: LoreMeta, title?: string) => void
}): React.JSX.Element {
  const [meta, setMeta] = useState(metadata)
  const [name, setName] = useState(title)
  const { inputRef: nameRef, handleFocus, handleBlur } = usePendingPanelRename(nodeId)
  const categorySuggestions = useFieldSuggestions('lore', 'category', nodeId)

  useEffect(() => {
    setMeta(metadata)
    setName(title)
  }, [nodeId, metadata, title])

  const save = useCallback(() => {
    onUpdate(meta, name !== title ? name : undefined)
  }, [meta, name, title, onUpdate])

  const saveMeta = useCallback(
    (next: LoreMeta) => {
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
        entityType="lore"
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
      <Field label="Category">
        <ComboField
          value={meta.category}
          suggestions={categorySuggestions}
          onChange={(v) => setMeta({ ...meta, category: v })}
          onBlur={save}
          placeholder="magic, religion, history..."
        />
      </Field>
      <Field label="General">
        <SpellCheckedTextarea measureKey={`${nodeId}-general`} value={meta.general} onChange={(e) => setMeta({ ...meta, general: e.target.value })} onBlur={save} rows={3} />
      </Field>
      <Field label="Description">
        <SpellCheckedTextarea measureKey={nodeId} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} onBlur={save} rows={4} />
      </Field>
      <Field label="Notes">
        <SpellCheckedTextarea measureKey={nodeId} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} onBlur={save} rows={3} />
      </Field>
    </div>
  )
}

export function EntityPanel(): React.JSX.Element | null {
  const {
    nodes,
    selectedEntityId,
    selectedEntityType,
    selectedEntryId,
    selectedEntryCategoryId,
    categories,
    rightPanelWidth,
    setRightPanelOpen,
    setRightPanelWidth,
    setSelectedEntity,
    selectEntry,
    updateNodeInStore,
    setDirty
  } = useAppStore()

  const activeId = selectedEntryId ?? selectedEntityId
  const node = activeId ? nodes.find((n) => n.id === activeId) : null
  const entryCategory = selectedEntryId
    ? (categories.find((c) => c.id === selectedEntryCategoryId) ?? null)
    : null

  const [resolvingNode, setResolvingNode] = useState(false)

  useEffect(() => {
    if (!activeId || node) {
      setResolvingNode(false)
      return
    }
    let cancelled = false
    setResolvingNode(true)
    void ensureNodeInStore(activeId).finally(() => {
      if (!cancelled) setResolvingNode(false)
    })
    return () => {
      cancelled = true
    }
  }, [activeId, node])

  const { handleProps } = useResizeHandle(
    rightPanelWidth,
    setRightPanelWidth,
    RIGHT_PANEL_MIN_WIDTH,
    RIGHT_PANEL_MAX_WIDTH,
    'right'
  )
  usePersistLayout(rightPanelWidth, 'rightPanelWidth')

  const handleNoteUpdate = async (updates: {
    metadata?: NoteMeta
    title?: string
    content?: string
  }) => {
    if (!node) return
    const payload: { metadata?: string; title?: string; content?: string } = {}
    if (updates.metadata) payload.metadata = serializeMetadata(updates.metadata)
    if (updates.title) payload.title = updates.title
    if (updates.content !== undefined) payload.content = updates.content

    const updated = await window.electronAPI.tree.update(node.id, payload)
    const storeUpdates: { metadata?: string; title?: string; content?: string } = {}
    if (updates.metadata) storeUpdates.metadata = updated.metadata
    if (updates.title) storeUpdates.title = updated.title
    if (updates.content !== undefined) storeUpdates.content = updated.content
    updateNodeInStore(node.id, storeUpdates)
    setDirty(true)
  }

  const handleUpdate = async (
    metadata: CharacterMeta | LocationMeta | LoreMeta,
    title?: string
  ) => {
    if (!node) return
    const updates: { metadata: string; title?: string } = {
      metadata: serializeMetadata(metadata)
    }
    if (title) updates.title = title

    const updated = await window.electronAPI.tree.update(node.id, updates)
    updateNodeInStore(node.id, { metadata: updated.metadata, title: updated.title })
    setDirty(true)
  }

  const handleEntryUpdate = async (updates: {
    title?: string
    metadata?: string
  }): Promise<void> => {
    if (!node) return
    const payload: { title?: string; metadata?: string } = {}
    if (updates.title) payload.title = updates.title
    if (updates.metadata !== undefined) payload.metadata = updates.metadata

    const updated = await window.electronAPI.tree.update(node.id, payload)
    const storeUpdates: Partial<TreeNode> = {}
    if (updates.title) storeUpdates.title = updated.title
    if (updates.metadata !== undefined) storeUpdates.metadata = updated.metadata
    updateNodeInStore(node.id, storeUpdates)
    setDirty(true)
  }

  if (!activeId) return null

  if (!node && activeId) {
    return (
      <aside
        className="relative flex h-full shrink-0 flex-col border-l border-border bg-card"
        style={{ width: rightPanelWidth }}
      >
        <div
          {...handleProps}
          className={cn(handleProps.className, 'left-0')}
          style={{ left: 0 }}
        />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <p className="text-sm">{resolvingNode ? 'Loading…' : 'Entry not found'}</p>
        </div>
      </aside>
    )
  }

  if (!node) return null

  const panelType = selectedEntryId ? 'entry' : (selectedEntityType ?? node.type)

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-card"
      style={{ width: rightPanelWidth }}
    >
      <div
        {...handleProps}
        className={cn(handleProps.className, 'left-0')}
        style={{ left: 0 }}
      />
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold capitalize">
            {panelType === 'entry' ? (entryCategory?.name ?? 'Entry') : panelType}
          </h2>
          <p className="text-xs text-muted-foreground">{node.title}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setRightPanelOpen(false)
              if (selectedEntryId) {
                selectEntry(null, null)
              } else {
                setSelectedEntity(null, null)
              }
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {panelType === 'character' && (
            <CharacterPanel
              nodeId={node.id}
              title={node.title}
              metadata={normalizeCharacterMeta(
                parseMetadata<CharacterMeta>(node.metadata, DEFAULT_CHARACTER_META)
              )}
              onUpdate={handleUpdate}
            />
          )}
          {panelType === 'location' && (
            <LocationPanel
              nodeId={node.id}
              title={node.title}
              metadata={normalizeLocationMeta(
                parseMetadata<LocationMeta>(node.metadata, DEFAULT_LOCATION_META)
              )}
              onUpdate={handleUpdate}
            />
          )}
          {panelType === 'lore' && (
            <LorePanel
              nodeId={node.id}
              title={node.title}
              metadata={normalizeLoreMeta(
                parseMetadata<LoreMeta>(node.metadata, DEFAULT_LORE_META)
              )}
              onUpdate={handleUpdate}
            />
          )}
          {panelType === 'note' && (
            <NotePanel
              nodeId={node.id}
              title={node.title}
              content={node.content}
              metadata={normalizeNoteMeta(
                parseMetadata<NoteMeta>(node.metadata, DEFAULT_NOTE_META)
              )}
              onUpdate={handleNoteUpdate}
            />
          )}
          {panelType === 'entry' && entryCategory && (
            renderEntryPanel(entryCategory, {
              nodeId: node.id,
              title: node.title,
              rawMetadata: node.metadata,
              category: entryCategory,
              onUpdate: handleEntryUpdate
            })
          )}
          {panelType === 'entry' && !entryCategory && (
            <p className="text-sm text-muted-foreground">
              Category not found. It may have been deleted.
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
