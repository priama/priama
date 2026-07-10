import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { setsChanged } from '@/lib/setChange'
import { captureProjectUiState, isUiRestoreInProgress } from '@/lib/projectUiState'

const DEBOUNCE_MS = 500

let sharedTimer: ReturnType<typeof setTimeout> | null = null

export async function flushProjectUiState(): Promise<void> {
  if (sharedTimer) {
    clearTimeout(sharedTimer)
    sharedTimer = null
  }
  if (isUiRestoreInProgress()) return
  if (!useAppStore.getState().isProjectOpen) return
  await window.electronAPI.tomes.updateUiState(captureProjectUiState())
}

function navigationChanged(
  state: ReturnType<typeof useAppStore.getState>,
  prev: ReturnType<typeof useAppStore.getState>
): boolean {
  if (state.selectedNodeId !== prev.selectedNodeId) return true
  if (state.selectedContainerId !== prev.selectedContainerId) return true
  if (state.selectedEntityId !== prev.selectedEntityId) return true
  if (state.selectedEntityType !== prev.selectedEntityType) return true
  if (state.selectedEntryId !== prev.selectedEntryId) return true
  if (state.selectedEntryCategoryId !== prev.selectedEntryCategoryId) return true
  if (state.rightPanelOpen !== prev.rightPanelOpen) return true
  if (state.sectionOrder.length !== prev.sectionOrder.length) return true
  if (state.sectionOrder.some((v, i) => v !== prev.sectionOrder[i])) return true
  if (setsChanged(state.expandedSections, prev.expandedSections)) return true
  if (containerViewModesChanged(state.containerViewModes, prev.containerViewModes)) return true
  return false
}

function containerViewModesChanged(
  next: Record<string, string>,
  prev: Record<string, string>
): boolean {
  const nextKeys = Object.keys(next)
  const prevKeys = Object.keys(prev)
  if (nextKeys.length !== prevKeys.length) return true
  return nextKeys.some((key) => next[key] !== prev[key])
}

export function useProjectUiPersistence(enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const flush = (): void => {
      if (isUiRestoreInProgress()) return
      if (!useAppStore.getState().isProjectOpen) return
      void window.electronAPI.tomes.updateUiState(captureProjectUiState())
    }

    const schedule = (): void => {
      if (isUiRestoreInProgress()) return
      if (timerRef.current) clearTimeout(timerRef.current)
      if (sharedTimer) clearTimeout(sharedTimer)
      const timer = setTimeout(() => {
        timerRef.current = null
        sharedTimer = null
        flush()
      }, DEBOUNCE_MS)
      timerRef.current = timer
      sharedTimer = timer
    }

    const unsub = useAppStore.subscribe((state, prev) => {
      if (!state.isProjectOpen) return
      if (navigationChanged(state, prev)) {
        schedule()
      }
    })

    return () => {
      unsub()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        if (sharedTimer === timerRef.current) sharedTimer = null
      }
    }
  }, [enabled])
}
