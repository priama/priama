import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { EditorPane } from '@/components/Editor/EditorPane'
import { EntityPanel } from '@/components/Wiki/EntityPanel'
import { StatusBar } from '@/components/UI/StatusBar'
import { ErrorBoundary } from '@/components/UI/ErrorBoundary'
import { ExportDialog } from '@/components/Export/ExportDialog'
import { BookSettingsModal } from '@/components/Settings/BookSettingsModal'
import { EditorAppearanceModal } from '@/components/Settings/EditorAppearanceModal'
import { RecentProjectsScreen } from '@/components/Project/RecentProjectsScreen'
import { QuitWarningModal } from '@/components/Project/QuitWarningModal'
import { BackupsModal } from '@/components/Project/BackupsModal'
import { Toaster } from '@/components/UI/toast'
import { useProject } from '@/hooks/useProject'
import { useStructuralUndoShortcuts } from '@/hooks/useStructuralUndoShortcuts'
import { useHistoryStore } from '@/store/historyStore'
import { useContentPersistence } from '@/hooks/useContentPersistence'
import { useBackupEvents, useBackupStatusHydration } from '@/hooks/useBackupEvents'
import { useNavigationSync, useNavigationSyncPublisher } from '@/hooks/useNavigationSync'
import { useProjectUiPersistence } from '@/hooks/useProjectUiPersistence'
import { useSyncFromMain, hydrateFromMain } from '@/hooks/useSync'
import { applyOpenProjectResult } from '@/lib/applyOpenProject'
import { usePreferencesSync } from '@/hooks/usePreferencesSync'
import { useFocusMode, useFocusChromeActive } from '@/hooks/useFocusMode'
import { useEditorAppearance } from '@/hooks/useEditorAppearance'
import { useProjectFind } from '@/hooks/useProjectFind'
import { useQuickOpen } from '@/hooks/useQuickOpen'
import { ProjectFindOverlay } from '@/components/Search/ProjectFindOverlay'
import { QuickOpenOverlay } from '@/components/Search/QuickOpenOverlay'
import { isWorkspaceWindow } from '@/lib/hashParams'
import { useSearchParams } from '@/lib/hashParams'
import {
  SIDEBAR_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  normalizeSidebarWidth,
  sidebarWidthOnProjectOpen
} from '@shared/types'
import { TITLEBAR_BUTTONS_INSET } from '@shared/windowChrome'
import { isMac } from '@/lib/platform'


export function AppLayout(): React.JSX.Element {
  // Select fields one by one: this component renders every panel, so a whole-store
  // subscription here would re-render the entire window on any store change.
  const isProjectOpen = useAppStore((s) => s.isProjectOpen)
  const showExportDialog = useAppStore((s) => s.showExportDialog)
  const showBookSettingsModal = useAppStore((s) => s.showBookSettingsModal)
  const showEditorAppearanceModal = useAppStore((s) => s.showEditorAppearanceModal)
  const showBackupsModal = useAppStore((s) => s.showBackupsModal)
  const setShowNewProjectModal = useAppStore((s) => s.setShowNewProjectModal)
  const setShowExportDialog = useAppStore((s) => s.setShowExportDialog)
  const setShowBookSettingsModal = useAppStore((s) => s.setShowBookSettingsModal)
  const setShowEditorAppearanceModal = useAppStore((s) => s.setShowEditorAppearanceModal)
  const setShowBackupsModal = useAppStore((s) => s.setShowBackupsModal)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setRightPanelWidth = useAppStore((s) => s.setRightPanelWidth)
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId)
  const params = useSearchParams()
  const isSecondary = isWorkspaceWindow()
  const { openProject, closeProject } = useProject()
  useStructuralUndoShortcuts()
  useContentPersistence(isProjectOpen && !isSecondary)
  useBackupEvents(!isSecondary)
  useBackupStatusHydration(isProjectOpen && !isSecondary)
  useProjectUiPersistence(isProjectOpen && !isSecondary)

  const [quitWarningPaths, setQuitWarningPaths] = useState<string[]>([])
  const [secondaryHydrated, setSecondaryHydrated] = useState(!isSecondary)

  useSyncFromMain()
  usePreferencesSync()
  useFocusMode()
  useProjectFind()
  useQuickOpen()
  useEditorAppearance()
  useNavigationSync()
  useNavigationSyncPublisher(isProjectOpen && !isSecondary)

  const focusChrome = useFocusChromeActive()

  useEffect(() => {
    if (!isSecondary) return
    const nodeId = params.get('nodeId')
    void hydrateFromMain().then(() => {
      if (nodeId) setSelectedNodeId(nodeId)
      setSecondaryHydrated(true)
    })
  }, [isSecondary, params, setSelectedNodeId])

  useEffect(() => {
    if (isSecondary) return
    void window.electronAPI.windows.getLayout().then((layout) => {
      if (!useAppStore.getState().isProjectOpen) {
        setSidebarWidth(
          sidebarWidthOnProjectOpen(
            normalizeSidebarWidth(layout.sidebarWidth ?? SIDEBAR_MAX_WIDTH),
            SIDEBAR_MAX_WIDTH
          )
        )
      }
      setRightPanelWidth(
        Math.min(
          RIGHT_PANEL_MAX_WIDTH,
          Math.max(RIGHT_PANEL_MIN_WIDTH, layout.rightPanelWidth ?? RIGHT_PANEL_MIN_WIDTH)
        )
      )
    })
  }, [isSecondary, setSidebarWidth, setRightPanelWidth])

  useEffect(() => {
    const unsubOpen = window.electronAPI.on('menu:openProject', () => openProject())
    const unsubNew = window.electronAPI.on('menu:newProject', () => {
      if (!isProjectOpen && !isSecondary) setShowNewProjectModal(true)
    })
    const unsubExport = window.electronAPI.on('menu:export', () => {
      if (isProjectOpen && !isSecondary) setShowExportDialog(true)
    })
    const unsubBackups = window.electronAPI.on('menu:backups', () => {
      if (isProjectOpen && !isSecondary) setShowBackupsModal(true)
    })
    const unsubCloseProject = window.electronAPI.on('menu:closeProject', () => {
      void closeProject()
    })
    const unsubDevicePreview = window.electronAPI.on('menu:devicePreview', () => {
      if (!isProjectOpen || isSecondary) return
      void window.electronAPI.windows.openDevicePreview({ scope: 'manuscript' })
    })
    const unsubToggleSidebar = window.electronAPI.on('menu:toggleSidebar', () => {
      if (!isProjectOpen || isSecondary) return
      toggleSidebar()
    })
    const unsubOpened = window.electronAPI.on('tomes:projectOpened', (data: unknown) => {
      if (isSecondary) return
      useHistoryStore.getState().clear()
      applyOpenProjectResult(
        data as {
          path: string
          meta: import('@shared/types').ProjectMeta
          nodes: import('@shared/types').TreeNode[]
          uiState: import('@shared/types').ProjectUiState
        }
      )
    })
    const unsubBeforeQuit = window.electronAPI.on('tomes:beforeQuit', (data: unknown) => {
      const { unreachableBackupPaths } = data as { unreachableBackupPaths: string[] }
      if (unreachableBackupPaths.length > 0) {
        setQuitWarningPaths(unreachableBackupPaths)
      }
    })
    return () => {
      unsubOpen()
      unsubNew()
      unsubExport()
      unsubBackups()
      unsubCloseProject()
      unsubDevicePreview()
      unsubToggleSidebar()
      unsubOpened()
      unsubBeforeQuit()
    }
  }, [
    openProject,
    closeProject,
    isSecondary,
    setShowNewProjectModal,
    setShowExportDialog,
    setShowBackupsModal,
    isProjectOpen,
    toggleSidebar
  ])

  if (isSecondary && !secondaryHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  if (!isProjectOpen) {
    return (
      <div className="launch-screen h-screen overflow-hidden bg-[var(--launch-bg)]">
        <RecentProjectsScreen />
        <Toaster />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <ErrorBoundary region="Sidebar">
          <div className={focusChrome ? 'hidden' : 'contents'}>
            <Sidebar />
          </div>
        </ErrorBoundary>
        <main className="drag-region flex flex-1 flex-col overflow-hidden bg-background">
          {focusChrome && isMac && (
            <div
              className="drag-region h-9 shrink-0"
              style={{ paddingLeft: TITLEBAR_BUTTONS_INSET }}
              aria-hidden
            />
          )}
          <ErrorBoundary region="Editor" fallbackClassName="flex-1">
            <EditorPane />
          </ErrorBoundary>
        </main>
        <ErrorBoundary region="Details Panel">
          <div className={focusChrome ? 'hidden' : 'contents'}>
            <EntityPanel />
          </div>
        </ErrorBoundary>
      </div>
      <div className={focusChrome ? 'hidden' : 'contents'}>
        <ErrorBoundary region="Status Bar">
          <StatusBar />
        </ErrorBoundary>
      </div>
      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} />
      <BookSettingsModal open={showBookSettingsModal} onOpenChange={setShowBookSettingsModal} />
      <EditorAppearanceModal
        open={showEditorAppearanceModal}
        onOpenChange={setShowEditorAppearanceModal}
      />
      <ProjectFindOverlay />
      <QuickOpenOverlay />
      {showBackupsModal ? (
        <ErrorBoundary region="Backups">
          <BackupsModal open={showBackupsModal} onOpenChange={setShowBackupsModal} />
        </ErrorBoundary>
      ) : null}
      <Toaster />
      {!isSecondary && (
        <QuitWarningModal
          open={quitWarningPaths.length > 0}
          unreachablePaths={quitWarningPaths}
          onCancel={() => setQuitWarningPaths([])}
          onQuitAnyway={async () => {
            setQuitWarningPaths([])
            await window.electronAPI.tomes.forceQuit()
          }}
        />
      )}
    </div>
  )
}
