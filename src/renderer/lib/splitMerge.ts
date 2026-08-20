import { DOMSerializer } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'
import type { TreeNode } from '@shared/types'
import { isChapterFolder, isSimpleChapter, getScenes, getChildren } from '@/lib/treeUtils'

const TITLE_MAX_LEN = 60

export function stripHtmlToText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function isEmptyHtml(html: string): boolean {
  return !stripHtmlToText(html)
}

/** Title for a newly split document from the below-caret HTML. */
export function titleFromHtml(html: string, maxLen = TITLE_MAX_LEN): string {
  const text = stripHtmlToText(html)
  if (!text) return 'Untitled'
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

/** Join two TipTap HTML documents with a scene-break paragraph (or blank if marker empty). */
export function joinHtmlDocuments(a: string, b: string, marker: string): string {
  const left = a.trim() || '<p></p>'
  const right = b.trim() || '<p></p>'
  const joiner =
    marker.trim().length > 0
      ? `<p>${escapeHtml(marker.trim())}</p>`
      : '<p></p>'
  return `${left}${joiner}${right}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * True when this node can be split into a same-kind sibling
 * (scene under a scenes-chapter, or a simple chapter). Entries are excluded.
 */
export function canSplitNode(node: TreeNode | null | undefined, nodes: TreeNode[]): boolean {
  if (!node || node.deletedAt) return false
  if (node.type === 'scene') {
    if (!node.parentId) return false
    const parent = nodes.find((n) => n.id === node.parentId && !n.deletedAt)
    return !!parent && isChapterFolder(parent)
  }
  if (node.type === 'chapter') {
    return isSimpleChapter(node)
  }
  return false
}

/** Next eligible sibling for merge-with-next, or null. */
export function nextSiblingOfKind(
  node: TreeNode,
  nodes: TreeNode[]
): TreeNode | null {
  if (node.deletedAt) return null

  if (node.type === 'scene') {
    if (!node.parentId) return null
    const parent = nodes.find((n) => n.id === node.parentId && !n.deletedAt)
    if (!parent || !isChapterFolder(parent)) return null
    const scenes = getScenes(nodes, parent.id)
    const idx = scenes.findIndex((s) => s.id === node.id)
    if (idx < 0 || idx >= scenes.length - 1) return null
    return scenes[idx + 1]
  }

  if (node.type === 'chapter' && isSimpleChapter(node)) {
    const siblings = getChildren(nodes, node.parentId ?? null, 'manuscript').filter(
      (n) => n.type === 'chapter' && isSimpleChapter(n)
    )
    const idx = siblings.findIndex((s) => s.id === node.id)
    if (idx < 0 || idx >= siblings.length - 1) return null
    return siblings[idx + 1]
  }

  return null
}

export function canMergeWithNext(node: TreeNode | null | undefined, nodes: TreeNode[]): boolean {
  if (!node) return false
  return nextSiblingOfKind(node, nodes) !== null
}

export function fragmentToHtml(editor: Editor, from: number, to: number): string {
  const slice = editor.state.doc.cut(from, to)
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const div = document.createElement('div')
  div.appendChild(serializer.serializeFragment(slice.content))
  return div.innerHTML
}

export function sliceDocAtPos(
  editor: Editor,
  pos: number
): { aboveHtml: string; belowHtml: string } | null {
  const { doc } = editor.state
  const start = 0
  const end = doc.content.size
  if (pos <= start || pos >= end) return null

  const aboveHtml = fragmentToHtml(editor, start, pos)
  const belowHtml = fragmentToHtml(editor, pos, end)
  if (isEmptyHtml(belowHtml)) return null
  if (isEmptyHtml(aboveHtml) && isEmptyHtml(belowHtml)) return null

  return { aboveHtml: aboveHtml || '<p></p>', belowHtml }
}

/** True when the current caret allows a split (not at ends, below non-empty). */
export function canSplitAtCaret(editor: Editor | null | undefined): boolean {
  if (!editor || editor.isDestroyed) return false
  const { from, to, empty } = editor.state.selection
  if (!empty || from !== to) return false
  return sliceDocAtPos(editor, from) !== null
}

/**
 * Build reorder payload so `newId` sits immediately after `keeperId`
 * among the given sibling list (already sorted by sortOrder).
 */
export function reorderAfterKeeper(
  siblings: TreeNode[],
  keeperId: string,
  newId: string
): { id: string; parentId: string | null; sortOrder: number }[] {
  const withoutNew = siblings.filter((s) => s.id !== newId)
  const keeperIdx = withoutNew.findIndex((s) => s.id === keeperId)
  if (keeperIdx < 0) return []

  const ordered: TreeNode[] = [
    ...withoutNew.slice(0, keeperIdx + 1),
    ...siblings.filter((s) => s.id === newId),
    ...withoutNew.slice(keeperIdx + 1)
  ]

  return ordered.map((n, i) => ({
    id: n.id,
    parentId: n.parentId ?? null,
    sortOrder: i
  }))
}
