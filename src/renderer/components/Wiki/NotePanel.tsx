import { useCallback, useEffect } from 'react'
import { SpellCheckedInput, SpellCheckedTextarea } from '@/components/UI/spell-checked-field'
import { useAppStore } from '@/store/appStore'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { usePendingPanelRename } from '@/hooks/usePendingPanelRename'
import { markContentDirty, registerActiveNoteContent } from '@/lib/contentPersistence'
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
  const updateNodeInStore = useAppStore((s) => s.updateNodeInStore)
  const { inputRef: nameRef, handleFocus, handleBlur, handleKeyDown } =
    usePendingPanelRename(nodeId)
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId,
    title,
    metadata,
    metadataSource,
    nameInputRef: nameRef
  })

  useEffect(() => {
    registerActiveNoteContent(() => ({ nodeId, content }))
    return () => registerActiveNoteContent(null)
  }, [nodeId, content])

  const saveFields = useCallback(() => {
    onUpdate({
      metadata: meta,
      ...(name !== title ? { title: name } : {})
    })
  }, [meta, name, title, onUpdate])

  const handleBodyChange = (next: string): void => {
    updateNodeInStore(nodeId, { content: next })
    markContentDirty(nodeId, next)
  }

  return (
    <div className="space-y-4">
      <Field label="Title">
        <SpellCheckedInput
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={(e) => handleKeyDown(e, saveFields)}
          onBlur={() => {
            handleBlur()
            saveFields()
          }}
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
          onBlur={saveFields}
          placeholder="separate with ,"
        />
      </Field>
      <Field label="Content">
        <SpellCheckedTextarea
          measureKey={nodeId}
          value={content}
          onChange={(e) => handleBodyChange(e.target.value)}
          rows={3}
          className="font-serif text-base leading-relaxed"
        />
      </Field>
    </div>
  )
}
