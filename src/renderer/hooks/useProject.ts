import { useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import { useToastStore } from '@/components/UI/toast'
import { flushAllDirty, flushAndSaveProject, resetPersistenceState } from '@/lib/contentPersistence'
import { applyOpenProjectResult } from '@/lib/applyOpenProject'
import { runWithNavigationPublishSuppressed } from '@/lib/navigationSync'
import { flushProjectUiState } from '@/hooks/useProjectUiPersistence'
import type { CreateProjectInput } from '@shared/types'
import { defaultFictionCategories } from '@shared/categoryPresets'

export function useProject(): {
  createProjectFromInput: (
    input: Omit<CreateProjectInput, 'templateId' | 'categories'> &
      Partial<Pick<CreateProjectInput, 'templateId' | 'categories'>>
  ) => Promise<void>
  openProject: () => Promise<void>
  openProjectAtPath: (path: string) => Promise<void>
  saveProject: () => Promise<void>
  loadNodes: () => Promise<void>
  closeProject: () => Promise<void>
  removeFromRecent: (id: string) => Promise<void>
  renameRecentProject: (id: string, title: string) => Promise<void>
  locateProject: (projectId: string) => Promise<void>
} {
  const {
    setProject,
    closeProject: closeProjectStore,
    setNodes,
    setLastSaved,
    setSelectedNodeId,
    setBackupWarningCount
  } = useAppStore()
  const addToast = useToastStore((s) => s.addToast)

  const selectFirstNode = useCallback(
    (nodes: import('@shared/types').TreeNode[]) => {
      const chapters = nodes.filter((n) => n.type === 'chapter').sort((a, b) => a.sortOrder - b.sortOrder)
      if (chapters.length > 0) {
        const firstChapter = chapters[0]
        const scenes = nodes
          .filter((n) => n.parentId === firstChapter.id && n.type === 'scene')
          .sort((a, b) => a.sortOrder - b.sortOrder)
        setSelectedNodeId(scenes[0]?.id ?? firstChapter.id)
      }
    },
    [setSelectedNodeId]
  )

  const applySaveResult = useCallback(
    (result: import('@shared/types').SaveResult) => {
      if (result.success) {
        setLastSaved(result.lastSaved)
      }
      if (result.backupWarnings?.length) {
        for (const w of result.backupWarnings) {
          addToast(w.message, 'warning')
        }
      }
      if (result.unreachableBackupPaths?.length) {
        setBackupWarningCount(result.unreachableBackupPaths.length)
      } else {
        setBackupWarningCount(0)
      }
    },
    [setLastSaved, addToast, setBackupWarningCount]
  )

  const loadNodes = useCallback(async () => {
    const nodes = await window.electronAPI.tree.getAll()
    setNodes(nodes)
    selectFirstNode(nodes)
  }, [setNodes, selectFirstNode])

  const openProjectAtPath = useCallback(
    async (path: string) => {
      try {
        await flushAllDirty()
        useHistoryStore.getState().clear()
        const result = await window.electronAPI.tomes.openProject(path)
        await applyOpenProjectResult(result)
        setBackupWarningCount(0)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not open project'
        addToast(message, 'warning')
        throw err
      }
    },
    [setBackupWarningCount, addToast]
  )

  const createProjectFromInput = useCallback(
    async (input: CreateProjectInput) => {
      await flushAllDirty()
      useHistoryStore.getState().clear()
      const result = await window.electronAPI.tomes.createProject({
        ...input,
        templateId: input.templateId ?? 'fiction',
        categories: input.categories ?? defaultFictionCategories()
      })
      const openResult = await window.electronAPI.tomes.openProject(result.path)
      await applyOpenProjectResult(openResult)
    },
    []
  )

  const openProject = useCallback(async () => {
    const path = await window.electronAPI.dialog.openTomes()
    if (!path) return
    await openProjectAtPath(path)
  }, [openProjectAtPath])

  const saveProject = useCallback(async () => {
    const result = await flushAndSaveProject()
    applySaveResult(result)
  }, [applySaveResult])

  const closeProject = useCallback(async () => {
    if (!useAppStore.getState().isProjectOpen) return

    try {
      await flushAllDirty()
    } catch (err) {
      console.error('Failed to flush before close:', err)
      addToast('Could not save all changes before closing.', 'warning')
    }

    try {
      await flushProjectUiState()
    } catch (err) {
      console.error('Failed to save UI state before close:', err)
    }

    resetPersistenceState()
    runWithNavigationPublishSuppressed(() => {
      closeProjectStore()
    })
    useHistoryStore.getState().clear()

    try {
      const result = await window.electronAPI.tomes.saveProject()
      applySaveResult(result)
    } catch (err) {
      console.error('Save failed on close:', err)
      addToast('Project could not be fully saved before closing.', 'warning')
    }

    try {
      await window.electronAPI.tomes.closeProject()
    } catch (err) {
      console.error('Close project failed:', err)
      addToast('Could not finish closing the project.', 'warning')
    }
  }, [closeProjectStore, addToast, applySaveResult])

  const removeFromRecent = useCallback(async (id: string) => {
    await window.electronAPI.tomes.removeFromRecent(id)
  }, [])

  const renameRecentProject = useCallback(async (id: string, title: string) => {
    await window.electronAPI.tomes.renameRecentProject(id, title)
  }, [])

  const locateProject = useCallback(
    async (id: string) => {
      const path = await window.electronAPI.dialog.openTomes()
      if (!path) return
      await window.electronAPI.tomes.updateRecentPath(id, path)
      await openProjectAtPath(path)
    },
    [openProjectAtPath]
  )

  return {
    createProjectFromInput,
    openProject,
    openProjectAtPath,
    saveProject,
    loadNodes,
    closeProject,
    removeFromRecent,
    renameRecentProject,
    locateProject
  }
}
