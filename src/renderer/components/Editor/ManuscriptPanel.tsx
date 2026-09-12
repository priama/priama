import { useCallback, useLayoutEffect, useState } from 'react'
import { AutoGrowTextarea } from '@/components/UI/auto-grow-textarea'
import { PanelNameField } from '@/components/Wiki/PanelNameField'
import {
  ColorSwatchRow,
  DigitOnlyGoalInput,
  persistPlanningMeta
} from '@/components/Editor/ManuscriptCardBody'
import { usePanelNodeState } from '@/hooks/usePanelNodeState'
import { countNodeWords } from '@/lib/treeUtils'
import { useAppStore } from '@/store/appStore'
import { SYNOPSIS_SOFT_CHAR_HINT, planningMetaFor } from '@shared/manuscriptMeta'
import type { ChapterMeta, ManuscriptStatus, SceneMeta, TreeNode } from '@shared/types'
import { MANUSCRIPT_STATUSES } from '@shared/types'
import { cn } from '@/lib/utils'

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

const STATUS_LABELS: Record<ManuscriptStatus, string> = {
  outline: 'Outline',
  draft: 'Draft',
  revise: 'Revise',
  done: 'Done'
}

const STATUS_CHIP_CLASS: Record<ManuscriptStatus, string> = {
  outline: 'bg-muted text-muted-foreground',
  draft: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  revise: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  done: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
}

export function ManuscriptPanel({ node }: { node: TreeNode }): React.JSX.Element {
  const updateNodeInStore = useAppStore((s) => s.updateNodeInStore)
  const setDirty = useAppStore((s) => s.setDirty)
  const planning = planningMetaFor(node)
  const { meta, setMeta, name, setName } = usePanelNodeState({
    nodeId: node.id,
    title: node.title,
    metadata: planning,
    metadataSource: node.metadata
  })

  const [goalDraft, setGoalDraft] = useState(meta.wordGoal != null ? String(meta.wordGoal) : '')
  const persistTitle = useCallback(
    async (title: string): Promise<void> => {
      const trimmed = title.trim()
      if (!trimmed || trimmed === node.title) return
      const updated = await window.electronAPI.tree.update(node.id, { title: trimmed })
      updateNodeInStore(node.id, { title: updated.title })
      setDirty(true)
    },
    [node.id, node.title, setDirty, updateNodeInStore]
  )

  const persistFields = useCallback(
    (next: ChapterMeta | SceneMeta) => {
      setMeta(next)
      void persistPlanningMeta(node, {
        synopsis: next.synopsis,
        status: next.status,
        color: next.color,
        wordGoal: next.wordGoal
      })
    },
    [node, setMeta]
  )

  const save = useCallback(() => {
    void persistTitle(name)
    persistFields(meta)
  }, [meta, name, persistFields, persistTitle])

  const saveMetaOnly = useCallback(() => {
    persistFields(meta)
  }, [meta, persistFields])

  useLayoutEffect(() => {
    setGoalDraft(meta.wordGoal != null ? String(meta.wordGoal) : '')
  }, [meta.wordGoal, node.id])

  const commitGoal = (): void => {
    const trimmed = goalDraft.trim()
    let wordGoal: number | null = null
    if (trimmed) {
      const n = Number.parseInt(trimmed, 10)
      if (Number.isFinite(n) && n > 0) wordGoal = n
    }
    const next = { ...meta, wordGoal }
    setMeta(next)
    setGoalDraft(wordGoal != null ? String(wordGoal) : '')
    void persistPlanningMeta(node, { wordGoal })
  }

  const words = countNodeWords(node)

  return (
    <div className="space-y-4">
      <Field label="Title">
        <PanelNameField
          nodeId={node.id}
          name={name}
          setName={setName}
          onSave={(n) => {
            void persistTitle(n)
            persistFields(meta)
          }}
          onSaveMetaOnly={saveMetaOnly}
        />
      </Field>

      <Field label="Synopsis">
        <AutoGrowTextarea
          measureKey={`${node.id}-panel-synopsis`}
          rows={3}
          growCap={null}
          value={meta.synopsis}
          placeholder="Add synopsis"
          className="min-h-[4.5rem] resize-none overflow-y-auto text-sm"
          onChange={(e) => setMeta({ ...meta, synopsis: e.target.value })}
          onBlur={save}
        />
        {meta.synopsis.length > SYNOPSIS_SOFT_CHAR_HINT ? (
          <p className="text-xs text-muted-foreground">
            {meta.synopsis.length.toLocaleString()} characters — a bit long for a synopsis
          </p>
        ) : null}
      </Field>

      <Field label="Status">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              !meta.status ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
            )}
            onClick={() => {
              const next = { ...meta, status: '' as const }
              setMeta(next)
              void persistPlanningMeta(node, { status: '' })
            }}
          >
            None
          </button>
          {MANUSCRIPT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                meta.status === s ? STATUS_CHIP_CLASS[s] : 'bg-muted text-muted-foreground',
                meta.status === s && 'ring-1 ring-ring'
              )}
              onClick={() => {
                const next = { ...meta, status: s }
                setMeta(next)
                void persistPlanningMeta(node, { status: s })
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Color">
        <ColorSwatchRow
          color={meta.color}
          onChange={(color) => {
            const next = { ...meta, color }
            setMeta(next)
            void persistPlanningMeta(node, { color })
          }}
        />
      </Field>

      <Field label="Word goal">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{words.toLocaleString()} /</span>
          <DigitOnlyGoalInput
            value={goalDraft}
            onChange={setGoalDraft}
            onCommit={commitGoal}
            onCancel={() => setGoalDraft(meta.wordGoal != null ? String(meta.wordGoal) : '')}
            className="h-8 w-20 text-sm"
          />
          <span>words</span>
        </div>
      </Field>
    </div>
  )
}
