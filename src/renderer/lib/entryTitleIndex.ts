import { categoryOpensInRightPanel, findCategory } from '@shared/categoryView'
import { resolveCategoryForNode } from '@shared/categoryNodeKind'
import type { CategoryDefinition, TreeNode } from '@shared/types'
import { isWikiEntityType } from '@/lib/treeUtils'

export const WORD_TOKEN_RE = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ']+/g

export interface IndexedEntry {
  id: string
  type: TreeNode['type']
  categoryId: string | null
  title: string
}

export interface TextToken {
  word: string
  from: number
  to: number
}

export interface EntityTextMatch {
  from: number
  to: number
  entry: IndexedEntry
}

interface TrieNode {
  entries: IndexedEntry[]
  children: Map<string, TrieNode>
}

export interface EntryTitleIndex {
  root: TrieNode
}

function createTrieNode(): TrieNode {
  return { entries: [], children: new Map() }
}

function qualifiesForIndex(
  node: TreeNode,
  categories: CategoryDefinition[]
): boolean {
  if (node.deletedAt) return false
  if (!node.title.trim()) return false

  if (isWikiEntityType(node.type)) return true

  if (node.type === 'entry') {
    const category = findCategory(categories, resolveCategoryForNode(node))
    return categoryOpensInRightPanel(category)
  }

  return false
}

function titleTokens(title: string): string[] {
  return title.trim().split(/\s+/).filter(Boolean).map((t) => t.toLowerCase())
}

function addToTrie(root: TrieNode, entry: IndexedEntry): void {
  const tokens = titleTokens(entry.title)
  if (tokens.length === 0) return

  let node = root
  for (const token of tokens) {
    let child = node.children.get(token)
    if (!child) {
      child = createTrieNode()
      node.children.set(token, child)
    }
    node = child
  }
  node.entries.push(entry)
}

export function buildEntryTitleIndex(
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): EntryTitleIndex {
  const root = createTrieNode()

  for (const node of nodes) {
    if (!qualifiesForIndex(node, categories)) continue
    addToTrie(root, {
      id: node.id,
      type: node.type,
      categoryId: resolveCategoryForNode(node),
      title: node.title
    })
  }

  return { root }
}

export function tokenizeWords(text: string): TextToken[] {
  const tokens: TextToken[] = []
  WORD_TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WORD_TOKEN_RE.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      from: match.index,
      to: match.index + match[0].length
    })
  }
  return tokens
}

function overlapsRange(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((r) => from < r.to && to > r.from)
}

export function findEntityMatches(index: EntryTitleIndex, text: string): EntityTextMatch[] {
  const tokens = tokenizeWords(text)
  const matches: EntityTextMatch[] = []
  const usedRanges: Array<{ from: number; to: number }> = []

  let i = 0
  while (i < tokens.length) {
    let node = index.root
    let best: { endIndex: number; entry: IndexedEntry } | null = null
    let j = i

    while (j < tokens.length) {
      const child = node.children.get(tokens[j].word.toLowerCase())
      if (!child) break
      node = child
      if (node.entries.length > 0) {
        best = { endIndex: j, entry: node.entries[0] }
      }
      j++
    }

    if (best) {
      const from = tokens[i].from
      const to = tokens[best.endIndex].to
      if (!overlapsRange(from, to, usedRanges)) {
        matches.push({ from, to, entry: best.entry })
        usedRanges.push({ from, to })
      }
      i = best.endIndex + 1
    } else {
      i++
    }
  }

  return matches
}

export function panelEntryFingerprint(
  nodes: TreeNode[],
  categories: CategoryDefinition[]
): string {
  return nodes
    .filter((n) => qualifiesForIndex(n, categories))
    .map((n) => `${n.id}:${n.title}:${n.deletedAt ?? ''}`)
    .sort()
    .join('|')
}
