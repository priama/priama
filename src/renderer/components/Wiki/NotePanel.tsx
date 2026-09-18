import { useCallback, useEffect, useRef, useState } from 'react'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { PanelNameField } from '@/components/Wiki/PanelNameField'
import {
  getUnsavedContent,
  markContentDirty,
  publishUnsavedContent,
  registerActiveNoteContent
} from '@/lib/contentPersistence'
import type { NoteMeta } from '@shared/types'

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

export function NotePanel({
  nodeId,
  title,
  content,
  metadata,
  metadataSource,
  onUpdate
}: {
  nodeId: string
  title: string
  content: string
  metadata: NoteMeta
  metadataSource: string
  onUpdate: (updates: { metadata?: NoteMeta; title?: string; content?: string }) => void
}): React.JSX.Element {
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata,
    metadataSource
  })
  // Typing stays local (the panel is keyed by node id); the store copy only catches up
  // when a write lands, so `content` seeds the body once instead of controlling it.
  const [body, setBody] = useState(() => getUnsavedContent(nodeId) ?? content)
  const bodyRef = useRef(body)
  bodyRef.current = body
  const heightSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const metaRef = useRef(meta)
  metaRef.current = meta

  useEffect(() => {
    registerActiveNoteContent(() => ({ nodeId, content: bodyRef.current }))
    return () => {
      registerActiveNoteContent(null)
      publishUnsavedContent(nodeId)
    }
  }, [nodeId])

  useEffect(() => {
    return () => {
      if (heightSaveTimerRef.current) clearTimeout(heightSaveTimerRef.current)
    }
  }, [nodeId])

  const saveFields = useCallback(
    (nextName: string = name, nextMeta: NoteMeta = meta) => {
      onUpdate({
        metadata: nextMeta,
        ...(nextName !== title ? { title: nextName } : {})
      })
    },
    [meta, name, title, onUpdate]
  )

  const handleBodyChange = (next: string): void => {
    setBody(next)
    markContentDirty(nodeId, next)
  }

  const handleContentHeightChange = useCallback(
    (height: number) => {
      setMeta((prev) => {
        if (prev.contentHeightPx === height) return prev
        return { ...prev, contentHeightPx: height }
      })

      if (heightSaveTimerRef.current) clearTimeout(heightSaveTimerRef.current)
      heightSaveTimerRef.current = setTimeout(() => {
        const latest = metaRef.current
        onUpdate({ metadata: { ...latest, contentHeightPx: height } })
      }, 300)
    },
    [setMeta, onUpdate]
  )

  return (
    <div className="space-y-4">
      <Field label="Title">
        <PanelNameField
          nodeId={nodeId}
          name={name}
          setName={setName}
          onSave={(n) => saveFields(n)}
          onSaveMetaOnly={() => onUpdate({ metadata: meta })}
        />
      </Field>
      <Field label="Tags">
        <SpellCheckedInput
          value={meta.tags.join(', ')}
          onChange={(e) =>
            setMeta({
              ...meta,
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            })
          }
          onBlur={() => saveFields()}
          placeholder="separate with ,"
        />
      </Field>
      <Field label="Content">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          rows={3}
          growCap={null}
          persistedHeight={meta.contentHeightPx ?? null}
          onHeightChange={handleContentHeightChange}
          className="font-editor text-base leading-relaxed"
        />
      </Field>
    </div>
  )
}
