import { create } from 'zustand'
import type {
  CategoryDefinition,
  ContainerViewMode,
  EntityHighlights,
  ProjectMeta,
  TreeNode,
  TypewriterScrolling,
  WikiEntityType
} from '@shared/types'
import { DEFAULT_SECTION_ORDER, DEFAULT_EXPANDED_SECTIONS, migrateExpandedSections, migrateSectionOrder, SIDEBAR_MAX_WIDTH } from '@shared/types'
import { isValidContainerId, pruneContainerNavigation } from '@shared/projectUiState'
import type { RenameSession, RenameSurface, RenamePhase } from '@/lib/renameSession'
import { createRenameSession } from '@/lib/renameSession'

/** @deprecated Prefer RenameSurface — kept for call-site compatibility during migration. */
export type PendingRenameTarget = RenameSurface

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
  containerViewModes: Record<string, ContainerViewMode>

  selectedEntityId: string | null
  selectedEntityType: WikiEntityType | null
  selectedEntryId: string | null
  selectedEntryCategoryId: string | null

  theme: 'light' | 'dark'
  focusMode: boolean
  typewriterScrolling: TypewriterScrolling
  entityHighlights: EntityHighlights
  sidebarWidth: number
  rightPanelWidth: number
  rightPanelOpen: boolean

  showNewProjectModal: boolean
  showExportDialog: boolean
  showBookSettingsModal: boolean

  containerHistory: string[]
  containerHistoryIndex: number

  renameSession: RenameSession | null

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
  setContainerViewMode: (containerId: string, mode: ContainerViewMode) => void
  setContainerViewModes: (modes: Record<string, ContainerViewMode>) => void

  setSelectedEntity: (id: string | null, type: WikiEntityType | null) => void
  /** Panel entry selection — preserves center view when opening/closing (same as wiki entities). */
  selectEntry: (id: string | null, categoryId: string | null) => void
  setTheme: (theme: 'light' | 'dark', options?: { persist?: boolean }) => void
  toggleTheme: () => void
  setFocusMode: (focusMode: boolean, options?: { persist?: boolean }) => void
  toggleFocusMode: () => void
  setTypewriterScrolling: (
    typewriterScrolling: TypewriterScrolling,
    options?: { persist?: boolean }
  ) => void
  setEntityHighlights: (
    entityHighlights: EntityHighlights,
    options?: { persist?: boolean }
  ) => void
  applyWritingPreferences: (prefs: {
    theme?: 'light' | 'dark'
    focusMode?: boolean
    typewriterScrolling?: TypewriterScrolling
    entityHighlights?: EntityHighlights
  }) => void
  setRightPanelOpen: (open: boolean) => void
  setShowNewProjectModal: (show: boolean) => void
  setShowExportDialog: (show: boolean) => void
  setShowBookSettingsModal: (show: boolean) => void
  setSidebarWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  applyNavigationSync: (nav: import('@shared/types').NavigationSyncState) => void

  startRenameSession: (params: {
    nodeId: string
    originalTitle: string
    preferredSurfaces: RenameSurface[]
  }) => string
  updateRenameDraft: (requestId: string, draft: string) => void
  claimRenameOwner: (requestId: string, surface: RenameSurface) => boolean
  releaseRenameOwner: (requestId: string, surface: RenameSurface) => void
  markSelectAllConsumed: (requestId: string) => void
  setRenamePhase: (requestId: string, phase: RenamePhase) => void
  cancelRenameSession: (requestId?: string) => void
  /** Clear only if requestId still matches — prevents stale blur from killing a newer session. */
  clearRenameSessionIf: (requestId: string) => void

  /** @deprecated Use startRenameSession via pendingRename helpers. */
  requestRename: (id: string, ...targets: RenameSurface[]) => void
  hasPendingRename: (target: RenameSurface, nodeId?: string) => boolean
  clearPendingRenameTarget: (target: RenameSurface) => void
  clearPendingRename: () => void
}

function pruneRenameIfNodeMissing(
  nodes: TreeNode[],
  session: RenameSession | null
): RenameSession | null {
  if (!session) return null
  if (nodes.some((n) => n.id === session.nodeId && !n.deletedAt)) return session
  return null
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
  containerViewModes: {},

  selectedEntityId: null,
  selectedEntityType: null,
  selectedEntryId: null,
  selectedEntryCategoryId: null,

  containerHistory: [],
  containerHistoryIndex: -1,

  theme: 'dark',
  focusMode: false,
  typewriterScrolling: 'focus' as TypewriterScrolling,
  entityHighlights: 'hide-in-focus' as EntityHighlights,
  sidebarWidth: SIDEBAR_MAX_WIDTH,
  rightPanelWidth: 320,
  rightPanelOpen: true,
  showNewProjectModal: false,
  showExportDialog: false,
  showBookSettingsModal: false,

  renameSession: null,

  setProject: (path, meta, nodes) =>
    set((s) => ({
      projectPath: path,
      projectId: meta.id,
      projectMeta: meta,
      isProjectOpen: true,
      isDirty: false,
      categories: meta.categories ?? [],
      ...(nodes
        ? {
            nodes,
            renameSession: pruneRenameIfNodeMissing(nodes, s.renameSession)
          }
        : {})
    })),

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
      renameSession: null,
      containerHistory: [],
      containerHistoryIndex: -1,
      containerViewModes: {}
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

  setNodes: (nodes) => {
    const s = get()
    const pruned = pruneContainerNavigation(
      {
        containerHistory: s.containerHistory,
        containerHistoryIndex: s.containerHistoryIndex,
        selectedContainerId: s.selectedContainerId
      },
      nodes,
      s.categories
    )
    set({
      nodes,
      ...pruned,
      renameSession: pruneRenameIfNodeMissing(nodes, s.renameSession)
    })
  },
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
        : {}),
      renameSession: s.renameSession?.nodeId === id ? null : s.renameSession
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
    const { containerHistory, containerHistoryIndex, nodes, categories } = get()
    let newIndex = containerHistoryIndex - 1
    while (newIndex >= 0) {
      const id = containerHistory[newIndex]
      if (isValidContainerId(id, nodes, categories)) {
        set({
          selectedContainerId: id,
          selectedNodeId: null,
          containerHistoryIndex: newIndex
        })
        return
      }
      newIndex--
    }
  },
  containerGoForward: () => {
    const { containerHistory, containerHistoryIndex, nodes, categories } = get()
    let newIndex = containerHistoryIndex + 1
    while (newIndex < containerHistory.length) {
      const id = containerHistory[newIndex]
      if (isValidContainerId(id, nodes, categories)) {
        set({
          selectedContainerId: id,
          selectedNodeId: null,
          containerHistoryIndex: newIndex
        })
        return
      }
      newIndex++
    }
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
  setContainerViewMode: (containerId, mode) =>
    set((state) => ({
      containerViewModes: { ...state.containerViewModes, [containerId]: mode }
    })),
  setContainerViewModes: (modes) => set({ containerViewModes: { ...modes } }),

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
  setFocusMode: (focusMode, options) => {
    document.documentElement.dataset.focusMode = focusMode ? 'true' : 'false'
    set({ focusMode })
    if (options?.persist !== false) {
      void window.electronAPI.tomes.updatePreferences({ focusMode })
    }
  },
  toggleFocusMode: () => {
    get().setFocusMode(!get().focusMode)
  },
  setTypewriterScrolling: (typewriterScrolling, options) => {
    set({ typewriterScrolling })
    if (options?.persist !== false) {
      void window.electronAPI.tomes.updatePreferences({ typewriterScrolling })
    }
  },
  setEntityHighlights: (entityHighlights, options) => {
    document.documentElement.dataset.entityHighlights = entityHighlights
    set({ entityHighlights })
    if (options?.persist !== false) {
      void window.electronAPI.tomes.updatePreferences({ entityHighlights })
    }
  },
  applyWritingPreferences: (prefs) => {
    if (prefs.theme !== undefined) {
      document.documentElement.classList.toggle('dark', prefs.theme === 'dark')
    }
    if (prefs.focusMode !== undefined) {
      document.documentElement.dataset.focusMode = prefs.focusMode ? 'true' : 'false'
    }
    if (prefs.entityHighlights !== undefined) {
      document.documentElement.dataset.entityHighlights = prefs.entityHighlights
    }
    set({
      ...(prefs.theme !== undefined ? { theme: prefs.theme } : {}),
      ...(prefs.focusMode !== undefined ? { focusMode: prefs.focusMode } : {}),
      ...(prefs.typewriterScrolling !== undefined
        ? { typewriterScrolling: prefs.typewriterScrolling }
        : {}),
      ...(prefs.entityHighlights !== undefined ? { entityHighlights: prefs.entityHighlights } : {})
    })
  },
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
  setShowExportDialog: (show) => set({ showExportDialog: show }),
  setShowBookSettingsModal: (show) => set({ showBookSettingsModal: show }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),

  applyNavigationSync: (nav) =>
    set((s) => ({
      selectedNodeId: nav.selectedNodeId,
      selectedContainerId: nav.selectedContainerId,
      selectedEntityId: nav.selectedEntityId,
      selectedEntityType: nav.selectedEntityType,
      selectedEntryId: nav.selectedEntryId ?? null,
      selectedEntryCategoryId: nav.selectedEntryCategoryId ?? null,
      expandedSections: migrateExpandedSections(nav.expandedSections),
      rightPanelOpen: nav.rightPanelOpen,
      sectionOrder: migrateSectionOrder(nav.sectionOrder, s.categories)
      // Intentionally preserve renameSession through navigation sync.
    })),

  startRenameSession: ({ nodeId, originalTitle, preferredSurfaces }) => {
    const session = createRenameSession({ nodeId, originalTitle, preferredSurfaces })
    set({ renameSession: session })
    return session.requestId
  },

  updateRenameDraft: (requestId, draft) => {
    const session = get().renameSession
    if (!session || session.requestId !== requestId) return
    if (session.phase === 'committing') return
    set({
      renameSession: {
        ...session,
        draft,
        phase: session.phase === 'waiting' ? 'editing' : session.phase
      }
    })
  },

  claimRenameOwner: (requestId, surface) => {
    const session = get().renameSession
    if (!session || session.requestId !== requestId) return false
    if (!session.preferredSurfaces.includes(surface)) return false
    if (session.owner === surface) return true
    if (session.owner !== null) {
      // Allow a more-preferred surface (earlier in preferredSurfaces) to steal.
      const ownerRank = session.preferredSurfaces.indexOf(session.owner)
      const claimRank = session.preferredSurfaces.indexOf(surface)
      if (claimRank < 0 || (ownerRank >= 0 && claimRank >= ownerRank)) return false
    }
    set({
      renameSession: {
        ...session,
        owner: surface,
        phase: session.phase === 'waiting' ? 'editing' : session.phase
      }
    })
    return true
  },

  releaseRenameOwner: (requestId, surface) => {
    const session = get().renameSession
    if (!session || session.requestId !== requestId) return
    if (session.owner !== surface) return
    set({
      renameSession: {
        ...session,
        owner: null,
        phase: session.phase === 'committing' ? session.phase : 'waiting'
      }
    })
  },

  markSelectAllConsumed: (requestId) => {
    const session = get().renameSession
    if (!session || session.requestId !== requestId) return
    if (session.selectAllConsumed) return
    set({ renameSession: { ...session, selectAllConsumed: true } })
  },

  setRenamePhase: (requestId, phase) => {
    const session = get().renameSession
    if (!session || session.requestId !== requestId) return
    set({ renameSession: { ...session, phase } })
  },

  cancelRenameSession: (requestId) => {
    const session = get().renameSession
    if (!session) return
    if (requestId !== undefined && session.requestId !== requestId) return
    set({ renameSession: null })
  },

  clearRenameSessionIf: (requestId) => {
    const session = get().renameSession
    if (!session || session.requestId !== requestId) return
    set({ renameSession: null })
  },

  requestRename: (id, ...targets) => {
    if (targets.length === 0) return
    const node = get().nodes.find((n) => n.id === id)
    get().startRenameSession({
      nodeId: id,
      originalTitle: node?.title ?? '',
      preferredSurfaces: targets
    })
  },

  hasPendingRename: (target, nodeId) => {
    const session = get().renameSession
    if (!session || !session.preferredSurfaces.includes(target)) return false
    if (nodeId !== undefined && session.nodeId !== nodeId) return false
    return true
  },

  clearPendingRenameTarget: (target) => {
    const session = get().renameSession
    if (!session) return
    const next = session.preferredSurfaces.filter((t) => t !== target)
    if (next.length === 0) {
      set({ renameSession: null })
      return
    }
    set({
      renameSession: {
        ...session,
        preferredSurfaces: next,
        owner: session.owner === target ? null : session.owner,
        phase: session.owner === target ? 'waiting' : session.phase
      }
    })
  },

  clearPendingRename: () => set({ renameSession: null })
}))

export function getContainerViewMode(
  state: Pick<AppState, 'containerViewModes'>,
  containerId: string
): ContainerViewMode {
  return state.containerViewModes[containerId] ?? 'cards'
}
