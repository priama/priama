import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { mergeIncomingNodes, resetPersistenceState } from '@/lib/contentPersistence'

export function useSyncFromMain(): void {
  useEffect(() => {
    const unsub = window.electronAPI.on('sync:state', (data: unknown) => {
      const state = data as {
        path: string | null
        meta: import('@shared/types').ProjectMeta | null
        nodes: import('@shared/types').TreeNode[]
        uiState: import('@shared/types').ProjectUiState
      }
      if (state.meta && state.path) {
        useAppStore
          .getState()
          .applySyncState(state.path, state.meta, mergeIncomingNodes(state.nodes))
        useAppStore.getState().setSectionOrder(state.uiState.sectionOrder)
      } else if (useAppStore.getState().isProjectOpen) {
        useAppStore.getState().closeProject()
        resetPersistenceState()
      }
    })
    return unsub
  }, [])
}

export async function hydrateFromMain(): Promise<void> {
  const state = await window.electronAPI.tomes.getSyncState()
  if (state.meta && state.path) {
    // No merge here: runs at window startup before any local edits exist.
    useAppStore.getState().setProject(state.path, state.meta, state.nodes)
    useAppStore.getState().setSectionOrder(state.uiState.sectionOrder)
    useAppStore.getState().setLastSaved(state.meta.updatedAt)
  }
}
