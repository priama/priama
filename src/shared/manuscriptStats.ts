import { listManuscriptChapters } from './export/manuscript'
import { chapterWordCount, countHtmlWords } from './manuscriptMeta'
import type { TreeNode } from './types'

export type NodeWordCounter = (node: TreeNode) => number

const defaultCount: NodeWordCounter = (node) => countHtmlWords(node.content)

/** Total manuscript words (wiki excluded). Same walk as export. */
export function manuscriptWordTotal(
  nodes: TreeNode[],
  countContent: NodeWordCounter = defaultCount
): number {
  const chapters = listManuscriptChapters(nodes)
  let total = 0
  for (const ref of chapters) {
    const chapter = nodes.find((n) => n.id === ref.id && !n.deletedAt)
    if (!chapter) continue
    total += chapterWordCount(chapter, nodes, countContent)
  }
  return total
}
