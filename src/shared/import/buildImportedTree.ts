import type { ManuscriptImportNode, ScrivenerImportRow } from '../types'
import { countHtmlWords } from '../manuscriptMeta'

/** Words in the checked preview rows, for the Scrivener preview's total. */
export function includedWordCount(rows: ScrivenerImportRow[], checked: boolean[]): number {
  return rows.reduce((sum, r, i) => (checked[i] ? sum + countHtmlWords(r.html) : sum), 0)
}

/**
 * Rebuild the nested manuscript tree from the flat Scrivener preview rows,
 * honoring the writer's checkboxes. An unchecked row hides its whole subtree
 * even if a descendant stayed checked.
 */
export function buildImportedTree(
  rows: ScrivenerImportRow[],
  checked: boolean[]
): ManuscriptImportNode[] {
  const roots: ManuscriptImportNode[] = []
  const stack: { depth: number; children: ManuscriptImportNode[] }[] = [
    { depth: -1, children: roots }
  ]
  let skipUntilDepth: number | null = null

  rows.forEach((row, i) => {
    if (skipUntilDepth !== null) {
      if (row.depth > skipUntilDepth) return
      skipUntilDepth = null
    }
    if (!checked[i]) {
      skipUntilDepth = row.depth
      return
    }
    while (stack.length > 1 && stack[stack.length - 1].depth >= row.depth) stack.pop()
    const node: ManuscriptImportNode = {
      title: row.title,
      html: row.html,
      synopsis: row.synopsis || undefined,
      children: row.kind === 'folder' ? [] : undefined
    }
    stack[stack.length - 1].children.push(node)
    if (row.kind === 'folder' && node.children) {
      stack.push({ depth: row.depth, children: node.children })
    }
  })

  return roots
}
