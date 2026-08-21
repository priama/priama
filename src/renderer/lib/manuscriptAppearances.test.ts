import { describe, expect, it } from 'vitest'
import { defaultFictionCategories } from '@shared/categoryPresets'
import type { TreeNode } from '@shared/types'
import {
  appearanceLabel,
  appearancesForEntity,
  buildManuscriptAppearances,
  countLabel,
  listManuscriptProseNodes
} from '@/lib/manuscriptAppearances'

const categories = defaultFictionCategories()

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

function simpleChapter(
  id: string,
  title: string,
  content: string,
  sortOrder: number
): TreeNode {
  return node({
    id,
    type: 'chapter',
    parentId: null,
    title,
    content,
    sortOrder,
    metadata: JSON.stringify({ structure: 'simple' })
  })
}

function scenesChapter(id: string, title: string, sortOrder: number): TreeNode {
  return node({
    id,
    type: 'chapter',
    parentId: null,
    title,
    sortOrder,
    metadata: JSON.stringify({ structure: 'scenes' })
  })
}

describe('countLabel', () => {
  it('singular and plural', () => {
    expect(countLabel(1)).toBe('1 time')
    expect(countLabel(6)).toBe('6 times')
  })
})

describe('listManuscriptProseNodes', () => {
  it('includes simple chapters and scenes, skips scene folders', () => {
    const ch1 = simpleChapter('ch1', 'The Docks', '<p>Ankros walked.</p>', 0)
    const ch2 = scenesChapter('ch2', 'The Keep', 1)
    const s1 = node({
      id: 's1',
      type: 'scene',
      parentId: 'ch2',
      title: 'Arrival',
      content: '<p>Hello.</p>',
      sortOrder: 0
    })
    const s2 = node({
      id: 's2',
      type: 'scene',
      parentId: 'ch2',
      title: 'Fight',
      content: '<p>Clash.</p>',
      sortOrder: 1
    })
    const character = node({
      id: 'c1',
      type: 'character',
      parentId: null,
      title: 'Ankros'
    })

    const prose = listManuscriptProseNodes([ch1, ch2, s1, s2, character])
    expect(prose.map((n) => n.id)).toEqual(['ch1', 's1', 's2'])
  })
})

describe('appearanceLabel', () => {
  it('labels simple chapters and scenes', () => {
    const ch1 = simpleChapter('ch1', 'The Docks', '', 0)
    const ch2 = scenesChapter('ch2', 'The Keep', 1)
    const s1 = node({
      id: 's1',
      type: 'scene',
      parentId: 'ch2',
      title: 'Arrival',
      sortOrder: 0
    })
    const s2 = node({
      id: 's2',
      type: 'scene',
      parentId: 'ch2',
      title: 'Fight',
      sortOrder: 1
    })
    const nodes = [ch1, ch2, s1, s2]

    expect(appearanceLabel('ch1', nodes)).toBe('Ch. 1 · The Docks')
    expect(appearanceLabel('s2', nodes)).toBe('Ch. 2, scene 2')
  })
})

describe('buildManuscriptAppearances', () => {
  it('counts matches per prose node with the title trie', () => {
    const character = node({
      id: 'c1',
      type: 'character',
      parentId: null,
      title: 'Ankros'
    })
    const ch1 = simpleChapter(
      'ch1',
      'The Docks',
      '<p>Ankros walked. Ankros smiled. Ankros left. Ankros returned. Ankros slept. Ankros woke.</p>',
      0
    )
    const ch2 = scenesChapter('ch2', 'The Keep', 1)
    const s1 = node({
      id: 's1',
      type: 'scene',
      parentId: 'ch2',
      title: 'Arrival',
      content: '<p>Ankros arrived.</p>',
      sortOrder: 0
    })
    const nodes = [character, ch1, ch2, s1]

    const map = buildManuscriptAppearances(nodes, categories)
    expect(map.get('c1')).toEqual([
      { nodeId: 'ch1', count: 6 },
      { nodeId: 's1', count: 1 }
    ])
  })

  it('builds labeled rows for an entity', () => {
    const character = node({
      id: 'c1',
      type: 'character',
      parentId: null,
      title: 'Ankros'
    })
    const ch1 = simpleChapter('ch1', 'The Docks', '<p>Ankros walked.</p>', 0)
    const ch2 = scenesChapter('ch2', 'Elsewhere', 1)
    const s1 = node({
      id: 's1',
      type: 'scene',
      parentId: 'ch2',
      title: 'Quiet',
      content: '<p>Nothing here.</p>',
      sortOrder: 0
    })
    const s2 = node({
      id: 's2',
      type: 'scene',
      parentId: 'ch2',
      title: 'Return',
      content: '<p>Ankros returned.</p>',
      sortOrder: 1
    })

    const rows = appearancesForEntity('c1', [character, ch1, ch2, s1, s2], categories)
    expect(rows).toEqual([
      { nodeId: 'ch1', label: 'Ch. 1 · The Docks', count: 1, countLabel: '1 time' },
      { nodeId: 's2', label: 'Ch. 2, scene 2', count: 1, countLabel: '1 time' }
    ])
  })

  it('returns empty when entity never appears', () => {
    const character = node({
      id: 'c1',
      type: 'character',
      parentId: null,
      title: 'Ankros'
    })
    const ch1 = simpleChapter('ch1', 'Empty', '<p>Nobody here.</p>', 0)
    expect(appearancesForEntity('c1', [character, ch1], categories)).toEqual([])
  })
})
