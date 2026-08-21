import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { useToastStore } from '@/components/UI/toast'
import { resetPersistenceState } from '@/lib/contentPersistence'
import type { BackupResultPayload, BackupStatus } from '@shared/types'

function getBackupApi(): {
  list?: () => Promise<{ path: string; createdAt: string }[]>
  status?: () => Promise<BackupStatus | null>
  create?: (name?: string) => Promise<BackupResultPayload>
  restore?: (path: string) => Promise<{ success: boolean; message?: string }>
} | null {
  const backup = window.electronAPI?.backup as
    | {
        list?: () => Promise<{ path: string; createdAt: string }[]>
        status?: () => Promise<BackupStatus | null>
        create?: (name?: string) => Promise<BackupResultPayload>
        restore?: (path: string) => Promise<{ success: boolean; message?: string }>
      }
    | undefined
  return backup ?? null
}

/**
 * Listen for backup:result (queued/awaited zips) and backup:willRestore (release handles).
 */
export function useBackupEvents(enabled: boolean): void {
  const setBackupWarningCount = useAppStore((s) => s.setBackupWarningCount)
  const setLastBackupAt = useAppStore((s) => s.setLastBackupAt)
  const closeProject = useAppStore((s) => s.closeProject)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    if (!enabled) return

    const unsubResult = window.electronAPI.on('backup:result', (data: unknown) => {
      const payload = data as BackupResultPayload | null | undefined
      if (!payload || typeof payload !== 'object') return
      if (payload.warnings?.length) {
        for (const w of payload.warnings) {
          addToast({
            title: w.title,
            description: w.message,
            variant: 'warning'
          })
        }
      }
      setBackupWarningCount(payload.unreachablePaths?.length ?? 0)
      if (payload.localBackupPath) {
        setLastBackupAt(new Date().toISOString())
      }
    })

    const unsubWillRestore = window.electronAPI.on('backup:willRestore', () => {
      resetPersistenceState()
      closeProject()
      void window.electronAPI.app.notifyRestoreReady?.()
    })

    return () => {
      unsubResult()
      unsubWillRestore()
    }
  }, [enabled, setBackupWarningCount, setLastBackupAt, closeProject, addToast])
}

/** Load last backup timestamp when a project opens. */
export function useBackupStatusHydration(enabled: boolean): void {
  const projectId = useAppStore((s) => s.projectId)
  const setLastBackupAt = useAppStore((s) => s.setLastBackupAt)
  const setBackupWarningCount = useAppStore((s) => s.setBackupWarningCount)

  useEffect(() => {
    if (!enabled || !projectId) return
    let cancelled = false

    const hydrate = async (): Promise<void> => {
      const api = getBackupApi()
      if (!api) return

      try {
        if (typeof api.status === 'function') {
          const status = await api.status()
          if (cancelled || !status) return
          const at = status.lastLocalBackupAt
          if (at && !Number.isNaN(Date.parse(at))) {
            setLastBackupAt(at)
          }
          setBackupWarningCount(
            status.destinations.filter((d) => !d.reachable || !d.writable).length
          )
          return
        }

        // Stale preload (only list) — still show last backup time if possible.
        if (typeof api.list === 'function') {
          const list = await api.list()
          if (cancelled || !list?.length) return
          const at = list[0]?.createdAt
          if (at && !Number.isNaN(Date.parse(at))) {
            setLastBackupAt(at)
          }
        }
      } catch (err) {
        console.error('[backup.status]', err)
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [enabled, projectId, setLastBackupAt, setBackupWarningCount])
}
