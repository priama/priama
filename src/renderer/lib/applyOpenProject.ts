import { useAppStore } from '@/store/appStore'
import { publishNavigationSyncAsync } from '@/lib/navigationSync'
import {
  beginUiRestore,
  markUiRestoreComplete,
  resolveProjectUiOnOpen
} from '@/lib/projectUiState'
import type { OpenProjectResult } from '@shared/types'
import { setSpellCheckLang } from '@/lib/spellCheck'

export async function applyOpenProjectResult(result: OpenProjectResult): Promise<void> {
  setSpellCheckLang(result.meta.spellCheckLang ?? 'en')
  beginUiRestore()
  const categories = result.meta.categories ?? []
  useAppStore.getState().setProject(result.path, result.meta, result.nodes)
  resolveProjectUiOnOpen(result.uiState, result.nodes, categories)
  await publishNavigationSyncAsync()
  markUiRestoreComplete()
  useAppStore.getState().setLastSaved(result.meta.updatedAt)
}
