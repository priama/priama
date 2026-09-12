import type { CategoryDefinition, TreeNode } from '@shared/types'
import { folderScopeForCategory } from '@shared/categoryPresets'
import { listManuscriptChapters } from '@shared/export/manuscript'
import { phrasesForNode } from '@/lib/entryTitleIndex'
import {
  getCategoryScopedChildren,
  getChildren,
  getScenes,
  isChapterFolder,
  isFolder
} from '@/lib/treeUtils'

export type QuickOpenGroup = 'manuscript' | 'wiki'

export interface FuzzyMatch {
  score: number
  /** Indices into the matched string. */
  positions: number[]
}

export interface QuickOpenCandidate {
  nodeId: string
  title: string
  breadcrumb: string
  group: QuickOpenGroup
  /** Title plus character aliases — never body text. */
  phrases: string[]
  sortIndex: number
}

export interface QuickOpenHit {
  nodeId: string
  title: string
  breadcrumb: string
  group: QuickOpenGroup
  score: number
  /** Highlight indices into `title` when the title itself matched. */
  positions: number[]
  matchedPhrase: string
  matchedAlias: boolean
  /** Highlight indices into `matchedPhrase` when an alias matched. */
  aliasPositions: number[]
}

function displayTitle(node: TreeNode): string {
  return node.title.trim() || 'Untitled'
}

function phrasesForCandidate(node: TreeNode, title: string): string[] {
  const phrases = phrasesForNode(node)
  return phrases.length > 0 ? phrases : [title]
}

function isWordBoundary(text: string, index: number): boolean {
  if (index <= 0) return true
  return /[\s\-_/:.,()[\]'"]/.test(text.charAt(index - 1))
}

/**
 * Case-insensitive fuzzy match: substring first, then subsequence.
 * Higher scores rank earlier. Null means no match.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.trim()
  if (!q) return { score: 0, positions: [] }
  if (!text) return null

  const qLower = q.toLowerCase()
  const tLower = text.toLowerCase()

  const idx = tLower.indexOf(qLower)
  if (idx >= 0) {
    const positions = Array.from({ length: q.length }, (_, i) => idx + i)
    let score = 1200 - idx * 4
    if (idx === 0) score += 250
    else if (isWordBoundary(text, idx)) score += 120
    score -= Math.max(0, text.length - q.length) * 0.15
    return { score, positions }
  }

  const positions: number[] = []
  let qi = 0
  for (let ti = 0; ti < tLower.length && qi < qLower.length; ti++) {
    if (tLower.charAt(ti) === qLower.charAt(qi)) {
      positions.push(ti)
      qi++
    }
  }
  if (qi < qLower.length) return null

  let consecBonus = 0
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === positions[i - 1] + 1) consecBonus += 18
  }
  const start = positions[0] ?? 0
  const score =
    450 + consecBonus - start * 3 - Math.max(0, text.length - q.length) * 0.15
  return { score, positions }
}

function collectManuscript(
  nodes: TreeNode[],
  parentId: string | null,
  pathParts: string[],
  chapterNumber: Map<string, number>,
  out: QuickOpenCandidate[]
): void {
  for (const child of getChildren(nodes, parentId, 'manuscript')) {
    const title = displayTitle(child)

    if (isFolder(child)) {
      out.push({
        nodeId: child.id,
        title,
        breadcrumb: pathParts.length > 0 ? pathParts.join(' / ') : 'Manuscript',
        group: 'manuscript',
        phrases: phrasesForCandidate(child, title),
        sortIndex: out.length
      })
      collectManuscript(nodes, child.id, [...pathParts, title], chapterNumber, out)
      continue
    }

    if (child.type !== 'chapter') continue

    const n = chapterNumber.get(child.id)
    const folderPath = pathParts.join(' / ')
    const chLabel = n != null ? `Ch. ${n}` : ''
    const chapterBreadcrumb = [folderPath, chLabel].filter(Boolean).join(' · ') || 'Manuscript'

    out.push({
      nodeId: child.id,
      title,
      breadcrumb: chapterBreadcrumb,
      group: 'manuscript',
      phrases: phrasesForCandidate(child, title),
      sortIndex: out.length
    })

    if (!isChapterFolder(child)) continue

    for (const scene of getScenes(nodes, child.id)) {
      const sceneTitle = displayTitle(scene)
      const sceneBits = [folderPath, chLabel, title].filter(Boolean)
      out.push({
        nodeId: scene.id,
        title: sceneTitle,
        breadcrumb: sceneBits.join(' · ') || 'Manuscript',
        group: 'manuscript',
        phrases: phrasesForCandidate(scene, sceneTitle),
        sortIndex: out.length
      })
    }
  }
}

function collectWikiCategory(
  nodes: TreeNode[],
  category: CategoryDefinition,
  parentId: string | null,
  pathParts: string[],
  seen: Set<string>,
  out: QuickOpenCandidate[]
): void {
  const scope = folderScopeForCategory(category)
  const children =
    scope === 'entry'
      ? getCategoryScopedChildren(nodes, parentId, category.id)
      : getChildren(nodes, parentId, scope)

  for (const child of children) {
    if (seen.has(child.id)) continue
    seen.add(child.id)

    const title = displayTitle(child)
    const trail = pathParts.length > 0 ? `${category.name} / ${pathParts.join(' / ')}` : category.name

    out.push({
      nodeId: child.id,
      title,
      breadcrumb: trail,
      group: 'wiki',
      phrases: phrasesForCandidate(child, title),
      sortIndex: out.length
    })

    if (isFolder(child)) {
      collectWikiCategory(nodes, category, child.id, [...pathParts, title], seen, out)
    }
  }
}

/** Title-bearing nodes in sidebar/export order. Manuscript first, then wiki. */
export function listQuickOpenCandidates(
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): QuickOpenCandidate[] {
  const out: QuickOpenCandidate[] = []
  const chapterNumber = new Map(
    listManuscriptChapters(nodes).map((ref, i) => [ref.id, i + 1])
  )
  collectManuscript(nodes, null, [], chapterNumber, out)

  const seen = new Set(out.map((c) => c.nodeId))
  const cats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const cat of cats) {
    collectWikiCategory(nodes, cat, null, [], seen, out)
  }

  return out
}

function compareHits(a: QuickOpenHit, b: QuickOpenHit, index: Map<string, number>): number {
  if (b.score !== a.score) return b.score - a.score
  return (index.get(a.nodeId) ?? 0) - (index.get(b.nodeId) ?? 0)
}

/**
 * Filter and rank candidates by title/alias only. Hits stay grouped:
 * all manuscript matches, then all wiki matches.
 */
export function searchQuickOpen(
  candidates: QuickOpenCandidate[],
  query: string
): QuickOpenHit[] {
  const q = query.trim()
  const index = new Map(candidates.map((c) => [c.nodeId, c.sortIndex]))
  const hits: QuickOpenHit[] = []

  for (const candidate of candidates) {
    if (!q) {
      hits.push({
        nodeId: candidate.nodeId,
        title: candidate.title,
        breadcrumb: candidate.breadcrumb,
        group: candidate.group,
        score: 0,
        positions: [],
        matchedPhrase: candidate.title,
        matchedAlias: false,
        aliasPositions: []
      })
      continue
    }

    let best: {
      score: number
      positions: number[]
      phrase: string
      isAlias: boolean
    } | null = null

    for (const phrase of candidate.phrases) {
      const match = fuzzyMatch(q, phrase)
      if (!match) continue
      const isAlias = phrase !== candidate.title
      const score = isAlias ? match.score - 8 : match.score
      if (!best || score > best.score) {
        best = { score, positions: match.positions, phrase, isAlias }
      }
    }

    if (!best) continue

    hits.push({
      nodeId: candidate.nodeId,
      title: candidate.title,
      breadcrumb: candidate.breadcrumb,
      group: candidate.group,
      score: best.score,
      positions: best.isAlias ? [] : best.positions,
      matchedPhrase: best.phrase,
      matchedAlias: best.isAlias,
      aliasPositions: best.isAlias ? best.positions : []
    })
  }

  const manuscript = hits
    .filter((h) => h.group === 'manuscript')
    .sort((a, b) => compareHits(a, b, index))
  const wiki = hits.filter((h) => h.group === 'wiki').sort((a, b) => compareHits(a, b, index))
  return [...manuscript, ...wiki]
}
