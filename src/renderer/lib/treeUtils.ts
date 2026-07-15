import type {
  ChapterMeta,
  FolderMeta,
  FolderScope,
  NodeType,
  TrashCategory,
  TreeNode,
  WikiEntityType
} from '@shared/types'
import { DEFAULT_CHAPTER_META, DEFAULT_FOLDER_META, parseMetadata } from '@shared/types'

export function isSimpleChapter(node: TreeNode): boolean {
  const meta = parseMetadata<ChapterMeta>(node.metadata, DEFAULT_CHAPTER_META)
  return node.type === 'chapter' && meta.structure === 'simple'
}

export function isChapterFolder(node: TreeNode): boolean {
  if (node.type !== 'chapter') return false
  const meta = parseMetadata<ChapterMeta>(node.metadata, DEFAULT_CHAPTER_META)
  return meta.structure === 'scenes'
}

export function isFolder(node: TreeNode): boolean {
  return node.type === 'folder'
}

export function getFolderScope(node: TreeNode): FolderScope | null {
  if (node.type !== 'folder') return null
  const meta = parseMetadata<FolderMeta>(node.metadata, DEFAULT_FOLDER_META)
  return meta.scope
}

const WIKI_ENTITY_TYPES = new Set<WikiEntityType>(['character', 'location', 'lore', 'note'])

export function isWikiEntityType(type: TreeNode['type']): type is WikiEntityType {
  return WIKI_ENTITY_TYPES.has(type as WikiEntityType)
}

/** Root/folder children for a custom entry category (folders + entries in that category). */
export function getCategoryScopedChildren(
  nodes: TreeNode[],
  parentId: string | null,
  categoryId: string
): TreeNode[] {
  return getChildren(nodes, parentId, 'entry').filter(
    (n) => n.type === 'folder' || n.categoryId === categoryId
  )
}

function isNodeInCategoryTree(nodes: TreeNode[], nodeId: string, categoryId: string): boolean {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node || node.deletedAt) return false
  if (node.type === 'entry') return node.categoryId === categoryId
  if ((node.parentId ?? null) === null) {
    return getCategoryScopedChildren(nodes, null, categoryId).some((n) => n.id === nodeId)
  }
  return isNodeInCategoryTree(nodes, node.parentId!, categoryId)
}

/** Resolve which entry category a folder belongs to (for container card views). */
export function resolveEntryCategoryIdForFolder(
  nodes: TreeNode[],
  folderId: string,
  categoryIds: string[]
): string | undefined {
  const entryChild = nodes.find(
    (n) => !n.deletedAt && n.parentId === folderId && n.type === 'entry' && n.categoryId
  )
  if (entryChild?.categoryId && categoryIds.includes(entryChild.categoryId)) {
    return entryChild.categoryId
  }
  return categoryIds.find((id) => isNodeInCategoryTree(nodes, folderId, id))
}

export function getTrashNodes(nodes: TreeNode[], category: TrashCategory): TreeNode[] {
  const typeMap: Record<TrashCategory, NodeType> = {
    chapters: 'chapter',
    scenes: 'scene',
    characters: 'character',
    locations: 'location',
    lore: 'lore',
    notes: 'note',
    entries: 'entry'
  }
  const type = typeMap[category]
  return nodes
    .filter((n) => n.type === type && n.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function hasTrashItems(nodes: TreeNode[]): boolean {
  return nodes.some((n) => n.deletedAt)
}

export function getTrashCategories(nodes: TreeNode[]): TrashCategory[] {
  const categories: TrashCategory[] = []
  if (nodes.some((n) => n.deletedAt && n.type === 'chapter')) categories.push('chapters')
  if (nodes.some((n) => n.deletedAt && n.type === 'scene')) categories.push('scenes')
  if (nodes.some((n) => n.deletedAt && n.type === 'character')) categories.push('characters')
  if (nodes.some((n) => n.deletedAt && n.type === 'location')) categories.push('locations')
  if (nodes.some((n) => n.deletedAt && n.type === 'lore')) categories.push('lore')
  if (nodes.some((n) => n.deletedAt && n.type === 'note')) categories.push('notes')
  if (nodes.some((n) => n.deletedAt && n.type === 'entry')) categories.push('entries')
  return categories
}

export function isTrashContainerId(id: string): id is `trash:${TrashCategory}` {
  return id.startsWith('trash:')
}

export function parseTrashContainerId(id: string): TrashCategory | null {
  if (!isTrashContainerId(id)) return null
  return id.slice('trash:'.length) as TrashCategory
}

function isFolderContainerId(id: string): boolean {
  return id.startsWith('folder:')
}

export function parseFolderContainerId(id: string): string | null {
  if (!isFolderContainerId(id)) return null
  return id.slice('folder:'.length)
}

export function folderContainerId(folderId: string): string {
  return `folder:${folderId}`
}

export function trashContainerId(category: TrashCategory): string {
  return `trash:${category}`
}

const MANUSCRIPT_CHILD_TYPES: NodeType[] = ['folder', 'chapter']

export function getChildren(
  nodes: TreeNode[],
  parentId: string | null,
  scope: FolderScope,
  options?: { includeDeleted?: boolean }
): TreeNode[] {
  const activeOnly = !options?.includeDeleted
  const childTypes = scope === 'manuscript' ? MANUSCRIPT_CHILD_TYPES : getWikiChildTypes(scope)

  return nodes
    .filter((n) => {
      if (activeOnly && n.deletedAt) return false
      if ((n.parentId ?? null) !== parentId) return false
      if (n.type === 'folder') {
        return getFolderScope(n) === scope
      }
      if (scope === 'manuscript') {
        return n.type === 'chapter'
      }
      return n.type === scopeToEntityType(scope)
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function getWikiChildTypes(scope: FolderScope): NodeType[] {
  const entityType = scopeToEntityType(scope)
  return ['folder', entityType]
}

function scopeToEntityType(scope: FolderScope): NodeType {
  switch (scope) {
    case 'characters':
      return 'character'
    case 'locations':
      return 'location'
    case 'lore':
      return 'lore'
    case 'notes':
      return 'note'
    case 'entry':
      return 'entry'
    default:
      return 'chapter'
  }
}

export function getScenes(nodes: TreeNode[], chapterId: string): TreeNode[] {
  return nodes
    .filter((n) => !n.deletedAt && n.parentId === chapterId && n.type === 'scene')
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function stripHtmlPreview(html: string, maxLen = 100): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 'Empty'
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

function stripPlainTextPreview(text: string, maxLen = 100): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return 'Empty'
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen)}…` : normalized
}

export function stripNodeContentPreview(node: TreeNode, maxLen = 100): string {
  if (node.type === 'note') {
    return stripPlainTextPreview(node.content, maxLen)
  }
  if (node.type === 'folder') {
    return 'Folder'
  }
  return stripHtmlPreview(node.content, maxLen)
}

export function countNodeWords(node: TreeNode): number {
  if (node.type === 'folder') return 0
  if (node.type === 'note') {
    const text = node.content.trim()
    if (!text) return 0
    return text.split(/\s+/).filter(Boolean).length
  }
  const text = node.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

export function getSceneChapters(nodes: TreeNode[]): TreeNode[] {
  return nodes.filter((n) => !n.deletedAt && n.type === 'chapter' && isChapterFolder(n))
}
