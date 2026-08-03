import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { useToastStore } from '@/components/UI/toast'
import {
  AUTOSAVE_INTERVAL_MS,
  flushAllDirty,
  flushAndSaveProject,
  flushNode,
  hasUnpersistedChanges,
  resetPersistenceState
} from '@/lib/contentPersistence'
import type { SaveResult } from '@shared/types'

function applySaveResult(
  result: SaveResult,
  setLastSaved: (timestamp: string) => void,
  setBackupWarningCount: (count: number) => void,
  addToast: (input: { title: string; description?: string; variant?: 'warning' }) => void
): void {
  if (result.success) {
    setLastSaved(result.lastSaved)
  }
  if (result.backupWarnings?.length) {
    for (const w of result.backupWarnings) {
      addToast({
        title: w.title,
        description: w.message,
        variant: 'warning'
      })
    }
  }
  setBackupWarningCount(result.unreachableBackupPaths?.length ?? 0)
}

export function useContentPersistence(enabled: boolean): {
  saveProject: () => Promise<void>
} {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const selectedEntityId = useAppStore((s) => s.selectedEntityId)
  const projectId = useAppStore((s) => s.projectId)
  const setLastSaved = useAppStore((s) => s.setLastSaved)
  const setBackupWarningCount = useAppStore((s) => s.setBackupWarningCount)
  const addToast = useToastStore((s) => s.addToast)
  const prevNodeIdRef = useRef<string | null>(null)
  const prevEntityIdRef = useRef<string | null>(null)

  const saveProject = useCallback(async () => {
    try {
      const result = await flushAndSaveProject()
      applySaveResult(result, setLastSaved, setBackupWarningCount, addToast)
    } catch (err) {
      console.error('Save failed:', err)
    }
  }, [setLastSaved, setBackupWarningCount, addToast])

  useEffect(() => {
    resetPersistenceState()
  }, [projectId])

  useEffect(() => {
    if (!enabled) return

    const prev = prevNodeIdRef.current
    prevNodeIdRef.current = selectedNodeId

    if (prev && prev !== selectedNodeId) {
      void flushNode(prev)
    }
  }, [enabled, selectedNodeId])

  useEffect(() => {
    if (!enabled) return

    const prev = prevEntityIdRef.current
    prevEntityIdRef.current = selectedEntityId

    if (prev && prev !== selectedEntityId) {
      void flushNode(prev)
    }
  }, [enabled, selectedEntityId])

  useEffect(() => {
    if (!enabled) return

    const unsubSave = window.electronAPI.on('menu:save', () => {
      void saveProject()
    })
    return unsubSave
  }, [enabled, saveProject])

  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => {
      if (!hasUnpersistedChanges()) return
      void saveProject()
    }, AUTOSAVE_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [enabled, saveProject])

  useEffect(() => {
    if (!enabled) return

    const unsubFlush = window.electronAPI.on('app:requestFlush', () => {
      void flushAllDirty().then(() => window.electronAPI.app.notifyFlushComplete())
    })
    return unsubFlush
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const onBeforeUnload = () => {
      void flushAllDirty()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void saveProject()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, saveProject])

  return { saveProject }
}
