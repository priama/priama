/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { defaultFictionCategories } from '@shared/categoryPresets'
import type { TreeNode } from '@shared/types'
import {
  clearProjectSearchCache,
  projectSearch
} from '@/lib/projectSearch'

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

afterEach(() => {
  clearProjectSearchCache()
})

describe('projectSearch', () => {
  it('finds mark-split prose matches', () => {
    const split = simpleChapter(
      'ch2',
      'Keep',
      '<p>ob<span class="x">sidian</span> tower</p>',
      1
    )
    const { hits } = projectSearch([split], categories, { query: 'obsidian' })
    expect(hits.some((h) => h.nodeId === 'ch2' && h.source === 'prose')).toBe(true)
  })

  it('skips scene-folder chapters as prose; includes scenes', () => {
    const folder = scenesChapter('ch-f', 'Folder Chapter', 0)
    folder.content = '<p>obsidian in folder body should not match</p>'
    const scene = node({
      id: 's1',
      type: 'scene',
      parentId: 'ch-f',
      title: 'Arrival',
      content: '<p>obsidian in scene</p>',
      sortOrder: 0
    })
    const { hits } = projectSearch([folder, scene], categories, { query: 'obsidian' })
    const proseHits = hits.filter((h) => h.source === 'prose')
    expect(proseHits.every((h) => h.nodeId === 's1')).toBe(true)
    expect(proseHits.length).toBeGreaterThan(0)
  })

  it('skips deleted nodes', () => {
    const live = simpleChapter('ch1', 'Live', '<p>obsidian</p>', 0)
    const gone = simpleChapter('ch2', 'Gone', '<p>obsidian</p>', 1, {
      deletedAt: '2024-01-01'
    })
    const { hits } = projectSearch([live, gone], categories, { query: 'obsidian' })
    expect(hits.every((h) => h.nodeId === 'ch1')).toBe(true)
  })

  it('returns empty for short or empty query', () => {
    const ch = simpleChapter('ch1', 'A', '<p>obsidian</p>', 0)
    expect(projectSearch([ch], categories, { query: '' }).hits).toEqual([])
    expect(projectSearch([ch], categories, { query: 'o' }).hits).toEqual([])
  })

  it('respects case sensitivity', () => {
    const ch = simpleChapter('ch1', 'A', '<p>Obsidian</p>', 0)
    const insensitive = projectSearch([ch], categories, {
      query: 'obsidian',
      caseSensitive: false
    })
    const sensitive = projectSearch([ch], categories, {
      query: 'obsidian',
      caseSensitive: true
    })
    expect(insensitive.hits.length).toBeGreaterThan(0)
    expect(sensitive.hits.filter((h) => h.source === 'prose')).toHaveLength(0)
  })

  it('caps at maxHits and sets truncated', () => {
    const nodes = Array.from({ length: 50 }, (_, i) =>
      simpleChapter(`ch${i}`, `Ch ${i}`, `<p>obsidian obsidian obsidian obsidian</p>`, i)
    )
    const { hits, truncated } = projectSearch(nodes, categories, {
      query: 'obsidian',
      maxHits: 10
    })
    expect(hits).toHaveLength(10)
    expect(truncated).toBe(true)
  })

  it('finds title when phrase is absent from prose', () => {
    const lore = node({
      id: 'lore1',
      type: 'lore',
      parentId: null,
      title: 'Obsidian Order',
      content: '<p>A secret society.</p>',
      sortOrder: 0
    })
    const { hits } = projectSearch([lore], categories, { query: 'Obsidian Order' })
    expect(hits.some((h) => h.source === 'title' && h.nodeId === 'lore1')).toBe(true)
  })

  it('finds character aliases', () => {
    const char = node({
      id: 'c1',
      type: 'character',
      parentId: null,
      title: 'Ankros',
      content: '<p>He walked.</p>',
      sortOrder: 0,
      metadata: JSON.stringify({ aliases: ['The Blade'] })
    })
    const { hits } = projectSearch([char], categories, { query: 'The Blade' })
    expect(hits.some((h) => h.source === 'alias' && h.nodeId === 'c1')).toBe(true)
  })

  it('finds synopsis hits', () => {
    const ch = simpleChapter('ch1', 'Docks', '<p>He walked.</p>', 0)
    ch.metadata = JSON.stringify({
      structure: 'simple',
      synopsis: 'Ankros finds the obsidian key.'
    })
    const { hits } = projectSearch([ch], categories, { query: 'obsidian key' })
    expect(hits.some((h) => h.source === 'synopsis' && h.nodeId === 'ch1')).toBe(true)
  })

  it('searches note bodies as plaintext without HTML parse', () => {
    const note = node({
      id: 'n1',
      type: 'note',
      parentId: null,
      title: 'Scratch',
      content: 'Remember the obsidian vault',
      sortOrder: 0
    })
    const { hits } = projectSearch([note], categories, { query: 'obsidian' })
    expect(hits.some((h) => h.nodeId === 'n1' && h.source === 'prose')).toBe(true)
  })

  it('does not match tag names in raw HTML', () => {
    const ch = simpleChapter(
      'ch1',
      'A',
      '<p><span class="entity-mention">Hero</span></p>',
      0
    )
    const { hits } = projectSearch([ch], categories, { query: 'entity-mention' })
    expect(hits.filter((h) => h.source === 'prose')).toHaveLength(0)
  })
})
