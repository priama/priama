import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { setsChanged } from '@/lib/setChange'
import { applyNavigationSync, getNavigationSnapshot, publishNavigationSync } from '@/lib/navigationSync'
import { isUiRestoreInProgress } from '@/lib/projectUiState'
import type { NavigationSyncState } from '@shared/types'

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
  if (state.manuscriptInfoNodeId !== prev.manuscriptInfoNodeId) return true
  if (state.rightPanelOpen !== prev.rightPanelOpen) return true
  if (state.sectionOrder.length !== prev.sectionOrder.length) return true
  if (state.sectionOrder.some((v, i) => v !== prev.sectionOrder[i])) return true
  if (setsChanged(state.expandedSections, prev.expandedSections)) return true
  return false
}

async function hydrateNavigationFromMain(): Promise<void> {
  const nav = await window.electronAPI.navigation.get()
  const current = getNavigationSnapshot()
  const isProjectOpen = useAppStore.getState().isProjectOpen

  // Avoid overwriting a selection the user (or project open) already made while this fetch was in flight.
  const hasLocalSelection =
    current.selectedEntityId !== null ||
    current.selectedNodeId !== null ||
    current.selectedContainerId !== null ||
    current.selectedEntryId !== null ||
    current.manuscriptInfoNodeId != null

  if (isProjectOpen || hasLocalSelection) {
    if (
      current.selectedEntityId !== nav.selectedEntityId ||
      current.selectedNodeId !== nav.selectedNodeId ||
      current.selectedContainerId !== nav.selectedContainerId ||
      (current.selectedEntryId ?? null) !== (nav.selectedEntryId ?? null) ||
      (current.selectedEntryCategoryId ?? null) !== (nav.selectedEntryCategoryId ?? null) ||
      (current.manuscriptInfoNodeId ?? null) !== (nav.manuscriptInfoNodeId ?? null) ||
      current.rightPanelOpen !== nav.rightPanelOpen ||
      setsChanged(new Set(current.expandedSections), new Set(nav.expandedSections))
    ) {
      publishNavigationSync()
    }
    return
  }

  applyNavigationSync(nav)
}

export function useNavigationSync(options?: { skipInitialFetch?: boolean }): void {
  useEffect(() => {
    if (!options?.skipInitialFetch) {
      void hydrateNavigationFromMain()
    }

    const unsub = window.electronAPI.on('sync:navigation', (data: unknown) => {
      applyNavigationSync(data as NavigationSyncState)
    })

    return unsub
  }, [options?.skipInitialFetch])
}

export function useNavigationSyncPublisher(
  enabled: boolean,
  options?: { publishOnMount?: boolean }
): void {
  const publishOnMount = options?.publishOnMount ?? true

  useEffect(() => {
    if (!enabled) return

    if (publishOnMount) {
      publishNavigationSync()
    }

    return useAppStore.subscribe((state, prev) => {
      if (!state.isProjectOpen) return
      if (isUiRestoreInProgress()) return
      if (navigationChanged(state, prev)) {
        publishNavigationSync()
      }
    })
  }, [enabled, publishOnMount])
}
