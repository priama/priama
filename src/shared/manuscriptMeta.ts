import type { ChapterMeta, SceneMeta, TreeNode } from './types'
import {
  DEFAULT_CHAPTER_META,
  DEFAULT_SCENE_META,
  normalizeChapterMeta,
  normalizeSceneMeta,
  parseMetadata,
  serializeMetadata
} from './types'

export type PlanningMeta = ChapterMeta | SceneMeta

function countHtmlWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

export function planningMetaFor(node: TreeNode): PlanningMeta {
  if (node.type === 'chapter') {
    return normalizeChapterMeta(parseMetadata(node.metadata, DEFAULT_CHAPTER_META))
  }
  if (node.type === 'scene') {
    return normalizeSceneMeta(parseMetadata(node.metadata, DEFAULT_SCENE_META))
  }
  return { ...DEFAULT_SCENE_META }
}

export function formatWordProgress(current: number, goal: number | null): string {
  const currentLabel = current.toLocaleString()
  if (goal == null || goal <= 0) return currentLabel
  return `${currentLabel} / ${goal.toLocaleString()}`
}

export function scenesChapterStats(
  chapter: TreeNode,
  nodes: TreeNode[]
): { sceneCount: number; wordCount: number } {
  const scenes = nodes.filter(
    (n) => !n.deletedAt && n.parentId === chapter.id && n.type === 'scene'
  )
  const wordCount = scenes.reduce((sum, s) => sum + countHtmlWords(s.content), 0)
  return { sceneCount: scenes.length, wordCount }
}

/** Merge `structure` into existing chapter metadata without wiping planning fields. */
export function chapterMetaWithStructure(
  existingMetadata: string,
  structure: ChapterMeta['structure']
): string {
  const current = normalizeChapterMeta(parseMetadata(existingMetadata, DEFAULT_CHAPTER_META))
  return serializeMetadata({ ...current, structure })
}

/** Build simple-chapter metadata for a new node, optionally copying planning from a scene. */
export function simpleChapterMetaFrom(source?: TreeNode): string {
  if (source?.type === 'scene') {
    const scene = normalizeSceneMeta(parseMetadata(source.metadata, DEFAULT_SCENE_META))
    return serializeMetadata({
      ...DEFAULT_CHAPTER_META,
      ...scene,
      structure: 'simple' as const
    })
  }
  return serializeMetadata({ ...DEFAULT_CHAPTER_META, structure: 'simple' })
}
