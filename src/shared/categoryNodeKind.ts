import { BUILTIN_CATEGORY_IDS } from './types'
import type { TreeNode, WikiEntityType } from './types'

const WIKI_NODE_TYPE_TO_CATEGORY_ID: Record<WikiEntityType, string> = {
  character: BUILTIN_CATEGORY_IDS.characters,
  location: BUILTIN_CATEGORY_IDS.locations,
  lore: BUILTIN_CATEGORY_IDS.lore,
  note: BUILTIN_CATEGORY_IDS.notes
}

const CATEGORY_ID_TO_WIKI_NODE_TYPE = Object.fromEntries(
  Object.entries(WIKI_NODE_TYPE_TO_CATEGORY_ID).map(([type, id]) => [id, type])
) as Record<string, WikiEntityType>

export function resolveCategoryForNode(node: TreeNode): string | null {
  if (node.type === 'entry') return node.categoryId ?? null
  if (node.type in WIKI_NODE_TYPE_TO_CATEGORY_ID) {
    return WIKI_NODE_TYPE_TO_CATEGORY_ID[node.type as WikiEntityType]
  }
  return null
}

export function wikiNodeTypeForCategory(categoryId: string): WikiEntityType | null {
  return CATEGORY_ID_TO_WIKI_NODE_TYPE[categoryId] ?? null
}

export function categoryIdForWikiNodeType(type: TreeNode['type']): string | undefined {
  if (type in WIKI_NODE_TYPE_TO_CATEGORY_ID) {
    return WIKI_NODE_TYPE_TO_CATEGORY_ID[type as WikiEntityType]
  }
  return undefined
}

