import { useAppStore } from '@/store/appStore'
import type { CategoryDefinition, NavigationSyncState, ProjectUiState, TreeNode } from '@shared/types'
import {
  normalizeProjectUiState,
  sanitizeProjectUiState
} from '@shared/projectUiState'

let uiRestoreInProgress = false

export function beginUiRestore(): void {
  uiRestoreInProgress = true
}

export function markUiRestoreComplete(): void {
  uiRestoreInProgress = false
}

export function isUiRestoreInProgress(): boolean {
  return uiRestoreInProgress
}

export function captureProjectUiState(): ProjectUiState {
  const s = useAppStore.getState()
  const categories = s.categories

  return {
    sectionOrder: [...s.sectionOrder],
    selectedNodeId: s.selectedNodeId,
    selectedContainerId: s.selectedContainerId,
    selectedEntityId: s.selectedEntityId,
    selectedEntityType: s.selectedEntityType,
    selectedEntryId: s.selectedEntryId,
    selectedEntryCategoryId: s.selectedEntryCategoryId,
    manuscriptInfoNodeId: s.manuscriptInfoNodeId,
    expandedSections: [...s.expandedSections],
    rightPanelOpen: s.rightPanelOpen,
    containerViewModes: { ...s.containerViewModes }
  }
}

function toNavigationSyncState(ui: ProjectUiState): NavigationSyncState {
  return {
    selectedNodeId: ui.selectedNodeId,
    selectedContainerId: ui.selectedContainerId,
    selectedEntityId: ui.selectedEntityId,
    selectedEntityType: ui.selectedEntityType,
    selectedEntryId: ui.selectedEntryId,
    selectedEntryCategoryId: ui.selectedEntryCategoryId,
    manuscriptInfoNodeId: ui.manuscriptInfoNodeId,
    expandedSections: ui.expandedSections,
    rightPanelOpen: ui.rightPanelOpen,
    sectionOrder: ui.sectionOrder
  }
}

function applyProjectUiState(
  ui: ProjectUiState,
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): ProjectUiState {
  const normalized = normalizeProjectUiState(ui, categories)
  const sanitized = sanitizeProjectUiState(normalized, nodes, categories)
  useAppStore.getState().applyNavigationSync(toNavigationSyncState(sanitized))
  useAppStore.getState().setContainerViewModes(sanitized.containerViewModes)
  return sanitized
}

export function resolveProjectUiOnOpen(
  ui: Partial<ProjectUiState> | undefined,
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): ProjectUiState {
  const normalized = normalizeProjectUiState(ui, categories)
  return applyProjectUiState(normalized, nodes, categories)
}
