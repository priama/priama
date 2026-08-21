import type { CategoryDefinition, TreeNode } from '@shared/types'
import { planningMetaFor } from '@shared/manuscriptMeta'
import { appearanceLabel, listManuscriptProseNodes } from '@/lib/manuscriptAppearances'
import { phrasesForNode } from '@/lib/entryTitleIndex'
import { htmlToSearchText } from '@/lib/htmlToSearchText'
import {
  isChapterFolder,
  isWikiEntityType
} from '@/lib/treeUtils'
import { isWritingSurfaceNode } from '@/lib/writingSurface'

export type ProjectSearchSource = 'prose' | 'title' | 'synopsis' | 'alias'

export interface ProjectSearchHit {
  /** Stable list key only (nodeId + source + occurrence). Not used for in-doc jump. */
  id: string
  nodeId: string
  source: ProjectSearchSource
  title: string
  breadcrumb: string
  snippet: { before: string; match: string; after: string }
}

export interface ProjectSearchOptions {
  query: string
  caseSensitive?: boolean
  maxHits?: number
  /** Min query length; default 2. */
  minQueryLength?: number
}

export interface ProjectSearchResult {
  hits: ProjectSearchHit[]
  truncated: boolean
}

const DEFAULT_MAX_HITS = 200
const SNIPPET_RADIUS = 40

type ExtractCache = Map<string, { content: string; text: string }>

/** Module-level extract cache keyed by nodeId + content identity. */
const extractCache: ExtractCache = new Map()

/** Test helper — clear extract cache between tests. */
export function clearProjectSearchCache(): void {
  extractCache.clear()
}

/** Test helper — current cache size. */
export function projectSearchCacheSize(): number {
  return extractCache.size
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getSearchRegex(query: string, caseSensitive: boolean): RegExp {
  return new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi')
}

/**
 * Cached HTML → search text. Reuses extract when `content` string identity matches.
 */
export function cachedHtmlToSearchText(nodeId: string, content: string): string {
  const cached = extractCache.get(nodeId)
  if (cached && cached.content === content) return cached.text
  const text = htmlToSearchText(content)
  extractCache.set(nodeId, { content, text })
  return text
}

function snippetAround(
  text: string,
  matchStart: number,
  matchLength: number
): { before: string; match: string; after: string } {
  const match = text.slice(matchStart, matchStart + matchLength)
  let beforeStart = Math.max(0, matchStart - SNIPPET_RADIUS)
  let afterEnd = Math.min(text.length, matchStart + matchLength + SNIPPET_RADIUS)

  // Prefer breaking at whitespace when we truncated.
  if (beforeStart > 0) {
    const space = text.indexOf(' ', beforeStart)
    if (space !== -1 && space < matchStart) beforeStart = space + 1
  }
  if (afterEnd < text.length) {
    const space = text.lastIndexOf(' ', afterEnd)
    if (space > matchStart + matchLength) afterEnd = space
  }

  const before =
    (beforeStart > 0 ? '…' : '') + text.slice(beforeStart, matchStart)
  const after =
    text.slice(matchStart + matchLength, afterEnd) + (afterEnd < text.length ? '…' : '')

  return { before, match, after }
}

function collectMatches(
  text: string,
  regex: RegExp,
  maxRemaining: number
): { starts: number[]; matchLen: number; truncated: boolean } {
  const starts: number[] = []
  let truncated = false
  let matchLen = 0
  let m: RegExpExecArray | null
  // Reset lastIndex for safety
  regex.lastIndex = 0
  while ((m = regex.exec(text)) !== null) {
    if (!m[0]) {
      regex.lastIndex += 1
      continue
    }
    matchLen = m[0].length
    if (starts.length >= maxRemaining) {
      truncated = true
      break
    }
    starts.push(m.index)
    if (m[0].length === 0) regex.lastIndex += 1
  }
  return { starts, matchLen, truncated }
}

function breadcrumbFor(node: TreeNode, nodes: TreeNode[]): string {
  const label = appearanceLabel(node.id, nodes)
  if (label) return label
  if (node.type === 'chapter' && isChapterFolder(node)) {
    return node.title.trim() || 'Chapter'
  }
  if (isWikiEntityType(node.type)) {
    const labels: Record<string, string> = {
      character: 'Character',
      location: 'Location',
      lore: 'Lore',
      note: 'Note'
    }
    return labels[node.type] ?? node.type
  }
  if (node.type === 'entry') return 'Entry'
  return node.title.trim() || 'Untitled'
}

function pushHits(
  hits: ProjectSearchHit[],
  params: {
    node: TreeNode
    nodes: TreeNode[]
    source: ProjectSearchSource
    text: string
    regex: RegExp
    maxHits: number
  }
): boolean {
  const remaining = params.maxHits - hits.length
  if (remaining <= 0) return true

  const { starts, matchLen, truncated } = collectMatches(
    params.text,
    params.regex,
    remaining
  )
  const title = params.node.title.trim() || 'Untitled'
  const breadcrumb = breadcrumbFor(params.node, params.nodes)

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]
    hits.push({
      id: `${params.node.id}:${params.source}:${i}`,
      nodeId: params.node.id,
      source: params.source,
      title,
      breadcrumb,
      snippet: snippetAround(params.text, start, matchLen)
    })
  }

  return truncated || hits.length >= params.maxHits
}

/**
 * Linear project search over manuscript prose, titles, aliases, synopsis, and notes.
 * Caller should pass `mergeIncomingNodes(nodes)` for live unsaved text.
 */
export function projectSearch(
  nodes: TreeNode[],
  categories: CategoryDefinition[],
  options: ProjectSearchOptions
): ProjectSearchResult {
  const query = options.query.trim()
  const minLen = options.minQueryLength ?? 2
  const maxHits = options.maxHits ?? DEFAULT_MAX_HITS
  const caseSensitive = options.caseSensitive ?? false

  if (query.length < minLen) {
    return { hits: [], truncated: false }
  }

  const regex = getSearchRegex(query, caseSensitive)
  const hits: ProjectSearchHit[] = []
  const active = nodes.filter((n) => !n.deletedAt)

  // --- Prose: manuscript reading order + other writing-surface docs ---
  const manuscriptProse = listManuscriptProseNodes(active)
  const proseSeen = new Set(manuscriptProse.map((n) => n.id))
  const uniqueProse: TreeNode[] = [...manuscriptProse]
  for (const n of active) {
    if (proseSeen.has(n.id)) continue
    if (!isWritingSurfaceNode(n, categories)) continue
    proseSeen.add(n.id)
    uniqueProse.push(n)
  }

  for (const node of uniqueProse) {
    // Skip scene-folder chapters as prose (should already be excluded)
    if (node.type === 'chapter' && isChapterFolder(node)) continue

    const text =
      node.type === 'note'
        ? node.content.replace(/\s+/g, ' ').trim()
        : cachedHtmlToSearchText(node.id, node.content)

    if (text && pushHits(hits, { node, nodes: active, source: 'prose', text, regex, maxHits })) {
      return { hits, truncated: true }
    }
  }

  // --- Titles, aliases, synopsis for relevant nodes ---
  for (const node of active) {
    if (node.type === 'folder') continue

    const includeTitle =
      node.type === 'scene' ||
      node.type === 'chapter' ||
      isWikiEntityType(node.type) ||
      node.type === 'entry' ||
      isWritingSurfaceNode(node, categories)

    if (!includeTitle) continue

    // Title
    const title = node.title.trim()
    if (title) {
      if (
        pushHits(hits, {
          node,
          nodes: active,
          source: 'title',
          text: title,
          regex,
          maxHits
        })
      ) {
        return { hits, truncated: true }
      }
    }

    // Aliases (character) — phrasesForNode includes title; only emit alias hits
    if (node.type === 'character') {
      const phrases = phrasesForNode(node)
      for (const phrase of phrases) {
        if (phrase === title) continue
        if (
          pushHits(hits, {
            node,
            nodes: active,
            source: 'alias',
            text: phrase,
            regex,
            maxHits
          })
        ) {
          return { hits, truncated: true }
        }
      }
    }

    // Synopsis (chapters + scenes)
    if (node.type === 'chapter' || node.type === 'scene') {
      const synopsis = planningMetaFor(node).synopsis.trim()
      if (synopsis) {
        if (
          pushHits(hits, {
            node,
            nodes: active,
            source: 'synopsis',
            text: synopsis,
            regex,
            maxHits
          })
        ) {
          return { hits, truncated: true }
        }
      }
    }

    // Note body (plaintext) — if not already covered as writing surface
    if (node.type === 'note' && !proseSeen.has(node.id)) {
      const body = node.content.replace(/\s+/g, ' ').trim()
      if (body) {
        if (
          pushHits(hits, {
            node,
            nodes: active,
            source: 'prose',
            text: body,
            regex,
            maxHits
          })
        ) {
          return { hits, truncated: true }
        }
      }
    }
  }

  // Detect if more matches would exist beyond cap: scan one more with limit 1
  // We already stop at maxHits inside pushHits; truncated is true when we hit cap mid-scan.
  // If we filled exactly maxHits, check whether more remain by seeing if we stopped early.
  // pushHits returns true when truncated OR full — if hits.length === maxHits we may have more.
  // For accuracy: if we filled maxHits, mark truncated (caller shows "200+").
  const truncated = hits.length >= maxHits

  return { hits: hits.slice(0, maxHits), truncated }
}
