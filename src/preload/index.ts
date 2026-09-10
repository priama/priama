import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppUpdateStatus,
  BackupLocationStatus,
  BackupRecord,
  BackupResultPayload,
  BackupStatus,
  BookSettings,
  CategoryDefinition,
  ChapterStructure,
  CreateProjectInput,
  DevicePreviewRequestOptions,
  DevicePreviewResponse,
  ExportOptions,
  FolderScope,
  NavigationSyncState,
  NodeType,
  OpenProjectResult,
  PriamaConfig,
  PriamaPreferences,
  ProjectMeta,
  ProjectUiState,
  RecentProjectWithStatus,
  SaveResult,
  TreeNode,
  WindowLayoutState,
  WritingMenuState
} from '@shared/types'

export interface SyncState {
  path: string | null
  meta: ProjectMeta | null
  nodes: TreeNode[]
  uiState: ProjectUiState
}

export interface ElectronAPI {
  tomes: {
    createProject: (input: CreateProjectInput) => Promise<{ path: string; meta: ProjectMeta; projectRoot: string }>
    openProject: (path: string) => Promise<OpenProjectResult>
    saveProject: (backup?: 'autosave' | 'explicit' | 'force' | 'none') => Promise<SaveResult>
    closeProject: () => Promise<{ success: boolean }>
    getProjectInfo: () => Promise<{ path: string; meta: ProjectMeta } | null>
    getRecentProjects: () => Promise<RecentProjectWithStatus[]>
    removeFromRecent: (id: string) => Promise<{ success: boolean }>
    deleteProject: (primaryPath: string, projectId: string) => Promise<{ success: boolean; wasOpen: boolean }>
    updateBackupLocations: (projectId: string, paths: string[]) => Promise<{ success: boolean }>
    checkBackupLocations: (paths: string[]) => Promise<BackupLocationStatus[]>
    getConfig: () => Promise<PriamaConfig>
    updatePreferences: (updates: Partial<PriamaPreferences>) => Promise<PriamaPreferences>
    updateRecentPath: (projectId: string, primaryPath: string) => Promise<{ success: boolean }>
    renameRecentProject: (projectId: string, title: string) => Promise<{ success: boolean; title: string }>
    showInFolder: (path: string) => Promise<{ success: boolean }>
    forceQuit: () => Promise<{ success: boolean }>
    createChapter: (structure: ChapterStructure, parentId?: string | null) => Promise<TreeNode>
    updateUiState: (uiState: ProjectUiState) => Promise<ProjectUiState>
    updateBookSettings: (updates: Partial<BookSettings>) => Promise<BookSettings>
    updateProjectMeta: (
      updates: Partial<Pick<ProjectMeta, 'title' | 'author' | 'genre' | 'spellCheckLang'>>
    ) => Promise<ProjectMeta>
    updateCategories: (categories: CategoryDefinition[]) => Promise<ProjectMeta>
    importCoverImage: (sourcePath: string) => Promise<{ relativePath: string }>
    getSyncState: () => Promise<SyncState>
  }
  windows: {
    openDocument: (nodeId: string, title: string) => Promise<{ success: boolean }>
    openImageViewer: (imagePath: string, title: string) => Promise<{ success: boolean }>
    openDevicePreview: (options: DevicePreviewRequestOptions) => Promise<{ success: boolean }>
    getLayout: () => Promise<WindowLayoutState>
    updateLayout: (updates: Partial<WindowLayoutState>) => Promise<WindowLayoutState>
  }
  dialog: {
    openTomes: () => Promise<string | null>
    chooseFolder: (title?: string) => Promise<string | null>
    selectImage: () => Promise<string | null>
  }
  tree: {
    getAll: () => Promise<TreeNode[]>
    create: (
      parentId: string | null,
      type: NodeType,
      title: string,
      options?: { metadata?: string; scope?: FolderScope; categoryId?: string }
    ) => Promise<TreeNode>
    createFolder: (scope: FolderScope, parentId: string | null, title: string) => Promise<TreeNode>
    update: (id: string, updates: Partial<Pick<TreeNode, 'title' | 'content' | 'metadata' | 'parentId' | 'sortOrder'>>) => Promise<TreeNode>
    delete: (id: string) => Promise<{ success: boolean }>
    moveToTrash: (id: string) => Promise<TreeNode[]>
    restore: (id: string, targetParentId?: string | null) => Promise<TreeNode[]>
    permanentDelete: (id: string) => Promise<TreeNode[]>
    reorder: (items: { id: string; parentId: string | null; sortOrder: number }[]) => Promise<TreeNode[]>
  }
  entity: {
    getAll: () => Promise<TreeNode[]>
    getById: (id: string) => Promise<TreeNode | null>
    importCharacterImage: (nodeId: string, sourcePath: string) => Promise<{ relativePath: string }>
    importEntityImage: (
      nodeId: string,
      sourcePath: string,
      entityType: 'character' | 'location' | 'lore' | 'entry'
    ) => Promise<{ relativePath: string }>
    importEntityGalleryImage: (
      nodeId: string,
      sourcePath: string,
      entityType: 'character' | 'location' | 'lore' | 'entry'
    ) => Promise<{ relativePath: string }>
    deleteEntityImage: (relativePath: string) => Promise<void>
  }
  backup: {
    list: () => Promise<BackupRecord[]>
    status: () => Promise<BackupStatus | null>
    create: (name?: string) => Promise<BackupResultPayload>
    restore: (path: string) => Promise<{ success: boolean; message?: string }>
  }
  export: {
    document: (options: ExportOptions) => Promise<{ success: boolean; message?: string; path?: string }>
  }
  devicePreview: {
    getEpub: (options: DevicePreviewRequestOptions) => Promise<DevicePreviewResponse>
  }
  navigation: {
    get: () => Promise<NavigationSyncState>
    update: (state: NavigationSyncState) => Promise<{ success: boolean }>
  }
  app: {
    notifyFlushComplete: () => Promise<{ success: boolean }>
    notifyRestoreReady: () => Promise<{ success: boolean }>
    setWritingMenuState: (state: WritingMenuState) => Promise<{ success: boolean }>
    getUpdateStatus: () => Promise<AppUpdateStatus>
    openLatestDownload: () => Promise<{ success: boolean }>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

const api: ElectronAPI = {
  tomes: {
    createProject: (input) => ipcRenderer.invoke('tomes:createProject', input),
    openProject: (path) => ipcRenderer.invoke('tomes:openProject', { path }),
    saveProject: (backup) => ipcRenderer.invoke('tomes:saveProject', { backup }),
    closeProject: () => ipcRenderer.invoke('tomes:closeProject'),
    getProjectInfo: () => ipcRenderer.invoke('tomes:getProjectInfo'),
    getRecentProjects: () => ipcRenderer.invoke('tomes:getRecentProjects'),
    removeFromRecent: (id) => ipcRenderer.invoke('tomes:removeFromRecent', { id }),
    deleteProject: (primaryPath, projectId) =>
      ipcRenderer.invoke('tomes:deleteProject', { primaryPath, projectId }),
    updateBackupLocations: (projectId, paths) =>
      ipcRenderer.invoke('tomes:updateBackupLocations', { projectId, paths }),
    checkBackupLocations: (paths) => ipcRenderer.invoke('tomes:checkBackupLocations', { paths }),
    getConfig: () => ipcRenderer.invoke('tomes:getConfig'),
    updatePreferences: (updates) => ipcRenderer.invoke('tomes:updatePreferences', updates),
    updateRecentPath: (projectId, primaryPath) =>
      ipcRenderer.invoke('tomes:updateRecentPath', { projectId, primaryPath }),
    renameRecentProject: (projectId, title) =>
      ipcRenderer.invoke('tomes:renameRecentProject', { projectId, title }),
    showInFolder: (path) => ipcRenderer.invoke('tomes:showInFolder', { path }),
    forceQuit: () => ipcRenderer.invoke('tomes:forceQuit'),
    createChapter: (structure, parentId) => ipcRenderer.invoke('tomes:createChapter', { structure, parentId }),
    updateUiState: (uiState) => ipcRenderer.invoke('tomes:updateUiState', uiState),
    updateBookSettings: (updates) => ipcRenderer.invoke('tomes:updateBookSettings', updates),
    updateProjectMeta: (updates) => ipcRenderer.invoke('tomes:updateProjectMeta', updates),
    updateCategories: (categories) => ipcRenderer.invoke('tomes:updateCategories', { categories }),
    importCoverImage: (sourcePath) => ipcRenderer.invoke('tomes:importCoverImage', { sourcePath }),
    getSyncState: () => ipcRenderer.invoke('tomes:getSyncState')
  },
  windows: {
    openDocument: (nodeId, title) => ipcRenderer.invoke('windows:openDocument', { nodeId, title }),
    openImageViewer: (imagePath, title) =>
      ipcRenderer.invoke('windows:openImageViewer', { imagePath, title }),
    openDevicePreview: (options) => ipcRenderer.invoke('windows:openDevicePreview', options),
    getLayout: () => ipcRenderer.invoke('windows:getLayout'),
    updateLayout: (updates) => ipcRenderer.invoke('windows:updateLayout', updates)
  },
  dialog: {
    openTomes: () => ipcRenderer.invoke('dialog:openTomes'),
    chooseFolder: (title) => ipcRenderer.invoke('dialog:chooseFolder', title),
    selectImage: () => ipcRenderer.invoke('dialog:selectImage')
  },
  tree: {
    getAll: () => ipcRenderer.invoke('tree:getAll'),
    create: (parentId, type, title, options) =>
      ipcRenderer.invoke('tree:create', { parentId, type, title, ...options }),
    createFolder: (scope, parentId, title) =>
      ipcRenderer.invoke('tree:createFolder', { scope, parentId, title }),
    update: (id, updates) => ipcRenderer.invoke('tree:update', { id, ...updates }),
    delete: (id) => ipcRenderer.invoke('tree:delete', { id }),
    moveToTrash: (id) => ipcRenderer.invoke('tree:moveToTrash', { id }),
    restore: (id, targetParentId) => ipcRenderer.invoke('tree:restore', { id, targetParentId }),
    permanentDelete: (id) => ipcRenderer.invoke('tree:permanentDelete', { id }),
    reorder: (items) => ipcRenderer.invoke('tree:reorder', { items })
  },
  entity: {
    getAll: () => ipcRenderer.invoke('entity:getAll'),
    getById: (id) => ipcRenderer.invoke('entity:getById', { id }),
    importCharacterImage: (nodeId, sourcePath) =>
      ipcRenderer.invoke('entity:importCharacterImage', { nodeId, sourcePath }),
    importEntityImage: (nodeId, sourcePath, entityType) =>
      ipcRenderer.invoke('entity:importEntityImage', { nodeId, sourcePath, entityType }),
    importEntityGalleryImage: (nodeId, sourcePath, entityType) =>
      ipcRenderer.invoke('entity:importEntityGalleryImage', { nodeId, sourcePath, entityType }),
    deleteEntityImage: (relativePath) =>
      ipcRenderer.invoke('entity:deleteEntityImage', { relativePath })
  },
  backup: {
    list: () => ipcRenderer.invoke('backup:list'),
    status: () => ipcRenderer.invoke('backup:status'),
    create: (name) => ipcRenderer.invoke('backup:create', { name }),
    restore: (path) => ipcRenderer.invoke('backup:restore', { path })
  },
  export: {
    document: (options) => ipcRenderer.invoke('export:document', options)
  },
  devicePreview: {
    getEpub: (options) => ipcRenderer.invoke('devicePreview:getEpub', options)
  },
  navigation: {
    get: () => ipcRenderer.invoke('navigation:get'),
    update: (state) => ipcRenderer.invoke('navigation:update', state)
  },
  app: {
    notifyFlushComplete: () => ipcRenderer.invoke('app:flushComplete'),
    notifyRestoreReady: () => ipcRenderer.invoke('app:restoreReady'),
    setWritingMenuState: (state) => ipcRenderer.invoke('app:setWritingMenuState', state),
    getUpdateStatus: () => ipcRenderer.invoke('app:getUpdateStatus'),
    openLatestDownload: () => ipcRenderer.invoke('app:openLatestDownload')
  },
  on: (channel, callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
