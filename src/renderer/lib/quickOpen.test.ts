/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { defaultFictionCategories } from '@shared/categoryPresets'
import type { TreeNode } from '@shared/types'
import {
  fuzzyMatch,
  listQuickOpenCandidates,
  searchQuickOpen
} from '@/lib/quickOpen'

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
    deletedAt: partial.deletedAt ?? null,
    ...partial
  }
}

function simpleChapter(
  id: string,
  title: string,
  content: string,
  sortOrder: number,
  extra?: Partial<TreeNode>
): TreeNode {
  return node({
    id,
    type: 'chapter',
    parentId: null,
    title,
    content,
    sortOrder,
    metadata: JSON.stringify({ structure: 'simple', synopsis: '' }),
    ...extra
  })
}

describe('fuzzyMatch', () => {
  it('returns empty match for blank query', () => {
    expect(fuzzyMatch('', 'Obsidian')).toEqual({ score: 0, positions: [] })
    expect(fuzzyMatch('   ', 'Obsidian')).toEqual({ score: 0, positions: [] })
  })

  it('matches case-insensitive substrings and prefers prefixes', () => {
    const prefix = fuzzyMatch('obs', 'Obsidian Order')
    const later = fuzzyMatch('obs', 'The Obsidian Key')
    expect(prefix).not.toBeNull()
    expect(later).not.toBeNull()
    expect(prefix!.score).toBeGreaterThan(later!.score)
    expect(prefix!.positions).toEqual([0, 1, 2])
  })

  it('matches subsequences when the query is not a substring', () => {
    const match = fuzzyMatch('obdn', 'Obsidian')
    expect(match).not.toBeNull()
    expect(match!.positions.length).toBe(4)
  })

  it('returns null when characters are missing', () => {
    expect(fuzzyMatch('xyz', 'Obsidian')).toBeNull()
  })
})

describe('listQuickOpenCandidates / searchQuickOpen', () => {
  it('lists manuscript folders, chapters, and scenes in reading order before wiki', () => {
    const folder = node({
      id: 'part',
      type: 'folder',
      parentId: null,
      title: 'Part II',
      sortOrder: 0,
      metadata: JSON.stringify({ scope: 'manuscript' })
    })
    const ch = node({
      id: 'ch1',
      type: 'chapter',
      parentId: 'part',
      title: 'The Docks',
      sortOrder: 0,
      metadata: JSON.stringify({ structure: 'scenes' })
    })
    const scene = node({
      id: 's1',
      type: 'scene',
      parentId: 'ch1',
      title: 'Arrival',
      sortOrder: 0
    })
    const lore = node({
      id: 'lore1',
      type: 'lore',
      parentId: null,
      title: 'Obsidian Order',
      content: '<p>Secret society.</p>',
      sortOrder: 0
    })

    const candidates = listQuickOpenCandidates([folder, ch, scene, lore], categories)
    expect(candidates.map((c) => c.nodeId)).toEqual(['part', 'ch1', 's1', 'lore1'])
    expect(candidates[0]?.group).toBe('manuscript')
    expect(candidates[3]?.group).toBe('wiki')
    expect(candidates.find((c) => c.nodeId === 's1')?.breadcrumb).toContain('The Docks')
  })

  it('does not search note bodies', () => {
    const note = node({
      id: 'n1',
      type: 'note',
      parentId: null,
      title: 'Scratch',
      content: 'Remember the obsidian vault',
      sortOrder: 0
    })
    const candidates = listQuickOpenCandidates([note], categories)
    expect(candidates.some((c) => c.nodeId === 'n1')).toBe(true)
    expect(searchQuickOpen(candidates, 'obsidian')).toHaveLength(0)
    expect(searchQuickOpen(candidates, 'scratch').map((h) => h.nodeId)).toEqual(['n1'])
  })

  it('matches titles only — not body prose', () => {
    const chapter = simpleChapter(
      'ch1',
      'Keep',
      '<p>He found the obsidian key under the floor.</p>',
      0
    )
    const lore = node({
      id: 'lore1',
      type: 'lore',
      parentId: null,
      title: 'Obsidian',
      content: '<p>A rock.</p>',
      sortOrder: 0
    })
    const hits = searchQuickOpen(
      listQuickOpenCandidates([chapter, lore], categories),
      'obsidian'
    )
    expect(hits.map((h) => h.nodeId)).toEqual(['lore1'])
  })

  it('matches character aliases without treating them as body search', () => {
    const character = node({
      id: 'c1',
      type: 'character',
      parentId: null,
      title: 'Ankros',
      content: '<p>He carried obsidian.</p>',
      sortOrder: 0,
      metadata: JSON.stringify({ aliases: ['The Blade'] })
    })
    const hits = searchQuickOpen(
      listQuickOpenCandidates([character], categories),
      'blade'
    )
    expect(hits).toHaveLength(1)
    expect(hits[0]?.nodeId).toBe('c1')
    expect(hits[0]?.matchedAlias).toBe(true)
    expect(hits[0]?.matchedPhrase).toBe('The Blade')
  })

  it('skips deleted nodes', () => {
    const live = simpleChapter('ch1', 'Harbor', '', 0)
    const gone = simpleChapter('ch2', 'Harbor Lost', '', 1, { deletedAt: '2024-01-01' })
    const ids = listQuickOpenCandidates([live, gone], categories).map((c) => c.nodeId)
    expect(ids).toEqual(['ch1'])
  })

  it('keeps manuscript hits grouped above wiki when ranking', () => {
    const chapter = simpleChapter('ch1', 'Obsidian Shore', '', 0)
    const lore = node({
      id: 'lore1',
      type: 'lore',
      parentId: null,
      title: 'Obsidian',
      sortOrder: 0
    })
    const hits = searchQuickOpen(
      listQuickOpenCandidates([chapter, lore], categories),
      'obsidian'
    )
    expect(hits[0]?.group).toBe('manuscript')
    expect(hits[0]?.nodeId).toBe('ch1')
    expect(hits[1]?.group).toBe('wiki')
  })

  it('returns every candidate in order when the query is empty', () => {
    const a = simpleChapter('ch1', 'A', '', 0)
    const b = simpleChapter('ch2', 'B', '', 1)
    const hits = searchQuickOpen(listQuickOpenCandidates([a, b], categories), '')
    expect(hits.map((h) => h.nodeId)).toEqual(['ch1', 'ch2'])
  })
})
