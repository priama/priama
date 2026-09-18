import type { TreeNode } from '@shared/types'

function sameNode(a: TreeNode, b: TreeNode): boolean {
  const keys = Object.keys(a) as (keyof TreeNode)[]
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}

/**
 * Merge a fresh node list from main into the current one, keeping the existing object for
 * every node whose fields are unchanged. Returns `prev` itself when nothing changed, so
 * `nodes` selectors and memo deps only fire for real edits.
 */
export function reuseUnchangedNodes(prev: TreeNode[], incoming: TreeNode[]): TreeNode[] {
  const byId = new Map(prev.map((n) => [n.id, n]))
  let unchanged = prev.length === incoming.length
  const next = incoming.map((node, i) => {
    const existing = byId.get(node.id)
    const kept = existing && sameNode(existing, node) ? existing : node
    if (kept !== prev[i]) unchanged = false
    return kept
  })
  return unchanged ? prev : next
}
