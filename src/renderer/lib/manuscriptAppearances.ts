import { listManuscriptChapters } from '@shared/export/manuscript'
import type { CategoryDefinition, TreeNode } from '@shared/types'
import {
  buildEntryTitleIndex,
  findEntityMatches,
  type EntryTitleIndex
} from '@/lib/entryTitleIndex'
import { stripHtmlToText } from '@/lib/splitMerge'
import { getScenes, isChapterFolder, isSimpleChapter } from '@/lib/treeUtils'

export interface AppearanceHit {
  nodeId: string
  count: number
}

export interface AppearanceRow {
  nodeId: string
  label: string
  count: number
  countLabel: string
}

/** Writing-surface manuscript nodes in reading order (simple chapters + scenes). */
export function listManuscriptProseNodes(nodes: TreeNode[]): TreeNode[] {
  const chapters = listManuscriptChapters(nodes)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const prose: TreeNode[] = []

  for (const ref of chapters) {
    const chapter = byId.get(ref.id)
    if (!chapter || chapter.deletedAt) continue

    if (isSimpleChapter(chapter)) {
      prose.push(chapter)
      continue
    }

    if (isChapterFolder(chapter)) {
      for (const scene of getScenes(nodes, chapter.id)) {
        prose.push(scene)
      }
    }
  }

  return prose
}

export function countLabel(count: number): string {
  return count === 1 ? '1 time' : `${count} times`
}

export function appearanceLabel(
  nodeId: string,
  nodes: TreeNode[]
): string | null {
  const byId = new Map(nodes.filter((n) => !n.deletedAt).map((n) => [n.id, n]))
  const node = byId.get(nodeId)
  if (!node) return null

  const chapters = listManuscriptChapters(nodes)
  const chapterIndex = (chapterId: string): number =>
    chapters.findIndex((c) => c.id === chapterId)

  if (node.type === 'chapter' && isSimpleChapter(node)) {
    const n = chapterIndex(node.id)
    if (n < 0) return null
    const title = node.title.trim()
    return title ? `Ch. ${n + 1} · ${title}` : `Ch. ${n + 1}`
  }

  if (node.type === 'scene' && node.parentId) {
    const chapter = byId.get(node.parentId)
    if (!chapter || !isChapterFolder(chapter)) return null
    const n = chapterIndex(chapter.id)
    if (n < 0) return null
    const scenes = getScenes(nodes, chapter.id)
    const sceneIndex = scenes.findIndex((s) => s.id === node.id)
    if (sceneIndex < 0) return null
    return `Ch. ${n + 1}, scene ${sceneIndex + 1}`
  }

  return null
}

/**
 * Full reverse index: entityId → hits in manuscript reading order.
 * Uses the same trie matcher as entity underlines.
 */
export function buildManuscriptAppearances(
  nodes: TreeNode[],
  categories: CategoryDefinition[],
  index?: EntryTitleIndex
): Map<string, AppearanceHit[]> {
  const entryIndex = index ?? buildEntryTitleIndex(nodes, categories)
  const byEntity = new Map<string, AppearanceHit[]>()

  for (const proseNode of listManuscriptProseNodes(nodes)) {
    const text = stripHtmlToText(proseNode.content)
    if (!text) continue

    const counts = new Map<string, number>()
    for (const match of findEntityMatches(entryIndex, text)) {
      counts.set(match.entry.id, (counts.get(match.entry.id) ?? 0) + 1)
    }

    for (const [entityId, count] of counts) {
      const list = byEntity.get(entityId)
      const hit: AppearanceHit = { nodeId: proseNode.id, count }
      if (list) list.push(hit)
      else byEntity.set(entityId, [hit])
    }
  }

  return byEntity
}

export function appearancesForEntity(
  entityId: string,
  nodes: TreeNode[],
  categories: CategoryDefinition[],
  index?: EntryTitleIndex
): AppearanceRow[] {
  const map = buildManuscriptAppearances(nodes, categories, index)
  const hits = map.get(entityId) ?? []
  const rows: AppearanceRow[] = []

  for (const hit of hits) {
    const label = appearanceLabel(hit.nodeId, nodes)
    if (!label) continue
    rows.push({
      nodeId: hit.nodeId,
      label,
      count: hit.count,
      countLabel: countLabel(hit.count)
    })
  }

  return rows
}
