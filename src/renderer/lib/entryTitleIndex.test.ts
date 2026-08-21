import { describe, expect, it } from 'vitest'
import { defaultFictionCategories } from '@shared/categoryPresets'
import { BUILTIN_CATEGORY_IDS, serializeMetadata } from '@shared/types'
import type { CategoryDefinition, CharacterMeta, TreeNode } from '@shared/types'
import {
  buildEntryTitleIndex,
  findEntityMatches,
  panelEntryFingerprint,
  phrasesForNode,
  tokenizeWords
} from '@/lib/entryTitleIndex'

const panelCategoryId = 'custom-panel'

const panelCategory: CategoryDefinition = {
  id: panelCategoryId,
  name: 'People',
  icon: 'Users',
  mode: 'panel',
  sortOrder: 50,
  builtIn: false,
  nodeKind: 'entry'
}

const editorCategory: CategoryDefinition = {
  id: 'custom-editor',
  name: 'Entries',
  icon: 'FileText',
  mode: 'editor',
  sortOrder: 51,
  builtIn: false,
  nodeKind: 'entry'
}

const categories = [...defaultFictionCategories(), panelCategory, editorCategory]

function node(
  partial: Pick<TreeNode, 'id' | 'type' | 'parentId'> &
    Partial<Omit<TreeNode, 'id' | 'type' | 'parentId'>>
): TreeNode {
  return {
    title: partial.title ?? 'Node',
    sortOrder: partial.sortOrder ?? 0,
    content: partial.content ?? '',
    metadata: partial.metadata ?? '{}',
    createdAt: partial.createdAt ?? '',
    updatedAt: partial.updatedAt ?? '',
    ...partial
  }
}

function characterWithAliases(id: string, title: string, aliases: string[]): TreeNode {
  return node({
    id,
    type: 'character',
    parentId: null,
    title,
    metadata: serializeMetadata({ aliases } as CharacterMeta)
  })
}

describe('tokenizeWords', () => {
  it('tokenizes words with offsets', () => {
    const tokens = tokenizeWords('Two Rivers flow')
    expect(tokens).toEqual([
      { word: 'Two', from: 0, to: 3 },
      { word: 'Rivers', from: 4, to: 10 },
      { word: 'flow', from: 11, to: 15 }
    ])
  })
})

describe('phrasesForNode', () => {
  it('returns title and non-empty character aliases', () => {
    const n = characterWithAliases('c1', 'Ankros', ['Ank', '', '  The Shadow  ', 'Ankros'])
    expect(phrasesForNode(n)).toEqual(['Ankros', 'Ank', 'The Shadow'])
  })

  it('returns only title for non-characters', () => {
    const n = node({ id: 'l1', type: 'location', parentId: null, title: 'Two Rivers' })
    expect(phrasesForNode(n)).toEqual(['Two Rivers'])
  })
})

describe('buildEntryTitleIndex', () => {
  it('indexes wiki entity titles', () => {
    const nodes = [
      node({ id: 'c1', type: 'character', parentId: null, title: 'Ankros' }),
      node({ id: 'l1', type: 'location', parentId: null, title: 'Two Rivers' })
    ]
    const index = buildEntryTitleIndex(nodes, categories)
    const matches = findEntityMatches(index, 'Ankros went to Two Rivers')
    expect(matches).toHaveLength(2)
    expect(matches[0].entry.id).toBe('c1')
    expect(matches[1].entry.id).toBe('l1')
    expect(matches[1].from).toBe(15)
    expect(matches[1].to).toBe(25)
  })

  it('is case insensitive', () => {
    const nodes = [node({ id: 'c1', type: 'character', parentId: null, title: 'Grace' })]
    const index = buildEntryTitleIndex(nodes, categories)
    const matches = findEntityMatches(index, 'grace smiled')
    expect(matches).toHaveLength(1)
    expect(matches[0].entry.title).toBe('Grace')
  })

  it('indexes character aliases as the same entry', () => {
    const nodes = [characterWithAliases('c1', 'Ankros', ['The Shadow'])]
    const index = buildEntryTitleIndex(nodes, categories)
    const matches = findEntityMatches(index, 'The Shadow arrived')
    expect(matches).toHaveLength(1)
    expect(matches[0].entry.id).toBe('c1')
    expect(matches[0].entry.title).toBe('Ankros')
  })

  it('matches aliases case-insensitively', () => {
    const nodes = [characterWithAliases('c1', 'Ankros', ['The Shadow'])]
    const index = buildEntryTitleIndex(nodes, categories)
    const matches = findEntityMatches(index, 'the shadow smiled')
    expect(matches).toHaveLength(1)
    expect(matches[0].entry.id).toBe('c1')
  })

  it('skips empty aliases', () => {
    const nodes = [characterWithAliases('c1', 'Ankros', ['', '  '])]
    const index = buildEntryTitleIndex(nodes, categories)
    expect(findEntityMatches(index, 'Ankros')).toHaveLength(1)
    expect(findEntityMatches(index, '  ')).toHaveLength(0)
  })

  it('indexes panel-mode entry nodes', () => {
    const nodes = [
      node({
        id: 'e1',
        type: 'entry',
        parentId: null,
        categoryId: panelCategoryId,
        title: 'Captain Hale'
      })
    ]
    const index = buildEntryTitleIndex(nodes, categories)
    const matches = findEntityMatches(index, 'Captain Hale arrived')
    expect(matches).toHaveLength(1)
    expect(matches[0].entry.type).toBe('entry')
    expect(matches[0].entry.categoryId).toBe(panelCategoryId)
  })

  it('excludes main-editor entry nodes', () => {
    const nodes = [
      node({
        id: 'e2',
        type: 'entry',
        parentId: null,
        categoryId: editorCategory.id,
        title: 'Draft Entry'
      })
    ]
    const index = buildEntryTitleIndex(nodes, categories)
    expect(findEntityMatches(index, 'Draft Entry')).toHaveLength(0)
  })

  it('excludes deleted nodes', () => {
    const nodes = [
      node({
        id: 'c1',
        type: 'character',
        parentId: null,
        title: 'Ankros',
        deletedAt: '2026-01-01T00:00:00.000Z'
      })
    ]
    const index = buildEntryTitleIndex(nodes, categories)
    expect(findEntityMatches(index, 'Ankros')).toHaveLength(0)
  })

  it('prefers longest multi-word match', () => {
    const nodes = [
      node({ id: 'l1', type: 'location', parentId: null, title: 'Two' }),
      node({ id: 'l2', type: 'location', parentId: null, title: 'Two Rivers' })
    ]
    const index = buildEntryTitleIndex(nodes, categories)
    const matches = findEntityMatches(index, 'Two Rivers')
    expect(matches).toHaveLength(1)
    expect(matches[0].entry.id).toBe('l2')
  })

  it('does not match partial phrases', () => {
    const nodes = [node({ id: 'l1', type: 'location', parentId: null, title: 'Two Rivers' })]
    const index = buildEntryTitleIndex(nodes, categories)
    expect(findEntityMatches(index, 'Two Riverside')).toHaveLength(0)
  })
})

describe('panelEntryFingerprint', () => {
  it('changes when a panel entry title changes', () => {
    const nodesA = [
      node({
        id: 'c1',
        type: 'character',
        parentId: null,
        title: 'Ankros',
        categoryId: BUILTIN_CATEGORY_IDS.characters
      })
    ]
    const nodesB = [
      node({
        id: 'c1',
        type: 'character',
        parentId: null,
        title: 'Ankros the Wise',
        categoryId: BUILTIN_CATEGORY_IDS.characters
      })
    ]
    expect(panelEntryFingerprint(nodesA, categories)).not.toBe(panelEntryFingerprint(nodesB, categories))
  })

  it('changes when character aliases change', () => {
    const nodesA = [characterWithAliases('c1', 'Ankros', ['Ank'])]
    const nodesB = [characterWithAliases('c1', 'Ankros', ['The Shadow'])]
    expect(panelEntryFingerprint(nodesA, categories)).not.toBe(panelEntryFingerprint(nodesB, categories))
  })
})
