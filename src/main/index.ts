import { app, BrowserWindow, ipcMain, Menu, shell, dialog, nativeTheme } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import {
  createProject,
  openProject,
  closeProject,
  getProjectMeta,
  updateProjectMeta,
  getAllNodes,
  getNode,
  createNode,
  createFolder,
  updateNode,
  deleteNode,
  moveToTrash,
  restoreNode,
  permanentDelete,
  reorderNodes,
  getEntityNodes,
  getProjectPath,
  getProjectRootPath,
  isOpen,
  saveProject,
  getRecentProjectsWithStatus,
  renameRecentProject,
  updateUiState,
  createChapter,
  getSyncState,
  importCharacterImage,
  importEntityImage,
  importEntityGalleryImage,
  deleteEntityImage,
  updateBookSettings,
  updateCategories,
  importCoverImage,
  deleteProject,
  createManualBackup,
  writeProjectManifest
} from './tomes/projectStore'
import { validateTomesFile } from './tomes/validate'
import {
  showOpenTomesDialog,
  showChooseFolderDialog,
  showSelectBackupZipDialog,
  showSelectImageDialog,
  showSelectDocxDialog,
  showSaveExportDialog
} from './fileSystem'
import {
  checkBackupLocations,
  getBackupStatus,
  importBackupAsProject,
  inspectBackupZip,
  listLocalBackups,
  restoreProjectFromBackup,
  toBackupResultPayload
} from './tomes/backup'
import {
  getConfig,
  removeFromRecent,
  setBackupLocations,
  getBackupLocations,
  updatePreferences,
  updateRecentPrimaryPath,
  updateWindowLayout,
  getWindowLayout
} from './config'
import {
  setMainWindow,
  openDocumentWindow,
  openImageViewerWindow,
  openDevicePreviewWindow,
  broadcast,
  saveSecondaryWindowState,
  closeAllChildren,
  titleBarOptions
} from './windowManager'
import {
  getNavigationState,
  setNavigationState,
  resetNavigationState
} from './navigationState'
import { registerAssetScheme, registerAssetProtocol } from './assetProtocol'
import { exportDocument } from './export'
import { parseDocxFile } from './import/parseDocx'
import { generatePreviewEpub } from './tomes/preview/generatePreviewEpub'
import { checkForAppUpdate } from './appUpdate'
import type {
  AppUpdateStatus,
  BookSettings,
  CategoryDefinition,
  CreateProjectInput,
  DevicePreviewRequestOptions,
  EntityHighlights,
  ExportOptions,
  NavigationSyncState,
  NodeType,
  TypewriterScrolling,
  WritingMenuState
} from '@shared/types'

let mainWindow: BrowserWindow | null = null
let pendingOpenPath: string | null = null
let isQuitting = false
let appUpdateStatus: AppUpdateStatus = {
  state: 'idle',
  currentVersion: app.getVersion()
}
let appUpdateCheckPromise: Promise<AppUpdateStatus> | null = null

/**
 * Menu actions the in-app menu may fire. Windows has no menu bar, so the app
 * draws its own; this is the allowlist for that bridge, kept in step with
 * buildMenu below.
 */
const MAIN_WINDOW_MENU_CHANNELS = new Set([
  'menu:newProject',
  'menu:openProject',
  'menu:devicePreview'
])

const IN_APP_MENU_CHANNELS = new Set([
  ...MAIN_WINDOW_MENU_CHANNELS,
  'menu:save',
  'menu:backups',
  'menu:export',
  'menu:closeProject',
  'menu:undo',
  'menu:redo',
  'menu:quickOpen',
  'menu:findInProject',
  'menu:splitDocument',
  'menu:mergeWithNext',
  'menu:toggleSidebar',
  'menu:toggleFocusMode',
  'menu:setTypewriterScrolling',
  'menu:setEntityHighlights',
  'menu:editorAppearance',
  'menu:editorSize'
])

let writingMenuState: WritingMenuState = {
  focusMode: false,
  focusModeEnabled: false,
  typewriterScrolling: 'focus',
  entityHighlights: 'hide-in-focus',
  canSplitDocument: false,
  canMergeWithNext: false,
  sidebarVisible: true,
  sidebarEnabled: false
}

function aliveWindow(win: BrowserWindow | null | undefined): BrowserWindow | null {
  if (!win || win.isDestroyed()) return null
  try {
    if (win.webContents.isDestroyed()) return null
  } catch {
    return null
  }
  return win
}

function sendToWindow(win: BrowserWindow | null | undefined, channel: string, ...args: unknown[]): void {
  const alive = aliveWindow(win)
  if (!alive) return
  alive.webContents.send(channel, ...args)
}

function publishAppUpdateStatus(): void {
  try {
    buildMenu()
  } catch (err) {
    console.error('[app-update-menu]', err)
  }
  broadcast('app:updateStatus', appUpdateStatus)
}

async function refreshAppUpdateStatus(): Promise<AppUpdateStatus> {
  if (appUpdateCheckPromise) return appUpdateCheckPromise

  const currentVersion = app.getVersion()
  appUpdateStatus = {
    state: 'checking',
    currentVersion
  }
  publishAppUpdateStatus()

  const checkPromise = checkForAppUpdate(currentVersion)
    .then((status) => {
      appUpdateStatus = status
      publishAppUpdateStatus()
      return status
    })
    .finally(() => {
      appUpdateCheckPromise = null
    })

  appUpdateCheckPromise = checkPromise
  return checkPromise
}

async function openLatestAppDownload(): Promise<{ success: boolean }> {
  if (appUpdateStatus.state !== 'available' || !appUpdateStatus.downloadUrl) {
    return { success: false }
  }

  try {
    await shell.openExternal(appUpdateStatus.downloadUrl)
    return { success: true }
  } catch (err) {
    console.error('[app-update-open]', err)
    return { success: false }
  }
}

// Keep `npm run dev` / rundev.py off the installed app's single-instance lock
// and userData. Must run before requestSingleInstanceLock().
if (!app.isPackaged || process.env.PRIAMA_DEV === '1') {
  app.setName('Priama Dev')
  app.setPath('userData', join(app.getPath('appData'), 'priama-dev'))
}

const gotLock = app.requestSingleInstanceLock()

registerAssetScheme()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    try {
      const tomesPath = findTomesPathInArgv(argv)
      if (tomesPath) pendingOpenPath = tomesPath

      let win = aliveWindow(mainWindow)
      if (!win) {
        // Window was closed but the app stayed alive (common on macOS).
        createWindow()
        win = aliveWindow(mainWindow)
      }
      if (!win) return

      if (tomesPath) void openProjectFromPath(tomesPath)
      if (win.isMinimized()) win.restore()
      win.focus()
    } catch (err) {
      console.error('[second-instance]', err)
    }
  })
}

function findTomesPathInArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.endsWith('.tomes') && !arg.startsWith('-')) {
      return arg
    }
  }
  return null
}

function broadcastSync(except?: Electron.WebContents): void {
  broadcast('sync:state', getSyncState(), except)
}

async function openProjectFromPath(tomesPath: string): Promise<void> {
  const validation = await validateTomesFile(tomesPath)
  if (!validation.valid) {
    dialog.showErrorBox('Invalid Project', validation.error ?? 'Could not open project file')
    return
  }

  try {
    const result = await openProject(tomesPath)
    sendToWindow(mainWindow, 'tomes:projectOpened', result)
  } catch (err) {
    dialog.showErrorBox(
      'Open Failed',
      err instanceof Error ? err.message : 'Could not open project'
    )
  }
}

function applyNativeTheme(theme: 'light' | 'dark'): void {
  nativeTheme.themeSource = theme
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    ...titleBarOptions(),
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    const win = aliveWindow(mainWindow)
    win?.show()
    if (pendingOpenPath) {
      const path = pendingOpenPath
      pendingOpenPath = null
      void openProjectFromPath(path)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    setMainWindow(null)
  })

  setMainWindow(mainWindow)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function sendToFocusedWindow(channel: string, ...args: unknown[]): void {
  const win = aliveWindow(BrowserWindow.getFocusedWindow()) ?? aliveWindow(mainWindow)
  sendToWindow(win, channel, ...args)
}

function applyWritingMenuState(state: WritingMenuState): void {
  writingMenuState = state
  try {
    const menu = Menu.getApplicationMenu()
    if (!menu) return

    const focusItem = menu.getMenuItemById('focus-mode')
    if (focusItem) {
      focusItem.checked = state.focusMode
      focusItem.enabled = state.focusModeEnabled
    }

    const typewriterIds: Record<TypewriterScrolling, string> = {
      off: 'typewriter-off',
      on: 'typewriter-on',
      focus: 'typewriter-focus'
    }
    for (const [value, id] of Object.entries(typewriterIds)) {
      const item = menu.getMenuItemById(id)
      if (item) item.checked = state.typewriterScrolling === value
    }

    const highlightIds: Record<EntityHighlights, string> = {
      on: 'highlights-on',
      off: 'highlights-off',
      'hide-in-focus': 'highlights-hide-in-focus'
    }
    for (const [value, id] of Object.entries(highlightIds)) {
      const item = menu.getMenuItemById(id)
      if (item) item.checked = state.entityHighlights === value
    }

    const splitItem = menu.getMenuItemById('split-document')
    if (splitItem) splitItem.enabled = state.canSplitDocument
    const mergeItem = menu.getMenuItemById('merge-with-next')
    if (mergeItem) mergeItem.enabled = state.canMergeWithNext
    const sidebarItem = menu.getMenuItemById('sidebar')
    if (sidebarItem) {
      sidebarItem.checked = state.sidebarVisible
      sidebarItem.enabled = state.sidebarEnabled
    }
  } catch {
    // Menu torn down during quit / reload.
  }
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            {
              label: `Update to ${appUpdateStatus.latestVersion ?? 'Latest Version'}…`,
              visible: appUpdateStatus.state === 'available',
              click: () => {
                void openLatestAppDownload()
              }
            },
            {
              label:
                appUpdateStatus.state === 'checking'
                  ? 'Checking for Updates…'
                  : 'Check for Updates…',
              enabled: appUpdateStatus.state !== 'checking',
              click: () => {
                void refreshAppUpdateStatus()
              }
            },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ]
        }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToWindow(mainWindow, 'menu:newProject')
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToWindow(mainWindow, 'menu:openProject')
        },
        // Windows and Linux reach this from the New Project modal instead.
        ...(isMac
          ? [{
              label: 'Restore from Backup…',
              click: () => sendToWindow(mainWindow, 'menu:restoreBackup')
            }]
          : []),
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToWindow(mainWindow, 'menu:save')
        },
        {
          label: 'Backups…',
          click: () => sendToWindow(mainWindow, 'menu:backups')
        },
        {
          label: 'Export…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendToWindow(mainWindow, 'menu:export')
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            sendToFocusedWindow('menu:closeProject')
          }
        },
        { type: 'separator' },
        isMac
          ? { role: 'close' as const, registerAccelerator: false }
          : { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToFocusedWindow('menu:undo')
        },
        {
          label: 'Redo',
          accelerator: 'Shift+CmdOrCtrl+Z',
          click: () => sendToFocusedWindow('menu:redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Quick Open…',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendToFocusedWindow('menu:quickOpen')
        },
        {
          label: 'Find in Project',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => sendToFocusedWindow('menu:findInProject')
        },
        { type: 'separator' },
        {
          id: 'split-document',
          label: 'Split Document',
          accelerator: 'CmdOrCtrl+\\',
          enabled: writingMenuState.canSplitDocument,
          click: () => sendToFocusedWindow('menu:splitDocument')
        },
        {
          id: 'merge-with-next',
          label: 'Merge with Next',
          accelerator: 'Alt+CmdOrCtrl+M',
          enabled: writingMenuState.canMergeWithNext,
          click: () => sendToFocusedWindow('menu:mergeWithNext')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          id: 'sidebar',
          label: 'Sidebar',
          type: 'checkbox',
          accelerator: 'Alt+CmdOrCtrl+1',
          checked: writingMenuState.sidebarVisible,
          enabled: writingMenuState.sidebarEnabled,
          click: () => sendToFocusedWindow('menu:toggleSidebar')
        },
        { type: 'separator' },
        {
          id: 'focus-mode',
          label: 'Focus Mode',
          type: 'checkbox',
          accelerator: 'Alt+CmdOrCtrl+F',
          checked: writingMenuState.focusMode,
          enabled: writingMenuState.focusModeEnabled,
          click: () => sendToFocusedWindow('menu:toggleFocusMode')
        },
        { type: 'separator' },
        {
          label: 'Typewriter Scrolling',
          submenu: [
            {
              id: 'typewriter-off',
              label: 'Off',
              type: 'radio',
              checked: writingMenuState.typewriterScrolling === 'off',
              click: () => sendToFocusedWindow('menu:setTypewriterScrolling', 'off')
            },
            {
              id: 'typewriter-on',
              label: 'On',
              type: 'radio',
              checked: writingMenuState.typewriterScrolling === 'on',
              click: () => sendToFocusedWindow('menu:setTypewriterScrolling', 'on')
            },
            {
              id: 'typewriter-focus',
              label: 'In Focus Mode',
              type: 'radio',
              checked: writingMenuState.typewriterScrolling === 'focus',
              click: () => sendToFocusedWindow('menu:setTypewriterScrolling', 'focus')
            }
          ]
        },
        {
          label: 'Entity Highlights',
          submenu: [
            {
              id: 'highlights-on',
              label: 'On',
              type: 'radio',
              checked: writingMenuState.entityHighlights === 'on',
              click: () => sendToFocusedWindow('menu:setEntityHighlights', 'on')
            },
            {
              id: 'highlights-off',
              label: 'Off',
              type: 'radio',
              checked: writingMenuState.entityHighlights === 'off',
              click: () => sendToFocusedWindow('menu:setEntityHighlights', 'off')
            },
            {
              id: 'highlights-hide-in-focus',
              label: 'Hide in Focus Mode',
              type: 'radio',
              checked: writingMenuState.entityHighlights === 'hide-in-focus',
              click: () => sendToFocusedWindow('menu:setEntityHighlights', 'hide-in-focus')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Editor Appearance…',
          click: () => sendToFocusedWindow('menu:editorAppearance')
        },
        {
          label: 'Bigger Text',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendToFocusedWindow('menu:editorSize', 'in')
        },
        {
          label: 'Bigger Text',
          accelerator: 'CmdOrCtrl+Plus',
          visible: false,
          click: () => sendToFocusedWindow('menu:editorSize', 'in')
        },
        {
          label: 'Smaller Text',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendToFocusedWindow('menu:editorSize', 'out')
        },
        {
          label: 'Default Text Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendToFocusedWindow('menu:editorSize', 'reset')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          role: 'resetZoom',
          accelerator: 'Alt+CmdOrCtrl+0'
        },
        {
          role: 'zoomIn',
          accelerator: 'Alt+CmdOrCtrl+='
        },
        {
          role: 'zoomIn',
          accelerator: 'Alt+CmdOrCtrl+Plus',
          visible: false
        },
        {
          role: 'zoomOut',
          accelerator: 'Alt+CmdOrCtrl+-'
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    ...(isMac
      ? [{
          label: 'Window',
          submenu: [
            { role: 'windowMenu' as const },
            { type: 'separator' as const },
            {
              label: 'Device Preview',
              accelerator: 'CmdOrCtrl+Shift+P',
              click: () => sendToWindow(mainWindow, 'menu:devicePreview')
            }
          ]
        }]
      : [])
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function broadcastBackupResult(payload: import('@shared/types').BackupResultPayload): void {
  broadcast('backup:result', payload)
}

function registerIpcHandlers(): void {
  ipcMain.handle('tomes:createProject', async (_, input: CreateProjectInput) => {
    return createProject(input)
  })

  ipcMain.handle('tomes:openProject', async (_, { path }) => {
    return openProject(path)
  })

  ipcMain.handle(
    'tomes:saveProject',
    async (
      _,
      args?: { backup?: 'autosave' | 'explicit' | 'force' | 'none' }
    ) => {
      return saveProject({
        backup: args?.backup ?? 'autosave',
        onBackupResult: broadcastBackupResult
      })
    }
  )

  ipcMain.handle('tomes:getRecentProjects', async () => {
    return getRecentProjectsWithStatus()
  })

  ipcMain.handle('tomes:removeFromRecent', async (_, { id }) => {
    await removeFromRecent(id)
    return { success: true }
  })

  ipcMain.handle('tomes:deleteProject', async (_, { primaryPath, projectId }: { primaryPath: string; projectId: string }) => {
    const result = await deleteProject(primaryPath, projectId)
    await removeFromRecent(projectId)
    if (result.wasOpen) {
      closeAllChildren()
      resetNavigationState()
      broadcastSync()
    }
    return { success: true, wasOpen: result.wasOpen }
  })

  ipcMain.handle('tomes:updateBackupLocations', async (_, { projectId, paths }) => {
    await setBackupLocations(projectId, paths)
    return { success: true }
  })

  ipcMain.handle('tomes:checkBackupLocations', async (_, { paths }) => {
    return checkBackupLocations(paths)
  })

  ipcMain.handle('tomes:getConfig', async () => {
    return getConfig()
  })

  ipcMain.handle('tomes:updatePreferences', async (_, updates) => {
    const prefs = await updatePreferences(updates)
    broadcast('preferences:changed', prefs)
    if (updates.theme) {
      applyNativeTheme(prefs.theme)
      broadcast('theme:changed', { theme: prefs.theme })
    }
    return prefs
  })

  ipcMain.handle('app:setWritingMenuState', async (_, state: WritingMenuState) => {
    applyWritingMenuState(state)
    return { success: true }
  })

  // Lets the in-app menu (Windows, where there is no menu bar) fire the same
  // actions as the native menu items, so every existing renderer listener keeps
  // working unchanged. Allowlisted: this must not become a way to emit arbitrary
  // channels into a window.
  ipcMain.handle('app:menuAction', async (_, channel: string, arg?: unknown) => {
    if (!IN_APP_MENU_CHANNELS.has(channel)) {
      console.error('[menu-action] ignoring unknown channel:', channel)
      return { success: false }
    }
    // These three target the main window specifically, matching their menu items.
    const args = arg === undefined ? [] : [arg]
    if (MAIN_WINDOW_MENU_CHANNELS.has(channel)) {
      sendToWindow(mainWindow, channel, ...args)
    } else {
      sendToFocusedWindow(channel, ...args)
    }
    return { success: true }
  })

  ipcMain.handle('app:getUpdateStatus', async () => {
    return appUpdateStatus
  })

  ipcMain.handle('app:openLatestDownload', async () => {
    return openLatestAppDownload()
  })

  ipcMain.handle('tomes:updateRecentPath', async (_, { projectId, primaryPath }) => {
    await updateRecentPrimaryPath(projectId, primaryPath)
    return { success: true }
  })

  ipcMain.handle('tomes:renameRecentProject', async (_, { projectId, title }) => {
    const result = await renameRecentProject(projectId, title)
    if (isOpen()) broadcastSync()
    return result
  })

  ipcMain.handle('tomes:showInFolder', async (_, { path }) => {
    shell.showItemInFolder(path)
    return { success: true }
  })

  ipcMain.handle('tomes:closeProject', async () => {
    closeAllChildren()
    closeProject()
    resetNavigationState()
    broadcastSync()
    return { success: true }
  })

  ipcMain.handle('tomes:createChapter', async (_, { structure, parentId }) => {
    const node = await createChapter(structure, parentId ?? null)
    broadcastSync()
    return node
  })

  ipcMain.handle('tomes:updateUiState', async (_, uiState) => {
    const result = await updateUiState(uiState)
    broadcastSync()
    return result
  })

  ipcMain.handle('tomes:updateBookSettings', async (_, updates: Partial<BookSettings>) => {
    const settings = await updateBookSettings(updates)
    broadcastSync()
    return settings
  })

  ipcMain.handle('tomes:updateProjectMeta', async (_, updates) => {
    const meta = await updateProjectMeta(updates)
    broadcastSync()
    return meta
  })

  ipcMain.handle('tomes:updateCategories', async (_, { categories }: { categories: CategoryDefinition[] }) => {
    const meta = await updateCategories(categories)
    broadcastSync()
    return meta
  })

  ipcMain.handle('tomes:importCoverImage', async (_, { sourcePath }: { sourcePath: string }) => {
    const relativePath = await importCoverImage(sourcePath)
    return { relativePath }
  })

  ipcMain.handle('tomes:getSyncState', async () => {
    return getSyncState()
  })

  ipcMain.handle('navigation:get', async () => {
    return getNavigationState()
  })

  ipcMain.handle('navigation:update', async (event, state: NavigationSyncState) => {
    setNavigationState(state)
    const senderId = event.sender.id
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      try {
        if (win.webContents.isDestroyed() || win.webContents.id === senderId) continue
        win.webContents.send('sync:navigation', state)
      } catch {
        // Window tore down mid-broadcast.
      }
    }
    return { success: true }
  })

  ipcMain.handle('windows:openDocument', async (_, { nodeId, title }) => {
    const config = await getConfig()
    openDocumentWindow(nodeId, title, config.preferences.theme)
    await updateWindowLayout({ secondaryWindows: saveSecondaryWindowState() })
    return { success: true }
  })

  ipcMain.handle('windows:openImageViewer', async (_, { imagePath, title }) => {
    const config = await getConfig()
    openImageViewerWindow(imagePath, title, config.preferences.theme)
    return { success: true }
  })

  ipcMain.handle('windows:openDevicePreview', async (_, options: DevicePreviewRequestOptions) => {
    const config = await getConfig()
    openDevicePreviewWindow(options, config.preferences.theme)
    return { success: true }
  })

  ipcMain.handle('windows:getLayout', async () => {
    return getWindowLayout()
  })

  ipcMain.handle('windows:updateLayout', async (_, updates) => {
    return updateWindowLayout(updates)
  })

  ipcMain.handle('tomes:getProjectInfo', async () => {
    if (!isOpen()) return null
    return { path: getProjectPath(), meta: getProjectMeta() }
  })

  ipcMain.handle('dialog:openTomes', async () => {
    if (!mainWindow) return null
    return showOpenTomesDialog(mainWindow)
  })

  ipcMain.handle('dialog:selectBackupZip', async () => {
    const win = aliveWindow(mainWindow)
    if (!win) return null
    return showSelectBackupZipDialog(win)
  })

  ipcMain.handle('dialog:chooseFolder', async (_, title?: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!win) return null
    return showChooseFolderDialog(win, title)
  })

  ipcMain.handle('dialog:selectImage', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!win) return null
    return showSelectImageDialog(win)
  })

  ipcMain.handle('dialog:selectDocx', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!win) return null
    return showSelectDocxDialog(win)
  })

  ipcMain.handle('manuscript:parseDocx', async (_, { path }: { path: string }) => {
    return parseDocxFile(path)
  })

  ipcMain.handle('tree:getAll', async () => {
    return getAllNodes()
  })

  ipcMain.handle('tree:create', async (_, { parentId, type, title, metadata, scope, categoryId }) => {
    const node = await createNode(parentId, type as NodeType, title, { metadata, scope, categoryId })
    broadcastSync()
    return node
  })

  ipcMain.handle('tree:createFolder', async (_, { scope, parentId, title }) => {
    const node = await createFolder(scope, parentId, title)
    broadcastSync()
    return node
  })

  ipcMain.handle('tree:update', async (event, { id, ...updates }) => {
    const node = await updateNode(id, updates)
    // Body saves are the typing hot path and the sender already has the text; only other
    // windows need the whole-project payload.
    const contentOnly = Object.keys(updates).every((key) => key === 'content')
    broadcastSync(contentOnly ? event.sender : undefined)
    return node
  })

  ipcMain.handle('tree:delete', async (_, { id }) => {
    await deleteNode(id)
    broadcastSync()
    return { success: true }
  })

  ipcMain.handle('tree:moveToTrash', async (_, { id }) => {
    const nodes = await moveToTrash(id)
    broadcastSync()
    return nodes
  })

  ipcMain.handle('tree:restore', async (_, { id, targetParentId }) => {
    const nodes = await restoreNode(id, targetParentId)
    broadcastSync()
    return nodes
  })

  ipcMain.handle('tree:permanentDelete', async (_, { id }) => {
    const nodes = await permanentDelete(id)
    broadcastSync()
    return nodes
  })

  ipcMain.handle('tree:reorder', async (_, { items }) => {
    const nodes = await reorderNodes(items)
    broadcastSync()
    return nodes
  })

  ipcMain.handle('entity:getAll', async () => {
    return getEntityNodes()
  })

  ipcMain.handle('entity:getById', async (_, { id }) => {
    return getNode(id)
  })

  ipcMain.handle('entity:importCharacterImage', async (_, { nodeId, sourcePath }) => {
    const relativePath = await importCharacterImage(nodeId, sourcePath)
    return { relativePath }
  })

  ipcMain.handle('entity:importEntityImage', async (_, { nodeId, sourcePath, entityType }) => {
    const relativePath = await importEntityImage(nodeId, sourcePath, entityType)
    return { relativePath }
  })

  ipcMain.handle('entity:importEntityGalleryImage', async (_, { nodeId, sourcePath, entityType }) => {
    const relativePath = await importEntityGalleryImage(nodeId, sourcePath, entityType)
    return { relativePath }
  })

  ipcMain.handle('entity:deleteEntityImage', async (_, { relativePath }) => {
    await deleteEntityImage(relativePath)
  })

  ipcMain.handle('backup:list', async () => {
    const root = getProjectRootPath()
    if (!root) return []
    return listLocalBackups(root)
  })

  ipcMain.handle('backup:status', async () => {
    const root = getProjectRootPath()
    const meta = getProjectMeta()
    if (!root || !meta) return null
    return getBackupStatus(root, meta.id)
  })

  ipcMain.handle('backup:create', async (_, { name }: { name?: string }) => {
    const result = await createManualBackup(name)
    const payload = toBackupResultPayload(result)
    broadcastBackupResult(payload)
    return payload
  })

  ipcMain.handle('backup:inspect', async (_, { path: zipPath }: { path: string }) => {
    const meta = getProjectMeta()
    return inspectBackupZip(zipPath, meta ? { expectedProjectId: meta.id } : undefined)
  })

  ipcMain.handle('backup:restore', async (_, { path: zipPath }: { path: string }) => {
    return restoreOpenProject(zipPath, false)
  })

  /** Restore from a zip the user picked anywhere on disk (external drive, cloud folder). */
  ipcMain.handle('backup:restoreFromFile', async (_, { path: zipPath }: { path: string }) => {
    const meta = getProjectMeta()
    if (!meta) {
      return { success: false, message: 'No project open' }
    }

    const inspection = await inspectBackupZip(zipPath, { expectedProjectId: meta.id })
    if (!inspection.valid) {
      return {
        success: false,
        message: inspection.message ?? 'This zip is not a Priama project backup.'
      }
    }
    if (!inspection.matchesOpenProject) {
      return {
        success: false,
        message: `This backup is for “${inspection.title}”, a different project. Open it as a separate project instead.`
      }
    }

    return restoreOpenProject(zipPath, true)
  })

  ipcMain.handle(
    'backup:importAsProject',
    async (_, { path: zipPath, parentDir }: { path: string; parentDir: string }) => {
      const config = await getConfig()
      const result = await importBackupAsProject({
        zipPath,
        parentDir,
        knownProjects: config.recentProjects.map((entry) => ({
          id: entry.id,
          primaryPath: entry.primaryPath
        }))
      })

      // The renderer opens the copy next; windows of the project being left behind
      // would otherwise keep editing nodes that are no longer on screen.
      if (result.success && isOpen()) {
        closeAllChildren()
        resetNavigationState()
      }

      return result
    }
  )

  ipcMain.handle('tomes:forceQuit', async () => {
    isQuitting = true
    closeProject()
    app.quit()
    return { success: true }
  })

  ipcMain.handle('export:document', async (event, options: ExportOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || !isOpen()) {
      return { success: false, message: 'No project open' }
    }

    const savePath = await showSaveExportDialog(win, options.format, options.title)
    if (!savePath) {
      return { success: false, message: 'Cancelled' }
    }

    return exportDocument(savePath, options, getAllNodes(), getProjectMeta())
  })

  ipcMain.handle(
    'devicePreview:getEpub',
    async (_, options: DevicePreviewRequestOptions) => {
      const nodes = getAllNodes()
      const meta = getProjectMeta()
      if (!meta) throw new Error('No project open')
      const epub = await generatePreviewEpub(nodes, options, meta)
      return { epub, title: meta.title, author: meta.author }
    }
  )

}

async function requestRendererFlush(): Promise<void> {
  const win = aliveWindow(mainWindow)
  if (!win) return

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5000)

    ipcMain.handleOnce('app:flushComplete', async () => {
      clearTimeout(timeout)
      resolve()
      return { success: true }
    })

    sendToWindow(win, 'app:requestFlush')
  })
}

/**
 * Replace the open project with one of its own backups, then reopen it.
 * `allowExternalSource` is set only for a zip the user picked themselves; the
 * project id inside the archive must match either way.
 */
async function restoreOpenProject(
  zipPath: string,
  allowExternalSource: boolean
): Promise<{ success: boolean; message?: string }> {
  const root = getProjectRootPath()
  const meta = getProjectMeta()
  const tomes = getProjectPath()
  if (!root || !meta || !tomes) {
    return { success: false, message: 'No project open' }
  }

  const result = await restoreProjectFromBackup({
    projectRoot: root,
    backupZipPath: zipPath,
    projectId: meta.id,
    allowExternalSource,
    writeManifest: writeProjectManifest,
    getExternalDestinations: () => getBackupLocations(meta.id),
    beforeSwap: async () => {
      closeAllChildren()
      await requestRendererRestoreReady()
      closeProject()
      resetNavigationState()
    }
  })

  if (!result.success) {
    return result
  }

  try {
    const opened = await openProject(tomes)
    sendToWindow(mainWindow, 'tomes:projectOpened', opened)
    broadcastSync()
    return { success: true }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Could not reopen the project after restore'
    }
  }
}

async function requestRendererRestoreReady(): Promise<void> {
  const win = aliveWindow(mainWindow)
  if (!win) return

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5000)

    ipcMain.handleOnce('app:restoreReady', async () => {
      clearTimeout(timeout)
      resolve()
      return { success: true }
    })

    broadcast('backup:willRestore', {})
  })
}

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (!gotLock) return
  try {
    const win = aliveWindow(mainWindow)
    if (win?.webContents.isLoading()) {
      pendingOpenPath = path
    } else if (win) {
      void openProjectFromPath(path)
    } else {
      pendingOpenPath = path
    }
  } catch (err) {
    console.error('[open-file]', err)
    pendingOpenPath = path
  }
})

app.on('before-quit', async (event) => {
  if (!gotLock) return
  if (isQuitting || !isOpen()) return

  event.preventDefault()
  isQuitting = true

  try {
    await requestRendererFlush()
    const result = await saveProject({
      backup: 'force',
      onBackupResult: broadcastBackupResult
    })
    sendToWindow(mainWindow, 'tomes:beforeQuit', {
      unreachableBackupPaths: result.unreachableBackupPaths ?? []
    })

    if ((result.unreachableBackupPaths?.length ?? 0) > 0) {
      isQuitting = false
      return
    }

    closeProject()
  } catch (err) {
    console.error('[before-quit]', err)
  }
  app.quit()
})

if (gotLock) {
  app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.priama.app')
    }

    // Dev launches the stock Electron bundle, so macOS shows Electron's own Dock icon. Packaged
    // builds take the real one from electron-builder; this only closes the gap while developing.
    if (process.platform === 'darwin' && !app.isPackaged) {
      const devIcon = join(__dirname, '../../build/icon.png')
      if (existsSync(devIcon)) {
        app.dock?.setIcon(devIcon)
      }
    }

    const coldStartPath = findTomesPathInArgv(process.argv)
    if (coldStartPath) {
      pendingOpenPath = coldStartPath
    }

    registerAssetProtocol()
    registerIpcHandlers()
    buildMenu()
    applyNativeTheme((await getConfig()).preferences.theme)
    createWindow()
    void refreshAppUpdateStatus()

    app.on('activate', () => {
      try {
        if (BrowserWindow.getAllWindows().length === 0 || !aliveWindow(mainWindow)) {
          createWindow()
        }
      } catch (err) {
        console.error('[activate]', err)
      }
    })
  })

  app.on('window-all-closed', () => {
    try {
      if (!isQuitting) closeProject()
    } catch (err) {
      console.error('[window-all-closed]', err)
    }
    if (process.platform !== 'darwin') app.quit()
  })
}

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})
