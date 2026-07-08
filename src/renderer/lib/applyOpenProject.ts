import { useAppStore } from '@/store/appStore'
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
