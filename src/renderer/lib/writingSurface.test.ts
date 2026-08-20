import { describe, expect, it } from 'vitest'
import {
  entityHighlightsVisible,
  focusChromeActive,
  isWritingSurfaceNode,
  isWritingSurfaceOpen,
  typewriterEnabled
} from '@/lib/writingSurface'
import type { CategoryDefinition, TreeNode } from '@shared/types'

function node(partial: Partial<TreeNode> & Pick<TreeNode, 'id' | 'type' | 'title'>): TreeNode {
  return {
    parentId: null,
    content: '',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    categoryId: null,
    metadata: '',
    ...partial
  }
}

const panelCategory: CategoryDefinition = {
  id: 'cat-panel',
  name: 'Notes',
  icon: 'file',
  mode: 'panel',
  sortOrder: 0,
  builtIn: false
}

const editorCategory: CategoryDefinition = {
  id: 'cat-editor',
  name: 'Essays',
  icon: 'file',
  mode: 'editor',
  sortOrder: 0,
  builtIn: false
}

describe('isWritingSurfaceNode', () => {
  it('accepts scenes and simple chapters', () => {
    expect(isWritingSurfaceNode(node({ id: '1', type: 'scene', title: 'S' }), [])).toBe(true)
    expect(
      isWritingSurfaceNode(
        node({
          id: '2',
          type: 'chapter',
          title: 'C',
          metadata: JSON.stringify({ structure: 'simple' })
        }),
        []
      )
    ).toBe(true)
  })

  it('rejects scenes chapters and panel-only entries', () => {
    expect(
      isWritingSurfaceNode(
        node({
          id: '3',
          type: 'chapter',
          title: 'C',
          metadata: JSON.stringify({ structure: 'scenes' })
        }),
        []
      )
    ).toBe(false)
    expect(
      isWritingSurfaceNode(
        node({ id: '4', type: 'entry', title: 'E', categoryId: 'cat-panel' }),
        [panelCategory]
      )
    ).toBe(false)
  })

  it('accepts editor-mode entries', () => {
    expect(
      isWritingSurfaceNode(
        node({ id: '5', type: 'entry', title: 'E', categoryId: 'cat-editor' }),
        [editorCategory]
      )
    ).toBe(true)
  })
})

describe('isWritingSurfaceOpen', () => {
  it('requires no container selection', () => {
    const scene = node({ id: '1', type: 'scene', title: 'S' })
    expect(
      isWritingSurfaceOpen({
        selectedContainerId: 'manuscript',
        selectedNode: scene,
        categories: []
      })
    ).toBe(false)
    expect(
      isWritingSurfaceOpen({
        selectedContainerId: null,
        selectedNode: scene,
        categories: []
      })
    ).toBe(true)
  })
})

describe('entityHighlightsVisible', () => {
  it('respects off / on / hide-in-focus', () => {
    expect(entityHighlightsVisible('off', false)).toBe(false)
    expect(entityHighlightsVisible('on', true)).toBe(true)
    expect(entityHighlightsVisible('hide-in-focus', true)).toBe(false)
    expect(entityHighlightsVisible('hide-in-focus', false)).toBe(true)
  })
})

describe('typewriterEnabled', () => {
  it('respects off / on / focus', () => {
    expect(typewriterEnabled('off', true)).toBe(false)
    expect(typewriterEnabled('on', false)).toBe(true)
    expect(typewriterEnabled('focus', false)).toBe(false)
    expect(typewriterEnabled('focus', true)).toBe(true)
  })
})

describe('focusChromeActive', () => {
  it('requires both focus preference and writing surface', () => {
    expect(focusChromeActive(true, true)).toBe(true)
    expect(focusChromeActive(true, false)).toBe(false)
    expect(focusChromeActive(false, true)).toBe(false)
  })
})
