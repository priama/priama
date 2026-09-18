import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { convertScenesChapterToSimple, convertSimpleToSceneChapter } from '@/lib/documentActions'
import {
  getUnsavedContent,
  hasUnpersistedChanges,
  markContentDirty,
  registerActiveEditor,
  resetPersistenceState
} from '@/lib/contentPersistence'
import { useAppStore } from '@/store/appStore'
import { useHistoryStore } from '@/store/historyStore'
import type { TreeNode } from '@shared/types'

function node(partial: Partial<TreeNode> & Pick<TreeNode, 'id' | 'type'>): TreeNode {
  return {
    parentId: null,
    title: partial.id,
    sortOrder: 0,
    content: '',
    metadata: '{}',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    ...partial
  }
}

const tree = {
  update: vi.fn(),
  create: vi.fn(),
  moveToTrash: vi.fn(),
  getAll: vi.fn()
}

beforeEach(() => {
  resetPersistenceState()
  registerActiveEditor(null)
  useHistoryStore.getState().clear()
  for (const mock of Object.values(tree)) mock.mockReset()
  tree.update.mockResolvedValue({})
  tree.moveToTrash.mockResolvedValue([])
  tree.getAll.mockImplementation(async () => useAppStore.getState().nodes)
  vi.stubGlobal('window', { electronAPI: { tree } })
})

afterEach(() => {
  resetPersistenceState()
  registerActiveEditor(null)
  vi.unstubAllGlobals()
})

describe('document actions read live text, not the lagging store copy', () => {
  it('converting scenes to a simple chapter joins the open scene from its editor buffer', async () => {
    const chapter = node({ id: 'ch', type: 'chapter', metadata: '{"structure":"scenes"}' })
    useAppStore.setState({
      nodes: [
        chapter,
        node({ id: 's1', type: 'scene', parentId: 'ch', sortOrder: 0, content: '<p>one</p>' }),
        node({ id: 's2', type: 'scene', parentId: 'ch', sortOrder: 1, content: '<p>old</p>' })
      ]
    })
    registerActiveEditor(() => ({ nodeId: 's2', content: '<p>typed just now</p>' }))

    await convertScenesChapterToSimple(chapter)

    const chapterWrite = tree.update.mock.calls.find(([id]) => id === 'ch')
    expect(chapterWrite?.[1].content).toContain('<p>typed just now</p>')
    expect(chapterWrite?.[1].content).not.toContain('<p>old</p>')
  })

  it('converting a simple chapter to scenes settles the pending save before emptying it', async () => {
    const chapter = node({
      id: 'ch',
      type: 'chapter',
      metadata: '{"structure":"simple"}',
      content: '<p>old</p>'
    })
    useAppStore.setState({ nodes: [chapter] })
    tree.create.mockResolvedValue(node({ id: 'scene-new', type: 'scene', parentId: 'ch' }))
    markContentDirty('ch', '<p>typed</p>')

    await convertSimpleToSceneChapter(chapter)

    expect(tree.update).toHaveBeenCalledWith('scene-new', { content: '<p>typed</p>' })
    const chapterBodies = tree.update.mock.calls
      .filter(([id, updates]) => id === 'ch' && 'content' in updates)
      .map(([, updates]) => updates.content)
    expect(chapterBodies.at(-1)).toBe('')
    // Nothing left to land later and put the old body back into the emptied chapter.
    expect(getUnsavedContent('ch')).toBeUndefined()
    expect(hasUnpersistedChanges()).toBe(false)
  })
})
