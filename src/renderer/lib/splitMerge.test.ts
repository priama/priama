import { describe, expect, it } from 'vitest'
import {
  canMergeWithNext,
  canSplitNode,
  joinHtmlDocuments,
  nextSiblingOfKind,
  reorderAfterKeeper,
  titleFromHtml,
  isEmptyHtml
} from '@/lib/splitMerge'
import type { TreeNode } from '@shared/types'

function node(partial: Partial<TreeNode> & Pick<TreeNode, 'id' | 'type' | 'title'>): TreeNode {
  return {
    parentId: null,
    content: '',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    categoryId: null,
    metadata: '',
    ...partial
  }
}

const scenesChapter = node({
  id: 'ch-scenes',
  type: 'chapter',
  title: 'Ch',
  metadata: JSON.stringify({ structure: 'scenes' })
})

const simpleA = node({
  id: 'ch-a',
  type: 'chapter',
  title: 'A',
  sortOrder: 0,
  metadata: JSON.stringify({ structure: 'simple' }),
  content: '<p>one</p>'
})

const simpleB = node({
  id: 'ch-b',
  type: 'chapter',
  title: 'B',
  sortOrder: 1,
  metadata: JSON.stringify({ structure: 'simple' }),
  content: '<p>two</p>'
})

const scene1 = node({
  id: 's1',
  type: 'scene',
  title: 'S1',
  parentId: 'ch-scenes',
  sortOrder: 0,
  content: '<p>alpha</p>'
})

const scene2 = node({
  id: 's2',
  type: 'scene',
  title: 'S2',
  parentId: 'ch-scenes',
  sortOrder: 1,
  content: '<p>beta</p>'
})

describe('titleFromHtml', () => {
  it('uses first text and truncates', () => {
    expect(titleFromHtml('<p>Hello world</p>')).toBe('Hello world')
    expect(titleFromHtml('<p>' + 'x'.repeat(80) + '</p>')).toMatch(/…$/)
  })

  it('returns Untitled for empty html', () => {
    expect(titleFromHtml('<p></p>')).toBe('Untitled')
    expect(titleFromHtml('')).toBe('Untitled')
  })
})

describe('joinHtmlDocuments', () => {
  it('inserts marker paragraph', () => {
    expect(joinHtmlDocuments('<p>a</p>', '<p>b</p>', '* * *')).toBe(
      '<p>a</p><p>* * *</p><p>b</p>'
    )
  })

  it('uses blank paragraph when marker empty', () => {
    expect(joinHtmlDocuments('<p>a</p>', '<p>b</p>', '')).toBe('<p>a</p><p></p><p>b</p>')
  })

  it('escapes marker html', () => {
    expect(joinHtmlDocuments('<p>a</p>', '<p>b</p>', '<script>')).toBe(
      '<p>a</p><p>&lt;script&gt;</p><p>b</p>'
    )
  })
})

describe('canSplitNode', () => {
  const nodes = [scenesChapter, scene1, simpleA]

  it('allows scene under scenes-chapter and simple chapter', () => {
    expect(canSplitNode(scene1, nodes)).toBe(true)
    expect(canSplitNode(simpleA, nodes)).toBe(true)
  })

  it('rejects scenes-chapter container, entries, orphan scenes', () => {
    expect(canSplitNode(scenesChapter, nodes)).toBe(false)
    expect(
      canSplitNode(node({ id: 'e1', type: 'entry', title: 'E', categoryId: 'c' }), nodes)
    ).toBe(false)
    expect(canSplitNode(node({ id: 'orphan', type: 'scene', title: 'O' }), nodes)).toBe(false)
  })
})

describe('canMergeWithNext / nextSiblingOfKind', () => {
  const nodes = [scenesChapter, scene1, scene2, simpleA, simpleB]

  it('merges adjacent scenes', () => {
    expect(nextSiblingOfKind(scene1, nodes)?.id).toBe('s2')
    expect(canMergeWithNext(scene1, nodes)).toBe(true)
    expect(canMergeWithNext(scene2, nodes)).toBe(false)
  })

  it('merges adjacent simple chapters', () => {
    expect(nextSiblingOfKind(simpleA, nodes)?.id).toBe('ch-b')
    expect(canMergeWithNext(simpleA, nodes)).toBe(true)
    expect(canMergeWithNext(simpleB, nodes)).toBe(false)
  })

  it('rejects merge across kinds', () => {
    const mixed = [
      scenesChapter,
      scene1,
      node({
        id: 'ch-simple-root',
        type: 'chapter',
        title: 'S',
        sortOrder: 1,
        metadata: JSON.stringify({ structure: 'simple' })
      })
    ]
    expect(canMergeWithNext(scene1, mixed)).toBe(false)
  })
})

describe('reorderAfterKeeper', () => {
  it('inserts new id immediately after keeper', () => {
    const siblings = [
      node({ id: 'a', type: 'scene', title: 'A', sortOrder: 0, parentId: 'p' }),
      node({ id: 'b', type: 'scene', title: 'B', sortOrder: 1, parentId: 'p' }),
      node({ id: 'new', type: 'scene', title: 'N', sortOrder: 2, parentId: 'p' })
    ]
    const items = reorderAfterKeeper(siblings, 'a', 'new')
    expect(items.map((i) => i.id)).toEqual(['a', 'new', 'b'])
    expect(items.map((i) => i.sortOrder)).toEqual([0, 1, 2])
  })
})

describe('isEmptyHtml', () => {
  it('treats empty paragraphs as empty', () => {
    expect(isEmptyHtml('<p></p>')).toBe(true)
    expect(isEmptyHtml('<p>x</p>')).toBe(false)
  })
})
