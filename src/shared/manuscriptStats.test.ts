import { describe, expect, it } from 'vitest'
import { manuscriptWordTotal } from './manuscriptStats'
import {
  DEFAULT_CHAPTER_META,
  DEFAULT_FOLDER_META,
  serializeMetadata,
  type TreeNode
} from './types'

function makeNode(partial: Partial<TreeNode> & Pick<TreeNode, 'id' | 'type'>): TreeNode {
  return {
    parentId: null,
    title: 'Test',
    sortOrder: 0,
    content: '',
    metadata: '{}',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    ...partial
  }
}

describe('manuscriptWordTotal', () => {
  it('sums simple chapters and scenes-chapter scenes', () => {
    const simple = makeNode({
      id: 'ch-simple',
      type: 'chapter',
      title: 'Prologue',
      sortOrder: 0,
      content: '<p>one two three</p>',
      metadata: serializeMetadata({ ...DEFAULT_CHAPTER_META, structure: 'simple' })
    })
    const scenesChapter = makeNode({
      id: 'ch-scenes',
      type: 'chapter',
      title: 'Chapter 1',
      sortOrder: 1,
      content: '<p>leftover should be ignored</p>',
      metadata: serializeMetadata({ ...DEFAULT_CHAPTER_META, structure: 'scenes' })
    })
    const s1 = makeNode({
      id: 's1',
      type: 'scene',
      parentId: 'ch-scenes',
      sortOrder: 0,
      content: '<p>four five</p>'
    })
    const s2 = makeNode({
      id: 's2',
      type: 'scene',
      parentId: 'ch-scenes',
      sortOrder: 1,
      content: '<p>six</p>'
    })

    expect(manuscriptWordTotal([simple, scenesChapter, s1, s2])).toBe(6)
  })

  it('walks nested manuscript folders and ignores wiki', () => {
    const folder = makeNode({
      id: 'folder-a',
      type: 'folder',
      title: 'Part I',
      sortOrder: 0,
      metadata: serializeMetadata({ ...DEFAULT_FOLDER_META, scope: 'manuscript' })
    })
    const chapter = makeNode({
      id: 'ch1',
      type: 'chapter',
      parentId: 'folder-a',
      title: 'Ch 1',
      sortOrder: 0,
      content: '<p>hello world</p>',
      metadata: serializeMetadata({ ...DEFAULT_CHAPTER_META, structure: 'simple' })
    })
    const character = makeNode({
      id: 'char1',
      type: 'character',
      title: 'Kael',
      content: '<p>lots of wiki words here</p>'
    })
    const note = makeNode({
      id: 'note1',
      type: 'note',
      title: 'Note',
      content: 'plain note words'
    })

    expect(manuscriptWordTotal([folder, chapter, character, note])).toBe(2)
  })

  it('ignores deleted scenes and deleted chapters', () => {
    const chapter = makeNode({
      id: 'ch1',
      type: 'chapter',
      metadata: serializeMetadata({ ...DEFAULT_CHAPTER_META, structure: 'scenes' })
    })
    const live = makeNode({
      id: 's1',
      type: 'scene',
      parentId: 'ch1',
      content: '<p>one two</p>'
    })
    const deletedScene = makeNode({
      id: 's2',
      type: 'scene',
      parentId: 'ch1',
      content: '<p>gone gone gone</p>',
      deletedAt: '2026-01-01'
    })
    const deletedChapter = makeNode({
      id: 'ch2',
      type: 'chapter',
      sortOrder: 1,
      content: '<p>deleted chapter body</p>',
      metadata: serializeMetadata({ ...DEFAULT_CHAPTER_META, structure: 'simple' }),
      deletedAt: '2026-01-01'
    })

    expect(manuscriptWordTotal([chapter, live, deletedScene, deletedChapter])).toBe(2)
  })

  it('returns 0 for empty manuscript', () => {
    expect(manuscriptWordTotal([])).toBe(0)
  })
})
