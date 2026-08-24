import { useMemo, useRef } from 'react'
import { countHtmlWords } from '@shared/manuscriptMeta'
import { manuscriptWordTotal } from '@shared/manuscriptStats'
import type { TreeNode } from '@shared/types'
import { useAppStore } from '@/store/appStore'

type ContentCache = Map<string, { content: string; words: number }>

/**
 * Live manuscript word total from Zustand nodes.
 * Caches strip-tags counts per node; only recounts when content changes.
 */
export function useManuscriptWordTotal(): number {
  const nodes = useAppStore((s) => s.nodes)
  const cacheRef = useRef<ContentCache>(new Map())

  return useMemo(() => {
    const cache = cacheRef.current
    const liveIds = new Set(nodes.map((n) => n.id))
    for (const id of [...cache.keys()]) {
      if (!liveIds.has(id)) cache.delete(id)
    }

    const countContent = (node: TreeNode): number => {
      const cached = cache.get(node.id)
      if (cached && cached.content === node.content) return cached.words
      const words = countHtmlWords(node.content)
      cache.set(node.id, { content: node.content, words })
      return words
    }

    return manuscriptWordTotal(nodes, countContent)
  }, [nodes])
}
