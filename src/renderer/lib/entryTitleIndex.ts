import { categoryOpensInRightPanel, findCategory } from '@shared/categoryView'
import { resolveCategoryForNode } from '@shared/categoryNodeKind'
import {
  DEFAULT_CHARACTER_META,
  parseMetadata,
  type CategoryDefinition,
  type CharacterMeta,
  type TreeNode
} from '@shared/types'
import { isWikiEntityType } from '@/lib/treeUtils'

const WORD_TOKEN_RE = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ']+/g

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

/** Title plus non-empty character aliases — phrases that should match this node. */
export function phrasesForNode(node: TreeNode): string[] {
  const phrases: string[] = []
  const title = node.title.trim()
  if (title) phrases.push(title)

  if (node.type === 'character') {
    const raw = parseMetadata<Partial<CharacterMeta>>(node.metadata, DEFAULT_CHARACTER_META)
    const aliases = Array.isArray(raw.aliases) ? raw.aliases : DEFAULT_CHARACTER_META.aliases
    const seen = new Set(phrases.map((p) => p.toLowerCase()))
    for (const alias of aliases) {
      const trimmed = String(alias).trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      phrases.push(trimmed)
    }
  }

  return phrases
}

function titleTokens(title: string): string[] {
  return title.trim().split(/\s+/).filter(Boolean).map((t) => t.toLowerCase())
}

function addToTrie(root: TrieNode, phrase: string, entry: IndexedEntry): void {
  const tokens = titleTokens(phrase)
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
    const entry: IndexedEntry = {
      id: node.id,
      type: node.type,
      categoryId: resolveCategoryForNode(node),
      title: node.title
    }
    for (const phrase of phrasesForNode(node)) {
      addToTrie(root, phrase, entry)
    }
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
    .map((n) => {
      const phrases = phrasesForNode(n).join(',')
      return `${n.id}:${n.title}:${phrases}:${n.deletedAt ?? ''}`
    })
    .sort()
    .join('|')
}
