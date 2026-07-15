import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron'
import { join } from 'path'
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
  deleteProject
} from './tomes/projectStore'
import { validateTomesFile } from './tomes/validate'
import {
  showOpenTomesDialog,
  showChooseFolderDialog,
  showSelectImageDialog,
  showSaveExportDialog
} from './fileSystem'
import { checkBackupLocations, listLocalBackups } from './tomes/backup'
import {
  getConfig,
  removeFromRecent,
  setBackupLocations,
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
  getMainWindow
} from './windowManager'
import {
  getNavigationState,
  setNavigationState,
  resetNavigationState
} from './navigationState'
import { registerAssetScheme, registerAssetProtocol } from './assetProtocol'
import { exportDocument } from './export'
import { generatePreviewEpub } from './tomes/preview/generatePreviewEpub'
import type {
  BookSettings,
  CategoryDefinition,
  CreateProjectInput,
  DevicePreviewRequestOptions,
  ExportOptions,
  NavigationSyncState,
  NodeType
} from '@shared/types'

let mainWindow: BrowserWindow | null = null
let pendingOpenPath: string | null = null
let isQuitting = false

const gotLock = app.requestSingleInstanceLock()

registerAssetScheme()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const tomesPath = findTomesPathInArgv(argv)
    if (tomesPath && mainWindow) {
      void openProjectFromPath(tomesPath)
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
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

function broadcastSync(): void {
  broadcast('sync:state', getSyncState())
}

async function openProjectFromPath(tomesPath: string): Promise<void> {
  const validation = await validateTomesFile(tomesPath)
  if (!validation.valid) {
    dialog.showErrorBox('Invalid Project', validation.error ?? 'Could not open project file')
    return
  }

  try {
    const result = await openProject(tomesPath)
    mainWindow?.webContents.send('tomes:projectOpened', result)
  } catch (err) {
    dialog.showErrorBox(
      'Open Failed',
      err instanceof Error ? err.message : 'Could not open project'
    )
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (pendingOpenPath) {
      const path = pendingOpenPath
      pendingOpenPath = null
      void openProjectFromPath(path)
    }
  })

  if (mainWindow) setMainWindow(mainWindow)

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

function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
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
          click: () => mainWindow?.webContents.send('menu:newProject')
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:openProject')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: 'Export…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow?.webContents.send('menu:export')
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() ?? mainWindow
            win?.webContents.send('menu:closeProject')
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
          click: () => {
            const win = BrowserWindow.getFocusedWindow() ?? mainWindow
            win?.webContents.send('menu:undo')
          }
        },
        {
          label: 'Redo',
          accelerator: 'Shift+CmdOrCtrl+Z',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() ?? mainWindow
            win?.webContents.send('menu:redo')
          }
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
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
              click: () => mainWindow?.webContents.send('menu:devicePreview')
            }
          ]
        }]
      : [])
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerIpcHandlers(): void {
  ipcMain.handle('tomes:createProject', async (_, input: CreateProjectInput) => {
    return createProject(input)
  })

  ipcMain.handle('tomes:openProject', async (_, { path }) => {
    return openProject(path)
  })

  ipcMain.handle('tomes:saveProject', async () => {
    return saveProject()
  })

  ipcMain.handle('tomes:getRecentProjects', async () => {
    return getRecentProjectsWithStatus()
  })

  ipcMain.handle('tomes:removeFromRecent', async (_, { id }) => {
    await removeFromRecent(id)
    return { success: true }
  })

  ipcMain.handle('tomes:deleteProject', async (_, { primaryPath, projectId }: { primaryPath: string; projectId: string }) => {
    const result = await deleteProject(primaryPath)
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
    if (updates.theme) {
      broadcast('theme:changed', { theme: prefs.theme })
    }
    return prefs
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
      if (!win.isDestroyed() && win.webContents.id !== senderId) {
        win.webContents.send('sync:navigation', state)
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

  ipcMain.handle('tree:update', async (_, { id, ...updates }) => {
    const node = await updateNode(id, updates)
    broadcastSync()
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
  if (!mainWindow || mainWindow.isDestroyed()) return

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5000)

    ipcMain.handleOnce('app:flushComplete', async () => {
      clearTimeout(timeout)
      resolve()
      return { success: true }
    })

    mainWindow!.webContents.send('app:requestFlush')
  })
}

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (mainWindow?.webContents.isLoading()) {
    pendingOpenPath = path
  } else if (mainWindow) {
    void openProjectFromPath(path)
  } else {
    pendingOpenPath = path
  }
})

app.on('before-quit', async (event) => {
  if (isQuitting || !isOpen()) return

  event.preventDefault()
  isQuitting = true

  await requestRendererFlush()
  const result = await saveProject()
  mainWindow?.webContents.send('tomes:beforeQuit', {
    unreachableBackupPaths: result.unreachableBackupPaths
  })

  if (result.unreachableBackupPaths.length > 0) {
    isQuitting = false
    return
  }

  closeProject()
  app.quit()
})

if (gotLock) {
  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.priama.app')
    }

    const coldStartPath = findTomesPathInArgv(process.argv)
    if (coldStartPath) {
      pendingOpenPath = coldStartPath
    }

    registerAssetProtocol()
    registerIpcHandlers()
    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (!isQuitting) closeProject()
    if (process.platform !== 'darwin') app.quit()
  })
}
