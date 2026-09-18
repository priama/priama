import { readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { ProjectMeta, TreeNode } from '@shared/types'

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

const META: ProjectMeta = {
  id: 'project-1',
  title: 'Book',
  author: 'Author',
  genre: '',
  bookSettings: {} as ProjectMeta['bookSettings'],
  categories: [],
  createdAt: '',
  updatedAt: ''
}

const initialState = useAppStore.getState()

beforeEach(() => {
  useAppStore.setState(initialState, true)
})

function countNotifications(run: () => void): number {
  const listener = vi.fn()
  const unsubscribe = useAppStore.subscribe(listener)
  run()
  unsubscribe()
  return listener.mock.calls.length
}

describe('no-op updates do not notify subscribers', () => {
  it('setDirty only notifies when the flag flips', () => {
    const { setDirty } = useAppStore.getState()
    expect(countNotifications(() => setDirty(false))).toBe(0)
    expect(countNotifications(() => setDirty(true))).toBe(1)
    expect(countNotifications(() => setDirty(true))).toBe(0)
  })

  it('updateNodeInStore skips missing nodes and unchanged fields', () => {
    useAppStore.setState({ nodes: [node({ id: 'a', title: 'A', content: 'x' })] })
    const { updateNodeInStore } = useAppStore.getState()
    const before = useAppStore.getState().nodes

    expect(countNotifications(() => updateNodeInStore('missing', { title: 'B' }))).toBe(0)
    expect(countNotifications(() => updateNodeInStore('a', { title: 'A', content: 'x' }))).toBe(0)
    expect(useAppStore.getState().nodes).toBe(before)

    updateNodeInStore('a', { content: 'y' })
    expect(useAppStore.getState().nodes[0].content).toBe('y')
    expect(useAppStore.getState().nodes).not.toBe(before)
  })

  it('setSectionOrder ignores an identical order', () => {
    useAppStore.setState({ sectionOrder: ['characters', 'locations'] })
    const { setSectionOrder } = useAppStore.getState()
    expect(countNotifications(() => setSectionOrder(['characters', 'locations']))).toBe(0)
    expect(countNotifications(() => setSectionOrder(['locations', 'characters']))).toBe(1)
  })
})

describe('applySyncState', () => {
  beforeEach(() => {
    useAppStore.getState().setProject('/books/book.tomes', META, [
      node({ id: 'a', content: 'one' }),
      node({ id: 'b', content: 'two' })
    ])
  })

  it('keeps session state that a project open would reset', () => {
    useAppStore.setState({
      isDirty: true,
      lastBackupAt: '2026-09-18T08:00:00.000Z',
      backupWarningCount: 2,
      showBackupsModal: true
    })

    useAppStore
      .getState()
      .applySyncState('/books/book.tomes', META, [
        node({ id: 'a', content: 'one' }),
        node({ id: 'b', content: 'changed elsewhere' })
      ])

    const s = useAppStore.getState()
    expect(s.isDirty).toBe(true)
    expect(s.lastBackupAt).toBe('2026-09-18T08:00:00.000Z')
    expect(s.backupWarningCount).toBe(2)
    expect(s.showBackupsModal).toBe(true)
    expect(s.nodes[1].content).toBe('changed elsewhere')
  })

  it('does not notify when main echoes what the window already has', () => {
    const { applySyncState } = useAppStore.getState()
    const echo = [node({ id: 'a', content: 'one' }), node({ id: 'b', content: 'two' })]

    expect(countNotifications(() => applySyncState('/books/book.tomes', { ...META }, echo))).toBe(0)
  })

  it('reuses unchanged node objects when one node changes', () => {
    const [a] = useAppStore.getState().nodes
    useAppStore
      .getState()
      .applySyncState('/books/book.tomes', META, [
        node({ id: 'a', content: 'one' }),
        node({ id: 'b', content: 'three' })
      ])

    expect(useAppStore.getState().nodes[0]).toBe(a)
  })

  it('opens a different project from scratch', () => {
    useAppStore.setState({ lastBackupAt: '2026-09-18T08:00:00.000Z' })
    const other = { ...META, id: 'project-2', title: 'Other' }

    useAppStore.getState().applySyncState('/books/other.tomes', other, [node({ id: 'z' })])

    const s = useAppStore.getState()
    expect(s.projectId).toBe('project-2')
    expect(s.lastBackupAt).toBeNull()
    expect(s.nodes.map((n) => n.id)).toEqual(['z'])
  })
})

describe('store subscriptions', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
    })
  }

  it('never subscribes to the whole app store', () => {
    const root = join(__dirname, '..')
    const offenders = sourceFiles(root)
      .filter((file) => /\buseAppStore\(\s*\)/.test(readFileSync(file, 'utf-8')))
      .map((file) => relative(root, file))

    // A bare useAppStore() re-renders on every store change (every save, every dirty
    // flip). Select the fields you need: useAppStore((s) => s.field).
    expect(offenders).toEqual([])
  })
})
