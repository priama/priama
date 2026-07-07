import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import { flushAllDirty } from '@/lib/contentPersistence'
import { publishNavigationSyncAsync } from '@/lib/navigationSync'
import {
  beginUiRestore,
  markUiRestoreComplete,
  resolveProjectUiOnOpen
} from '@/lib/projectUiState'
import type { ProjectMeta, ProjectUiState, TreeNode } from '@shared/types'

export interface OpenProjectResult {
  path: string
  meta: ProjectMeta
  nodes: TreeNode[]
  uiState: ProjectUiState
}

export async function applyOpenProjectResult(result: OpenProjectResult): Promise<void> {
  beginUiRestore()
  const categories = result.meta.categories ?? []
  useAppStore.getState().setProject(result.path, result.meta, result.nodes)
  resolveProjectUiOnOpen(result.uiState, result.nodes, categories)
  await publishNavigationSyncAsync()
  markUiRestoreComplete()
  useAppStore.getState().setLastSaved(result.meta.updatedAt)
}

export async function openProjectAtPathWithLockCheck(
  path: string,
  options?: { skipLockPeek?: boolean }
): Promise<void> {
  if (!options?.skipLockPeek) {
    const { existingLock } = await window.electronAPI.tomes.peekProjectLock(path)
    if (existingLock) {
      const openedAt = new Date(existingLock.openedAt).toLocaleString()
      const proceed = window.confirm(
        `This project may already be open elsewhere (opened on ${existingLock.hostname} at ${openedAt}). Open anyway?`
      )
      if (!proceed) return
    }
  }

  const result = await window.electronAPI.tomes.openProject(path)
  await applyOpenProjectResult(result)
}

export async function openProjectAtPath(path: string, options?: { skipLockPeek?: boolean }): Promise<void> {
  await flushAllDirty()
  useHistoryStore.getState().clear()
  await openProjectAtPathWithLockCheck(path, options)
}
