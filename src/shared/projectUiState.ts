import type {
  CategoryDefinition,
  ChapterMeta,
  FolderMeta,
  FolderScope,
  ProjectUiState,
  TreeNode,
  WikiEntityType
} from './types'
import {
  BUILTIN_CATEGORY_IDS,
  DEFAULT_CHAPTER_META,
  DEFAULT_EXPANDED_SECTIONS,
  DEFAULT_FOLDER_META,
  DEFAULT_SECTION_ORDER,
  migrateExpandedSections,
  migrateSectionOrder,
  parseMetadata
} from './types'
import { folderScopeForCategory } from './categoryPresets'

const LEGACY_SECTION_TO_CATEGORY: Record<string, string> = {
  characters: BUILTIN_CATEGORY_IDS.characters,
  locations: BUILTIN_CATEGORY_IDS.locations,
  lore: BUILTIN_CATEGORY_IDS.lore,
  notes: BUILTIN_CATEGORY_IDS.notes
}

const WIKI_ENTITY_TYPES = new Set<WikiEntityType>(['character', 'location', 'lore', 'note'])
const EDITABLE_NODE_TYPES = new Set(['chapter', 'scene'])

function isExpandableTreeNode(node: TreeNode): boolean {
  if (node.deletedAt) return false
  if (node.type === 'folder') return true
  if (node.type === 'chapter') {
    const meta = parseMetadata<ChapterMeta>(node.metadata, DEFAULT_CHAPTER_META)
    return meta.structure === 'scenes'
  }
  return false
}

export function defaultProjectUiState(categories: CategoryDefinition[]): ProjectUiState {
  const categoryIds = new Set(categories.map((c) => c.id))
  const sectionOrder =
    categories.length > 0
      ? [...categories].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id)
      : [...DEFAULT_SECTION_ORDER]

  const expandedSections = [...DEFAULT_EXPANDED_SECTIONS].filter(
    (id) => id === 'manuscript' || categoryIds.has(id) || categoryIds.has(LEGACY_SECTION_TO_CATEGORY[id] ?? '')
  )

  return {
    sectionOrder,
    selectedNodeId: null,
    selectedContainerId: null,
    selectedEntityId: null,
    selectedEntityType: null,
    selectedEntryId: null,
    selectedEntryCategoryId: null,
    expandedSections,
    rightPanelOpen: false
  }
}

export function normalizeProjectUiState(
  raw: Partial<ProjectUiState> | undefined,
  categories: CategoryDefinition[]
): ProjectUiState {
  const defaults = defaultProjectUiState(categories)

  if (!raw) return defaults

  return {
    ...defaults,
    ...raw,
    sectionOrder: Array.isArray(raw.sectionOrder)
      ? migrateSectionOrder(raw.sectionOrder, categories)
      : defaults.sectionOrder,
    selectedNodeId: typeof raw.selectedNodeId === 'string' ? raw.selectedNodeId : null,
    selectedContainerId:
      typeof raw.selectedContainerId === 'string' ? raw.selectedContainerId : null,
    selectedEntityId: typeof raw.selectedEntityId === 'string' ? raw.selectedEntityId : null,
    selectedEntityType:
      raw.selectedEntityType && WIKI_ENTITY_TYPES.has(raw.selectedEntityType)
        ? raw.selectedEntityType
        : null,
    selectedEntryId: typeof raw.selectedEntryId === 'string' ? raw.selectedEntryId : null,
    selectedEntryCategoryId:
      typeof raw.selectedEntryCategoryId === 'string' ? raw.selectedEntryCategoryId : null,
    expandedSections: [
      ...(Array.isArray(raw.expandedSections)
        ? migrateExpandedSections(raw.expandedSections)
        : defaults.expandedSections),
      ...(Array.isArray(raw.expandedFolders)
        ? raw.expandedFolders.filter((id): id is string => typeof id === 'string')
        : [])
    ],
    rightPanelOpen: typeof raw.rightPanelOpen === 'boolean' ? raw.rightPanelOpen : false
  }
}

export function isValidContainerId(
  id: string,
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): boolean {
  if (id === 'manuscript' || id === 'trash') return true
  if (id.startsWith('trash:')) return true
  if (categories.some((c) => c.id === id)) return true
  if (LEGACY_SECTION_TO_CATEGORY[id] && categories.some((c) => c.id === LEGACY_SECTION_TO_CATEGORY[id])) {
    return true
  }
  if (id.startsWith('folder:')) {
    const folderId = id.slice('folder:'.length)
    return nodes.some((n) => n.id === folderId && n.type === 'folder' && !n.deletedAt)
  }
  return false
}

export interface ContainerNavState {
  containerHistory: string[]
  containerHistoryIndex: number
  selectedContainerId: string | null
}

function folderContainerId(folderId: string): string {
  return `folder:${folderId}`
}

function parseFolderContainerId(id: string): string | null {
  if (!id.startsWith('folder:')) return null
  return id.slice('folder:'.length)
}

function resolveScopeRootContainerId(scope: FolderScope, categories: CategoryDefinition[]): string {
  if (scope === 'manuscript') return 'manuscript'
  const cat = categories.find((c) => folderScopeForCategory(c) === scope)
  return cat?.id ?? 'manuscript'
}

function resolveFallbackFromTreeAncestry(
  folderId: string,
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): string | null {
  let current = nodes.find((n) => n.id === folderId)
  while (current?.parentId) {
    const parent = nodes.find((n) => n.id === current!.parentId)
    if (parent?.type === 'folder') {
      const parentContainerId = folderContainerId(parent.id)
      if (isValidContainerId(parentContainerId, nodes, categories)) {
        return parentContainerId
      }
    }
    current = parent
  }
  return null
}

function resolveFallbackFromHistory(
  originalHistory: string[],
  startIndex: number,
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): string | null {
  for (let i = startIndex; i >= 0; i--) {
    const id = originalHistory[i]
    if (isValidContainerId(id, nodes, categories)) return id
  }
  return null
}

function resolveInvalidContainerSelection(
  invalidId: string,
  state: ContainerNavState,
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): string {
  const folderId = parseFolderContainerId(invalidId)
  if (folderId) {
    const fromTree = resolveFallbackFromTreeAncestry(folderId, nodes, categories)
    if (fromTree) return fromTree

    const fromHistory = resolveFallbackFromHistory(
      state.containerHistory,
      state.containerHistoryIndex,
      nodes,
      categories
    )
    if (fromHistory) return fromHistory

    const folder = nodes.find((n) => n.id === folderId)
    if (folder?.type === 'folder') {
      const meta = parseMetadata<FolderMeta>(folder.metadata, DEFAULT_FOLDER_META)
      return resolveScopeRootContainerId(meta.scope, categories)
    }
  }

  const fromHistory = resolveFallbackFromHistory(
    state.containerHistory,
    state.containerHistoryIndex,
    nodes,
    categories
  )
  if (fromHistory) return fromHistory

  return 'manuscript'
}

function syncHistoryToSelection(
  filteredHistory: string[],
  selectedContainerId: string
): { containerHistory: string[]; containerHistoryIndex: number } {
  const index = filteredHistory.indexOf(selectedContainerId)
  if (index >= 0) {
    return { containerHistory: filteredHistory, containerHistoryIndex: index }
  }
  return {
    containerHistory: [selectedContainerId],
    containerHistoryIndex: 0
  }
}

export function pruneContainerNavigation(
  state: ContainerNavState,
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): ContainerNavState {
  const filteredHistory = state.containerHistory.filter((id) =>
    isValidContainerId(id, nodes, categories)
  )

  if (state.selectedContainerId === null) {
    let index = state.containerHistoryIndex
    if (filteredHistory.length === 0) {
      index = -1
    } else if (index >= filteredHistory.length) {
      index = filteredHistory.length - 1
    }
    return {
      containerHistory: filteredHistory,
      containerHistoryIndex: index,
      selectedContainerId: null
    }
  }

  let selectedContainerId = state.selectedContainerId

  if (!isValidContainerId(selectedContainerId, nodes, categories)) {
    selectedContainerId = resolveInvalidContainerSelection(
      selectedContainerId,
      state,
      nodes,
      categories
    )
  }

  const { containerHistory, containerHistoryIndex } = syncHistoryToSelection(
    filteredHistory,
    selectedContainerId
  )

  return {
    containerHistory,
    containerHistoryIndex,
    selectedContainerId
  }
}

function isValidWikiNode(node: TreeNode | undefined, type: WikiEntityType): boolean {
  return Boolean(node && !node.deletedAt && node.type === type)
}

export function getFirstChapterNodeId(nodes: TreeNode[]): string | null {
  const chapters = nodes.filter((n) => !n.deletedAt && n.type === 'chapter').sort((a, b) => a.sortOrder - b.sortOrder)
  if (chapters.length === 0) return null
  const firstChapter = chapters[0]
  const scenes = nodes
    .filter((n) => !n.deletedAt && n.parentId === firstChapter.id && n.type === 'scene')
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return scenes[0]?.id ?? firstChapter.id
}

export function sanitizeProjectUiState(
  ui: ProjectUiState,
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): ProjectUiState {
  const categoryIds = new Set(categories.map((c) => c.id))

  let selectedNodeId = ui.selectedNodeId
  if (selectedNodeId) {
    const node = nodes.find((n) => n.id === selectedNodeId)
    if (!node || node.deletedAt || !EDITABLE_NODE_TYPES.has(node.type)) {
      selectedNodeId = null
    }
  }

  let selectedEntityId = ui.selectedEntityId
  let selectedEntityType = ui.selectedEntityType
  if (selectedEntityId && selectedEntityType) {
    const node = nodes.find((n) => n.id === selectedEntityId)
    if (!isValidWikiNode(node, selectedEntityType)) {
      selectedEntityId = null
      selectedEntityType = null
    }
  } else {
    selectedEntityId = null
    selectedEntityType = null
  }

  let selectedEntryId = ui.selectedEntryId
  let selectedEntryCategoryId = ui.selectedEntryCategoryId
  if (selectedEntryId) {
    const node = nodes.find((n) => n.id === selectedEntryId)
    if (!node || node.deletedAt || node.type !== 'entry') {
      selectedEntryId = null
      selectedEntryCategoryId = null
    } else if (selectedEntryCategoryId && node.categoryId !== selectedEntryCategoryId) {
      selectedEntryCategoryId = node.categoryId ?? null
    } else if (!selectedEntryCategoryId && node.categoryId) {
      selectedEntryCategoryId = node.categoryId
    }
  } else {
    selectedEntryId = null
    selectedEntryCategoryId = null
  }

  let selectedContainerId = ui.selectedContainerId
  if (selectedContainerId && !isValidContainerId(selectedContainerId, nodes, categories)) {
    selectedContainerId = null
  }

  const expandedSections = [...migrateExpandedSections(ui.expandedSections)].filter(
    (id) => {
      if (id === 'manuscript' || id === 'trash') return true
      if (categoryIds.has(id)) return true
      const node = nodes.find((n) => n.id === id)
      return Boolean(node && isExpandableTreeNode(node))
    }
  )

  const hasPanelSelection = Boolean(
    (selectedEntityId && selectedEntityType) || (selectedEntryId && selectedEntryCategoryId)
  )
  const rightPanelOpen = hasPanelSelection ? ui.rightPanelOpen : false

  if (!selectedNodeId && !selectedContainerId && !hasPanelSelection) {
    selectedNodeId = getFirstChapterNodeId(nodes)
  }

  return {
    sectionOrder: migrateSectionOrder(ui.sectionOrder, categories),
    selectedNodeId,
    selectedContainerId,
    selectedEntityId,
    selectedEntityType,
    selectedEntryId,
    selectedEntryCategoryId,
    expandedSections,
    rightPanelOpen
  }
}
