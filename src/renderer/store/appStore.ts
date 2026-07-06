import { create } from 'zustand'
import type { CategoryDefinition, FolderScope, ProjectMeta, TreeNode, WikiEntityType } from '@shared/types'
import { DEFAULT_SECTION_ORDER, DEFAULT_EXPANDED_SECTIONS, migrateExpandedSections, migrateSectionOrder, SIDEBAR_MAX_WIDTH } from '@shared/types'

export type PendingRenameTarget = 'sidebar' | 'container'

interface AppState {
  projectPath: string | null
  projectId: string | null
  projectMeta: ProjectMeta | null
  isProjectOpen: boolean
  lastSaved: string | null
  isDirty: boolean
  backupWarningCount: number

  categories: CategoryDefinition[]
  nodes: TreeNode[]
  selectedNodeId: string | null
  selectedContainerId: string | null
  expandedSections: Set<string>
  sectionOrder: string[]

  selectedEntityId: string | null
  selectedEntityType: WikiEntityType | null
  selectedEntryId: string | null
  selectedEntryCategoryId: string | null

  theme: 'light' | 'dark'
  sidebarWidth: number
  rightPanelWidth: number
  rightPanelOpen: boolean

  showNewProjectModal: boolean
  showExportDialog: boolean
  showBookSettingsModal: boolean

  containerHistory: string[]
  containerHistoryIndex: number

  pendingRenameNodeId: string | null
  pendingRenameTarget: PendingRenameTarget | null

  setProject: (path: string, meta: ProjectMeta, nodes?: TreeNode[]) => void
  closeProject: () => void
  setProjectMeta: (meta: ProjectMeta) => void
  setLastSaved: (timestamp: string) => void
  setDirty: (dirty: boolean) => void
  setBackupWarningCount: (count: number) => void

  setCategories: (categories: CategoryDefinition[]) => void
  updateCategories: (categories: CategoryDefinition[]) => Promise<void>

  setNodes: (nodes: TreeNode[]) => void
  addNode: (node: TreeNode) => void
  upsertNode: (node: TreeNode) => void
  updateNodeInStore: (id: string, updates: Partial<TreeNode>) => void
  removeNode: (id: string) => void
  setSelectedNodeId: (id: string | null) => void
  selectContainer: (id: string | null) => void
  containerGoBack: () => void
  containerGoForward: () => void
  selectWikiEntity: (id: string | null, type: WikiEntityType | null) => void
  toggleSection: (section: string) => void
  setSectionOrder: (order: string[]) => void

  setSelectedEntity: (id: string | null, type: WikiEntityType | null) => void
  /** Panel entry selection — preserves center view when opening/closing (same as wiki entities). */
  selectEntry: (id: string | null, categoryId: string | null) => void
  setTheme: (theme: 'light' | 'dark', options?: { persist?: boolean }) => void
  toggleTheme: () => void
  setRightPanelOpen: (open: boolean) => void
  setShowNewProjectModal: (show: boolean) => void
  setShowExportDialog: (show: boolean) => void
  setShowBookSettingsModal: (show: boolean) => void
  setSidebarWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  applyNavigationSync: (nav: import('@shared/types').NavigationSyncState) => void

  requestRename: (id: string, target: PendingRenameTarget) => void
  consumePendingRename: (
    target: PendingRenameTarget,
    matches: (node: TreeNode) => boolean
  ) => TreeNode | null
  clearPendingRename: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  projectPath: null,
  projectId: null,
  projectMeta: null,
  isProjectOpen: false,
  lastSaved: null,
  isDirty: false,
  backupWarningCount: 0,

  categories: [],
  nodes: [],
  selectedNodeId: null,
  selectedContainerId: null,
  expandedSections: new Set(DEFAULT_EXPANDED_SECTIONS),
  sectionOrder: [...DEFAULT_SECTION_ORDER],

  selectedEntityId: null,
  selectedEntityType: null,
  selectedEntryId: null,
  selectedEntryCategoryId: null,

  containerHistory: [],
  containerHistoryIndex: -1,

  theme: 'dark',
  sidebarWidth: SIDEBAR_MAX_WIDTH,
  rightPanelWidth: 320,
  rightPanelOpen: true,
  showNewProjectModal: false,
  showExportDialog: false,
  showBookSettingsModal: false,

  pendingRenameNodeId: null,
  pendingRenameTarget: null,

  setProject: (path, meta, nodes) =>
    set({
      projectPath: path,
      projectId: meta.id,
      projectMeta: meta,
      isProjectOpen: true,
      isDirty: false,
      categories: meta.categories ?? [],
      ...(nodes ? { nodes } : {})
    }),

  closeProject: () =>
    set({
      projectPath: null,
      projectId: null,
      projectMeta: null,
      isProjectOpen: false,
      categories: [],
      nodes: [],
      selectedNodeId: null,
      selectedContainerId: null,
      selectedEntityId: null,
      selectedEntityType: null,
      selectedEntryId: null,
      selectedEntryCategoryId: null,
      isDirty: false,
      lastSaved: null,
      backupWarningCount: 0,
      pendingRenameNodeId: null,
      pendingRenameTarget: null,
      containerHistory: [],
      containerHistoryIndex: -1
    }),

  setProjectMeta: (meta) => set({ projectMeta: meta }),
  setLastSaved: (timestamp) => set({ lastSaved: timestamp, isDirty: false }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setBackupWarningCount: (count) => set({ backupWarningCount: count }),

  setCategories: (categories) => set({ categories }),

  updateCategories: async (categories) => {
    set({ categories })
    const meta = await window.electronAPI.tomes.updateCategories(categories)
    set({ projectMeta: meta })
  },

  setNodes: (nodes) => set({ nodes }),
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  upsertNode: (node) =>
    set((s) => {
      const idx = s.nodes.findIndex((n) => n.id === node.id)
      if (idx >= 0) {
        return { nodes: s.nodes.map((n, i) => (i === idx ? node : n)) }
      }
      return { nodes: [...s.nodes, node] }
    }),
  updateNodeInStore: (id, updates) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n))
    })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id && n.parentId !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      ...(s.selectedEntityId === id
        ? { selectedEntityId: null, selectedEntityType: null, rightPanelOpen: false }
        : {}),
      ...(s.selectedEntryId === id
        ? { selectedEntryId: null, selectedEntryCategoryId: null, rightPanelOpen: false }
        : {})
    })),
  setSelectedNodeId: (id) => {
    const state = get()
    const hasPanel = Boolean(state.selectedEntityId || state.selectedEntryId)
    const node = id ? state.nodes.find((n) => n.id === id) : null
    const isManuscriptFocus =
      id === null || node?.type === 'chapter' || node?.type === 'scene'
    const preservePanel = hasPanel && isManuscriptFocus

    if (preservePanel) {
      set({ selectedNodeId: id, selectedContainerId: null })
      return
    }

    set({
      selectedNodeId: id,
      selectedContainerId: null,
      selectedEntityId: null,
      selectedEntityType: null,
      selectedEntryId: null,
      selectedEntryCategoryId: null,
      rightPanelOpen: false
    })
  },
  /** Switch center container list — does not affect right panel selection. */
  selectContainer: (id) => {
    const { containerHistory, containerHistoryIndex } = get()
    if (id && id !== containerHistory[containerHistoryIndex]) {
      const truncated = containerHistory.slice(0, containerHistoryIndex + 1)
      truncated.push(id)
      set({
        selectedContainerId: id,
        selectedNodeId: null,
        containerHistory: truncated,
        containerHistoryIndex: truncated.length - 1
      })
    } else {
      set({ selectedContainerId: id, selectedNodeId: null })
    }
  },
  containerGoBack: () => {
    const { containerHistory, containerHistoryIndex } = get()
    if (containerHistoryIndex <= 0) return
    const newIndex = containerHistoryIndex - 1
    set({
      selectedContainerId: containerHistory[newIndex],
      selectedNodeId: null,
      containerHistoryIndex: newIndex
    })
  },
  containerGoForward: () => {
    const { containerHistory, containerHistoryIndex } = get()
    if (containerHistoryIndex >= containerHistory.length - 1) return
    const newIndex = containerHistoryIndex + 1
    set({
      selectedContainerId: containerHistory[newIndex],
      selectedNodeId: null,
      containerHistoryIndex: newIndex
    })
  },
  selectWikiEntity: (id, type) => get().setSelectedEntity(id, type),
  toggleSection: (section) => {
    const normalized = migrateExpandedSections([section])
    const expanded = migrateExpandedSections(get().expandedSections)
    const key = [...normalized][0]
    if (expanded.has(key)) expanded.delete(key)
    else expanded.add(key)
    set({ expandedSections: expanded })
  },
  setSectionOrder: (order) => set({ sectionOrder: order }),

  /** Panel entry selection — preserves center view like setSelectedEntity for wiki items. */
  selectEntry: (id, categoryId) => {
    const reopenPanel = !!id
    set({
      selectedEntryId: id,
      selectedEntryCategoryId: categoryId,
      selectedEntityId: null,
      selectedEntityType: null,
      rightPanelOpen: reopenPanel
    })
  },

  setSelectedEntity: (id, type) => {
    const reopenPanel = id !== null
    set({
      selectedEntityId: id,
      selectedEntityType: type,
      selectedEntryId: null,
      selectedEntryCategoryId: null,
      rightPanelOpen: reopenPanel
    })
  },

  setTheme: (theme, options) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set({ theme })
    if (options?.persist !== false) {
      void window.electronAPI.tomes.updatePreferences({ theme })
    }
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
  setShowExportDialog: (show) => set({ showExportDialog: show }),
  setShowBookSettingsModal: (show) => set({ showBookSettingsModal: show }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),

  applyNavigationSync: (nav) =>
    set({
      selectedNodeId: nav.selectedNodeId,
      selectedContainerId: nav.selectedContainerId,
      selectedEntityId: nav.selectedEntityId,
      selectedEntityType: nav.selectedEntityType,
      selectedEntryId: nav.selectedEntryId ?? null,
      selectedEntryCategoryId: nav.selectedEntryCategoryId ?? null,
      expandedSections: migrateExpandedSections(nav.expandedSections),
      rightPanelOpen: nav.rightPanelOpen,
      sectionOrder: migrateSectionOrder(nav.sectionOrder, get().categories),
      pendingRenameNodeId: null,
      pendingRenameTarget: null
    }),

  requestRename: (id, target) => set({ pendingRenameNodeId: id, pendingRenameTarget: target }),

  consumePendingRename: (target, matches) => {
    const { pendingRenameNodeId, pendingRenameTarget, nodes } = get()
    if (!pendingRenameNodeId || pendingRenameTarget !== target) return null
    const node = nodes.find((n) => n.id === pendingRenameNodeId)
    if (!node || !matches(node)) return null
    set({ pendingRenameNodeId: null, pendingRenameTarget: null })
    return node
  },

  clearPendingRename: () => set({ pendingRenameNodeId: null, pendingRenameTarget: null })
}))

export function getSelectedNode(state: AppState): TreeNode | null {
  if (!state.selectedNodeId) return null
  return state.nodes.find((n) => n.id === state.selectedNodeId) ?? null
}

export { getChapters, getScenes, getNodesByType, getActiveNodes } from '@/lib/treeUtils'
