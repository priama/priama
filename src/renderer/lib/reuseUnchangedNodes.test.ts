import { describe, expect, it } from 'vitest'
import { reuseUnchangedNodes } from '@/lib/reuseUnchangedNodes'
import type { TreeNode } from '@shared/types'

function node(partial: Partial<TreeNode> & Pick<TreeNode, 'id'>): TreeNode {
  return {
    parentId: null,
    type: 'scene',
    title: 'Scene',
    sortOrder: 0,
    content: '',
    metadata: '{}',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    ...partial
  }
}

describe('reuseUnchangedNodes', () => {
  it('returns the previous array when a fresh copy has identical fields', () => {
    const prev = [node({ id: 'a' }), node({ id: 'b', content: '<p>x</p>' })]
    const incoming = prev.map((n) => ({ ...n }))

    expect(reuseUnchangedNodes(prev, incoming)).toBe(prev)
  })

  it('keeps unchanged objects and takes changed ones', () => {
    const a = node({ id: 'a' })
    const b = node({ id: 'b', title: 'Old' })
    const next = reuseUnchangedNodes([a, b], [{ ...a }, { ...b, title: 'New' }])

    expect(next[0]).toBe(a)
    expect(next[1].title).toBe('New')
    expect(next[1]).not.toBe(b)
  })

  it('follows added, removed, and reordered nodes', () => {
    const a = node({ id: 'a' })
    const b = node({ id: 'b' })
    const c = node({ id: 'c' })

    const reordered = reuseUnchangedNodes([a, b], [{ ...b }, { ...a }])
    expect(reordered).toEqual([b, a])
    expect(reordered[0]).toBe(b)

    const added = reuseUnchangedNodes([a], [{ ...a }, c])
    expect(added).toEqual([a, c])
    expect(added[0]).toBe(a)

    expect(reuseUnchangedNodes([a, b], [{ ...a }])).toEqual([a])
  })
})
