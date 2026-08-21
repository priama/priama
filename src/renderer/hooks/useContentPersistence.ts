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

export function useContentPersistence(enabled: boolean): {
  saveProject: () => Promise<void>
} {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const selectedEntityId = useAppStore((s) => s.selectedEntityId)
  const projectId = useAppStore((s) => s.projectId)
  const setLastSaved = useAppStore((s) => s.setLastSaved)
  const addToast = useToastStore((s) => s.addToast)
  const prevNodeIdRef = useRef<string | null>(null)
  const prevEntityIdRef = useRef<string | null>(null)

  const saveProject = useCallback(async () => {
    try {
      const result = await flushAndSaveProject('explicit')
      if (result.success) {
        setLastSaved(result.lastSaved)
      }
      // Backup warnings arrive via backup:result for queued zips; awaited paths also broadcast.
      if (result.backupWarnings?.length) {
        for (const w of result.backupWarnings) {
          addToast({
            title: w.title,
            description: w.message,
            variant: 'warning'
          })
        }
      }
    } catch (err) {
      console.error('Save failed:', err)
    }
  }, [setLastSaved, addToast])

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
      void flushAndSaveProject('autosave').then((result) => {
        if (result.success) setLastSaved(result.lastSaved)
      })
    }, AUTOSAVE_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [enabled, setLastSaved])

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
