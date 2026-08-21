import { describe, expect, it } from 'vitest'
import {
  isValidContainerId,
  normalizeContainerViewModes,
  normalizeProjectUiState,
  pruneContainerNavigation,
  sanitizeProjectUiState
} from './projectUiState'
import type { CategoryDefinition, ProjectUiState, TreeNode } from './types'

const categories: CategoryDefinition[] = []

function sceneChapter(id: string): TreeNode {
  return {
    id,
    parentId: null,
    type: 'chapter',
    title: 'Chapter',
    sortOrder: 0,
    content: '',
    metadata: JSON.stringify({ structure: 'scenes' }),
    createdAt: '',
    updatedAt: ''
  }
}

function folder(id: string): TreeNode {
  return manuscriptFolder(id, null)
}

function manuscriptFolder(
  id: string,
  parentId: string | null,
  title = 'Folder',
  deletedAt?: string
): TreeNode {
  return {
    id,
    parentId,
    type: 'folder',
    title,
    sortOrder: 0,
    content: '',
    metadata: JSON.stringify({ scope: 'manuscript' }),
    createdAt: '',
    updatedAt: '',
    ...(deletedAt ? { deletedAt } : {})
  }
}

const baseUi: ProjectUiState = {
  sectionOrder: [],
  selectedNodeId: null,
  selectedContainerId: null,
  selectedEntityId: null,
  selectedEntityType: null,
  selectedEntryId: null,
  selectedEntryCategoryId: null,
  manuscriptInfoNodeId: null,
  expandedSections: ['manuscript'],
  rightPanelOpen: false,
  containerViewModes: {}
}

describe('normalizeContainerViewModes', () => {
  it('returns empty object for missing or non-object values', () => {
    expect(normalizeContainerViewModes(undefined)).toEqual({})
    expect(normalizeContainerViewModes(null)).toEqual({})
    expect(normalizeContainerViewModes('cards')).toEqual({})
    expect(normalizeContainerViewModes(['list'])).toEqual({})
  })

  it('keeps only cards/list string values', () => {
    expect(
      normalizeContainerViewModes({
        manuscript: 'list',
        'folder:a': 'cards',
        bad: 'grid',
        empty: '',
        num: 1
      })
    ).toEqual({
      manuscript: 'list',
      'folder:a': 'cards'
    })
  })
})

describe('normalizeProjectUiState containerViewModes', () => {
  it('defaults missing containerViewModes to empty object', () => {
    const withoutModes = { ...baseUi } as Partial<ProjectUiState>
    delete withoutModes.containerViewModes
    const result = normalizeProjectUiState(withoutModes, categories)
    expect(result.containerViewModes).toEqual({})
  })

  it('filters malformed containerViewModes on normalize', () => {
    const result = normalizeProjectUiState(
      {
        ...baseUi,
        containerViewModes: {
          manuscript: 'list',
          trash: 'nope'
        } as unknown as ProjectUiState['containerViewModes']
      },
      categories
    )
    expect(result.containerViewModes).toEqual({ manuscript: 'list' })
  })
})

describe('sanitizeProjectUiState containerViewModes', () => {
  it('keeps valid container and chapter keys', () => {
    const chapter = sceneChapter('chapter-1')
    const f = folder('folder-1')
    const ui = {
      ...baseUi,
      containerViewModes: {
        manuscript: 'list' as const,
        'folder:folder-1': 'list' as const,
        'chapter:chapter-1': 'cards' as const,
        'folder:missing': 'list' as const,
        'chapter:gone': 'list' as const
      }
    }
    const result = sanitizeProjectUiState(ui, [chapter, f], categories)
    expect(result.containerViewModes).toEqual({
      manuscript: 'list',
      'folder:folder-1': 'list',
      'chapter:chapter-1': 'cards'
    })
  })

  it('drops chapter keys for simple chapters', () => {
    const chapter: TreeNode = {
      ...sceneChapter('chapter-simple'),
      metadata: JSON.stringify({ structure: 'simple' })
    }
    const ui = {
      ...baseUi,
      containerViewModes: { 'chapter:chapter-simple': 'list' as const }
    }
    const result = sanitizeProjectUiState(ui, [chapter], categories)
    expect(result.containerViewModes).toEqual({})
  })
})

describe('sanitizeProjectUiState expandedSections', () => {
  it('keeps expanded scene chapter ids', () => {
    const chapter = sceneChapter('chapter-1')
    const ui = { ...baseUi, expandedSections: ['manuscript', chapter.id] }
    const result = sanitizeProjectUiState(ui, [chapter], categories)
    expect(result.expandedSections).toContain(chapter.id)
  })

  it('keeps expanded folder ids', () => {
    const f = folder('folder-1')
    const ui = { ...baseUi, expandedSections: ['manuscript', f.id] }
    const result = sanitizeProjectUiState(ui, [f], categories)
    expect(result.expandedSections).toContain(f.id)
  })

  it('drops simple chapter ids', () => {
    const chapter: TreeNode = {
      ...sceneChapter('chapter-simple'),
      metadata: JSON.stringify({ structure: 'simple' })
    }
    const ui = { ...baseUi, expandedSections: ['manuscript', chapter.id] }
    const result = sanitizeProjectUiState(ui, [chapter], categories)
    expect(result.expandedSections).not.toContain(chapter.id)
  })
})

describe('isValidContainerId', () => {
  it('rejects trashed folder container ids', () => {
    const f = manuscriptFolder('folder-a', null, 'A', '2026-01-01T00:00:00.000Z')
    expect(isValidContainerId('folder:folder-a', [f], categories)).toBe(false)
  })

  it('accepts active folder container ids', () => {
    const f = manuscriptFolder('folder-a', null)
    expect(isValidContainerId('folder:folder-a', [f], categories)).toBe(true)
  })
})

describe('pruneContainerNavigation', () => {
  const a = manuscriptFolder('a', null, 'A')
  const b = manuscriptFolder('b', 'a', 'B')
  const c = manuscriptFolder('c', 'b', 'C')

  it('cascade trash resets to manuscript', () => {
    const trashed = [
      manuscriptFolder('a', null, 'A', 't'),
      manuscriptFolder('b', 'a', 'B', 't'),
      manuscriptFolder('c', 'b', 'C', 't')
    ]
    const result = pruneContainerNavigation(
      {
        containerHistory: ['manuscript', 'folder:a', 'folder:b', 'folder:c'],
        containerHistoryIndex: 3,
        selectedContainerId: 'folder:c'
      },
      trashed,
      categories
    )
    expect(result.selectedContainerId).toBe('manuscript')
    expect(result.containerHistory).toEqual(['manuscript'])
    expect(result.containerHistoryIndex).toBe(0)
  })

  it('partial subtree trash falls back to tree parent folder', () => {
    const nodes = [a, b, manuscriptFolder('c', 'b', 'C', 't')]
    const result = pruneContainerNavigation(
      {
        containerHistory: ['manuscript', 'folder:a', 'folder:b', 'folder:c'],
        containerHistoryIndex: 3,
        selectedContainerId: 'folder:c'
      },
      nodes,
      categories
    )
    expect(result.selectedContainerId).toBe('folder:b')
    expect(result.containerHistoryIndex).toBe(2)
  })

  it('null selection prunes history without coercing selection', () => {
    const trashed = [manuscriptFolder('c', 'b', 'C', 't')]
    const result = pruneContainerNavigation(
      {
        containerHistory: ['manuscript', 'folder:c'],
        containerHistoryIndex: 1,
        selectedContainerId: null
      },
      trashed,
      categories
    )
    expect(result.selectedContainerId).toBeNull()
    expect(result.containerHistory).toEqual(['manuscript'])
    expect(result.containerHistoryIndex).toBe(0)
  })

  it('leaves valid navigation unchanged', () => {
    const nodes = [a, b, c]
    const state = {
      containerHistory: ['manuscript', 'folder:a', 'folder:b'],
      containerHistoryIndex: 2,
      selectedContainerId: 'folder:b'
    }
    const result = pruneContainerNavigation(state, nodes, categories)
    expect(result).toEqual(state)
  })
})
