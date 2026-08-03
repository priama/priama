import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/UI/button'
import { SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { ComboField } from '@/components/UI/ComboField'
import { ScrollArea } from '@/components/UI/scroll-area'
import { CharacterPanel } from '@/components/Wiki/CharacterPanel'
import { renderEntryPanel } from '@/components/Wiki/entryPanelRegistry'
import { EntityImageBanner } from '@/components/Wiki/EntityImageBanner'
import { NotePanel } from '@/components/Wiki/NotePanel'
import { ensureNodeInStore } from '@/lib/categoryNavigation'
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { PanelNameField } from '@/components/Wiki/PanelNameField'
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
  metadataSource,
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: LocationMeta
  metadataSource: string
  onUpdate: (meta: LocationMeta, title?: string) => void
}): React.JSX.Element {
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata,
    metadataSource
  })
  const typeSuggestions = useFieldSuggestions('location', 'type', nodeId)

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
        imageFocus={meta.imageFocus}
        entityType="location"
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
  metadataSource,
  onUpdate
}: {
  nodeId: string
  title: string
  metadata: LoreMeta
  metadataSource: string
  onUpdate: (meta: LoreMeta, title?: string) => void
}): React.JSX.Element {
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata,
    metadataSource
  })
  const categorySuggestions = useFieldSuggestions('lore', 'category', nodeId)

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
        imageFocus={meta.imageFocus}
        entityType="lore"
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

const PANEL_TRANSITION_MS = 320
const PANEL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

type PanelSnapshot = {
  nodeId: string
  panelType: string
  entryCategoryId: string | null
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
    rightPanelOpen,
    setRightPanelOpen,
    setRightPanelWidth,
    setSelectedEntity,
    selectEntry,
    updateNodeInStore,
    setDirty
  } = useAppStore()

  const activeId = selectedEntryId ?? selectedEntityId
  const wantsOpen = !!activeId && rightPanelOpen

  const [mounted, setMounted] = useState(wantsOpen)
  const [expanded, setExpanded] = useState(wantsOpen)
  const [snapshot, setSnapshot] = useState<PanelSnapshot | null>(null)
  const openFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!activeId) return
    setSnapshot((prev) => {
      const next: PanelSnapshot = {
        nodeId: activeId,
        panelType: selectedEntryId
          ? 'entry'
          : (selectedEntityType ?? prev?.panelType ?? 'entry'),
        entryCategoryId: selectedEntryId ? (selectedEntryCategoryId ?? null) : null
      }
      if (
        prev &&
        prev.nodeId === next.nodeId &&
        prev.panelType === next.panelType &&
        prev.entryCategoryId === next.entryCategoryId
      ) {
        return prev
      }
      return next
    })
  }, [activeId, selectedEntryId, selectedEntryCategoryId, selectedEntityType])

  useEffect(() => {
    if (wantsOpen) {
      setMounted(true)
      if (openFrameRef.current != null) cancelAnimationFrame(openFrameRef.current)
      openFrameRef.current = requestAnimationFrame(() => {
        openFrameRef.current = requestAnimationFrame(() => {
          setExpanded(true)
          openFrameRef.current = null
        })
      })
      return () => {
        if (openFrameRef.current != null) {
          cancelAnimationFrame(openFrameRef.current)
          openFrameRef.current = null
        }
      }
    }

    setExpanded(false)
  }, [wantsOpen])

  const displayId = activeId ?? snapshot?.nodeId ?? null
  const node = displayId ? (nodes.find((n) => n.id === displayId) ?? null) : null

  const resolvedPanelType = wantsOpen
    ? selectedEntryId
      ? 'entry'
      : (selectedEntityType ?? node?.type ?? snapshot?.panelType ?? 'entry')
    : (snapshot?.panelType ?? node?.type ?? 'entry')

  const resolvedEntryCategory =
    resolvedPanelType === 'entry'
      ? categories.find(
          (c) =>
            c.id ===
            (wantsOpen ? selectedEntryCategoryId : snapshot?.entryCategoryId)
        ) ?? null
      : null

  const characterMeta = useMemo(
    () =>
      node
        ? normalizeCharacterMeta(
            parseMetadata<CharacterMeta>(node.metadata, DEFAULT_CHARACTER_META)
          )
        : DEFAULT_CHARACTER_META,
    [node?.id, node?.metadata]
  )
  const locationMeta = useMemo(
    () =>
      node
        ? normalizeLocationMeta(parseMetadata<LocationMeta>(node.metadata, DEFAULT_LOCATION_META))
        : DEFAULT_LOCATION_META,
    [node?.id, node?.metadata]
  )
  const loreMeta = useMemo(
    () =>
      node
        ? normalizeLoreMeta(parseMetadata<LoreMeta>(node.metadata, DEFAULT_LORE_META))
        : DEFAULT_LORE_META,
    [node?.id, node?.metadata]
  )
  const noteMeta = useMemo(
    () =>
      node
        ? normalizeNoteMeta(parseMetadata<NoteMeta>(node.metadata, DEFAULT_NOTE_META))
        : DEFAULT_NOTE_META,
    [node?.id, node?.metadata]
  )

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
    if (!node || !wantsOpen) return
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
    if (!node || !wantsOpen) return
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
    if (!node || !wantsOpen) return
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

  const handleClose = (): void => {
    setRightPanelOpen(false)
    if (selectedEntryId) {
      selectEntry(null, null)
    } else {
      setSelectedEntity(null, null)
    }
  }

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLElement>): void => {
    if (event.propertyName !== 'width') return
    if (event.target !== event.currentTarget) return
    if (!wantsOpen) {
      setMounted(false)
      setSnapshot(null)
    }
  }

  if (!mounted) return null

  const showLoading = !node && !!activeId
  const interactive = wantsOpen && expanded

  return (
    <aside
      className={cn(
        'relative h-full shrink-0 overflow-hidden border-l border-border bg-card',
        !expanded && 'border-l-transparent',
        !interactive && 'pointer-events-none'
      )}
      style={{
        width: expanded ? rightPanelWidth : 0,
        transition: `width ${PANEL_TRANSITION_MS}ms ${PANEL_EASE}, border-color ${PANEL_TRANSITION_MS}ms ${PANEL_EASE}`
      }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!interactive}
    >
      <div
        className={cn(
          'relative flex h-full flex-col',
          expanded ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          width: rightPanelWidth,
          transition: `opacity ${PANEL_TRANSITION_MS * 0.7}ms ${PANEL_EASE}`,
          transitionDelay: expanded ? '40ms' : '0ms'
        }}
      >
        {interactive && (
          <div
            {...handleProps}
            className={cn(handleProps.className, 'left-0')}
            style={{ left: 0 }}
          />
        )}

        {showLoading || !node ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <p className="text-sm">
              {showLoading ? (resolvingNode ? 'Loading…' : 'Entry not found') : 'Entry not found'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold capitalize">
                  {resolvedPanelType === 'entry'
                    ? (resolvedEntryCategory?.name ?? 'Entry')
                    : resolvedPanelType}
                </h2>
                <p className="text-xs text-muted-foreground">{node.title}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleClose}
                  tabIndex={interactive ? 0 : -1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {resolvedPanelType === 'character' && (
                  <CharacterPanel
                    key={node.id}
                    nodeId={node.id}
                    title={node.title}
                    metadata={characterMeta}
                    metadataSource={node.metadata}
                    onUpdate={handleUpdate}
                  />
                )}
                {resolvedPanelType === 'location' && (
                  <LocationPanel
                    key={node.id}
                    nodeId={node.id}
                    title={node.title}
                    metadata={locationMeta}
                    metadataSource={node.metadata}
                    onUpdate={handleUpdate}
                  />
                )}
                {resolvedPanelType === 'lore' && (
                  <LorePanel
                    key={node.id}
                    nodeId={node.id}
                    title={node.title}
                    metadata={loreMeta}
                    metadataSource={node.metadata}
                    onUpdate={handleUpdate}
                  />
                )}
                {resolvedPanelType === 'note' && (
                  <NotePanel
                    key={node.id}
                    nodeId={node.id}
                    title={node.title}
                    content={node.content}
                    metadata={noteMeta}
                    metadataSource={node.metadata}
                    onUpdate={handleNoteUpdate}
                  />
                )}
                {resolvedPanelType === 'entry' && resolvedEntryCategory && (
                  renderEntryPanel(resolvedEntryCategory, {
                    nodeId: node.id,
                    title: node.title,
                    rawMetadata: node.metadata,
                    category: resolvedEntryCategory,
                    onUpdate: handleEntryUpdate
                  })
                )}
                {resolvedPanelType === 'entry' && !resolvedEntryCategory && (
                  <p className="text-sm text-muted-foreground">
                    Category not found. It may have been deleted.
                  </p>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </aside>
  )
}
