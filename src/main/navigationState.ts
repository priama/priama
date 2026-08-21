import type { NavigationSyncState } from '@shared/types'
import { DEFAULT_SECTION_ORDER, DEFAULT_EXPANDED_SECTIONS, migrateExpandedSections } from '@shared/types'

const DEFAULT_EXPANDED = [...DEFAULT_EXPANDED_SECTIONS]

const DEFAULT: NavigationSyncState = {
  selectedNodeId: null,
  selectedContainerId: null,
  selectedEntityId: null,
  selectedEntityType: null,
  manuscriptInfoNodeId: null,
  expandedSections: [...DEFAULT_EXPANDED],
  rightPanelOpen: true,
  sectionOrder: [...DEFAULT_SECTION_ORDER]
}

let state: NavigationSyncState = { ...DEFAULT }

export function getNavigationState(): NavigationSyncState {
  return state
}

export function setNavigationState(next: NavigationSyncState): NavigationSyncState {
  state = {
    ...next,
    expandedSections: [...migrateExpandedSections(next.expandedSections)]
  }
  return state
}

export function resetNavigationState(): void {
  state = { ...DEFAULT, expandedSections: [...DEFAULT_EXPANDED], sectionOrder: [...DEFAULT_SECTION_ORDER] }
}
