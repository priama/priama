import { describe, expect, it } from 'vitest'
import {
  chapterMetaWithStructure,
  formatWordProgress,
  planningMetaFor,
  scenesChapterStats,
  simpleChapterMetaFrom
} from './manuscriptMeta'
import {
  DEFAULT_CHAPTER_META,
  DEFAULT_SCENE_META,
  normalizeChapterMeta,
  normalizeSceneMeta,
  parseMetadata,
  serializeMetadata,
  type ChapterMeta,
  type SceneMeta,
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

describe('normalizeChapterMeta', () => {
  it('fills defaults for structure-only legacy meta', () => {
    expect(normalizeChapterMeta({ structure: 'simple' })).toEqual({
      ...DEFAULT_CHAPTER_META,
      structure: 'simple'
    })
  })

  it('keeps planning fields and coerces invalid values', () => {
    const result = normalizeChapterMeta({
      structure: 'scenes',
      synopsis: 'Kael flees',
      status: 'draft',
      color: '#7C3AED',
      wordGoal: 2000.7
    })
    expect(result).toEqual({
      structure: 'scenes',
      synopsis: 'Kael flees',
      status: 'draft',
      color: '#7C3AED',
      wordGoal: 2001
    })
  })

  it('rejects invalid status, color, and wordGoal', () => {
    const result = normalizeChapterMeta({
      structure: 'bogus' as ChapterMeta['structure'],
      status: 'shipped' as ChapterMeta['status'],
      color: '#ffffff',
      wordGoal: -5,
      synopsis: 12 as unknown as string
    })
    expect(result.structure).toBe('scenes')
    expect(result.status).toBe('')
    expect(result.color).toBeNull()
    expect(result.wordGoal).toBeNull()
    expect(result.synopsis).toBe('')
  })
})

describe('normalizeSceneMeta', () => {
  it('returns empty planning defaults', () => {
    expect(normalizeSceneMeta({})).toEqual(DEFAULT_SCENE_META)
  })

  it('accepts valid planning fields', () => {
    expect(
      normalizeSceneMeta({
        synopsis: 'Beat',
        status: 'revise',
        color: null,
        wordGoal: 500
      })
    ).toEqual({
      synopsis: 'Beat',
      status: 'revise',
      color: null,
      wordGoal: 500
    })
  })
})

describe('formatWordProgress', () => {
  it('shows current only when goal is missing', () => {
    expect(formatWordProgress(1200, null)).toBe('1,200')
    expect(formatWordProgress(1200, 0)).toBe('1,200')
  })

  it('shows current / goal when goal is set', () => {
    expect(formatWordProgress(1200, 2000)).toBe('1,200 / 2,000')
  })
})

describe('scenesChapterStats', () => {
  it('sums non-deleted scene words', () => {
    const chapter = makeNode({ id: 'ch1', type: 'chapter' })
    const nodes: TreeNode[] = [
      chapter,
      makeNode({
        id: 's1',
        type: 'scene',
        parentId: 'ch1',
        content: '<p>one two three</p>'
      }),
      makeNode({
        id: 's2',
        type: 'scene',
        parentId: 'ch1',
        content: '<p>four five</p>'
      }),
      makeNode({
        id: 's3',
        type: 'scene',
        parentId: 'ch1',
        content: '<p>ignored</p>',
        deletedAt: '2026-01-01'
      })
    ]
    expect(scenesChapterStats(chapter, nodes)).toEqual({ sceneCount: 2, wordCount: 5 })
  })
})

describe('chapterMetaWithStructure', () => {
  it('merges structure without wiping planning fields', () => {
    const existing = serializeMetadata({
      ...DEFAULT_CHAPTER_META,
      structure: 'scenes' as const,
      synopsis: 'Keep me',
      status: 'draft' as const,
      color: '#2563EB',
      wordGoal: 3000
    })
    const next = chapterMetaWithStructure(existing, 'simple')
    const parsed = parseMetadata<ChapterMeta>(next, DEFAULT_CHAPTER_META)
    expect(parsed).toEqual({
      structure: 'simple',
      synopsis: 'Keep me',
      status: 'draft',
      color: '#2563EB',
      wordGoal: 3000
    })
  })
})

describe('simpleChapterMetaFrom', () => {
  it('copies scene planning into a new simple chapter', () => {
    const scene = makeNode({
      id: 's1',
      type: 'scene',
      metadata: serializeMetadata({
        synopsis: 'From scene',
        status: 'outline',
        color: '#059669',
        wordGoal: 800
      } satisfies SceneMeta)
    })
    const meta = parseMetadata<ChapterMeta>(simpleChapterMetaFrom(scene), DEFAULT_CHAPTER_META)
    expect(meta).toEqual({
      structure: 'simple',
      synopsis: 'From scene',
      status: 'outline',
      color: '#059669',
      wordGoal: 800
    })
  })

  it('returns empty simple chapter meta without a source', () => {
    expect(parseMetadata(simpleChapterMetaFrom(), DEFAULT_CHAPTER_META)).toEqual({
      ...DEFAULT_CHAPTER_META,
      structure: 'simple'
    })
  })
})

describe('planningMetaFor', () => {
  it('normalizes chapter and scene nodes', () => {
    const chapter = makeNode({
      id: 'c1',
      type: 'chapter',
      metadata: JSON.stringify({ structure: 'simple', synopsis: 'Hi' })
    })
    expect(planningMetaFor(chapter).synopsis).toBe('Hi')
    expect(planningMetaFor(chapter)).toMatchObject({ structure: 'simple' })

    const scene = makeNode({
      id: 's1',
      type: 'scene',
      metadata: JSON.stringify({ status: 'done' })
    })
    expect(planningMetaFor(scene).status).toBe('done')
  })
})
