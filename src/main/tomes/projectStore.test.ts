import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fse from 'fs-extra'
import { join } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import {
  createProject,
  openProject,
  closeProject,
  isOpen,
  getProjectMeta,
  getProjectPath,
  getProjectRootPath,
  getAllNodes,
  getNode,
  createNode,
  createFolder,
  updateNode,
  moveToTrash,
  restoreNode,
  permanentDelete,
  reorderNodes,
  createChapter,
  updateProjectMeta,
  updateBookSettings,
  updateCategories,
  getEntityNodes,
  saveProject,
  getUiState,
  updateUiState
} from './projectStore'
import type { CreateProjectInput } from '@shared/types'
import { PROJECT_FILENAME } from '@shared/types'

vi.mock('../config', () => ({
  addRecentProject: vi.fn().mockResolvedValue(undefined),
  setBackupLocations: vi.fn().mockResolvedValue(undefined),
  updateRecentLastOpened: vi.fn().mockResolvedValue(undefined),
  updateRecentTitle: vi.fn().mockResolvedValue(undefined),
  getBackupLocations: vi.fn().mockResolvedValue([]),
  getConfig: vi.fn().mockResolvedValue({
    preferences: { maxBackupsPerLocation: 10, theme: 'dark' },
    recentProjects: []
  })
}))

vi.mock('./backup', () => ({
  createProjectBackup: vi.fn().mockResolvedValue({
    localBackupPath: '/tmp/fake.zip',
    warnings: [],
    unreachablePaths: []
  }),
  restoreProjectTomesFromLatestBackup: vi.fn().mockResolvedValue(false)
}))

let testDir: string

function makeInput(overrides?: Partial<CreateProjectInput>): CreateProjectInput {
  return {
    title: 'Test Project',
    author: 'Test Author',
    genre: 'Fantasy',
    primaryParentDir: testDir,
    backupLocations: [],
    ...overrides
  }
}

beforeEach(async () => {
  testDir = join(tmpdir(), `priama-test-${uuidv4()}`)
  await fse.ensureDir(testDir)
  closeProject()
})

afterEach(async () => {
  closeProject()
  await fse.remove(testDir)
})

describe('createProject', () => {
  it('creates project with correct folder structure', async () => {
    const result = await createProject(makeInput())

    expect(result.meta.title).toBe('Test Project')
    expect(result.meta.author).toBe('Test Author')
    expect(result.meta.genre).toBe('Fantasy')
    expect(result.meta.id).toBeTruthy()

    const root = result.projectRoot
    expect(await fse.pathExists(join(root, PROJECT_FILENAME))).toBe(true)
    expect(await fse.pathExists(join(root, 'manuscript'))).toBe(true)
    expect(await fse.pathExists(join(root, 'wiki', 'characters'))).toBe(true)
    expect(await fse.pathExists(join(root, 'wiki', 'locations'))).toBe(true)
    expect(await fse.pathExists(join(root, 'wiki', 'lore'))).toBe(true)
    expect(await fse.pathExists(join(root, 'wiki', 'notes'))).toBe(true)
    expect(await fse.pathExists(join(root, 'backups'))).toBe(true)
    expect(await fse.pathExists(join(root, 'assets'))).toBe(true)
  })

  it('sets project as open after creation', async () => {
    await createProject(makeInput())
    expect(isOpen()).toBe(true)
    expect(getProjectPath()).toBeTruthy()
    expect(getProjectRootPath()).toBeTruthy()
  })

  it('writes valid manifest to disk', async () => {
    const result = await createProject(makeInput())
    const raw = await fse.readFile(result.path, 'utf-8')
    const manifest = JSON.parse(raw)

    expect(manifest.__tomes).toBe('1.0')
    expect(manifest.title).toBe('Test Project')
    expect(manifest.id).toBe(result.meta.id)
    expect(manifest.index.chapters).toEqual([])
    expect(manifest.index.characters).toEqual([])
  })

  it('rejects duplicate folder names', async () => {
    await createProject(makeInput())
    closeProject()
    await expect(createProject(makeInput())).rejects.toThrow('already exists')
  })

  it('creates default categories', async () => {
    const result = await createProject(makeInput())
    expect(result.meta.categories.length).toBeGreaterThan(0)
  })

  it('starts with empty node list', async () => {
    await createProject(makeInput())
    expect(getAllNodes()).toHaveLength(0)
  })
})

describe('openProject / closeProject', () => {
  it('opens a previously created project', async () => {
    const created = await createProject(makeInput())
    const path = created.path
    closeProject()
    expect(isOpen()).toBe(false)

    const opened = await openProject(path)
    expect(isOpen()).toBe(true)
    expect(opened.meta.title).toBe('Test Project')
  })

  it('loads nodes that were created before close', async () => {
    const created = await createProject(makeInput())
    await createNode(null, 'chapter', 'Chapter 1')
    await createNode(null, 'character', 'Hero')
    const path = created.path
    closeProject()

    const opened = await openProject(path)
    expect(opened.nodes).toHaveLength(2)
    expect(opened.nodes.map((n) => n.title).sort()).toEqual(['Chapter 1', 'Hero'])
  })

  it('rejects invalid project file', async () => {
    const fakePath = join(testDir, PROJECT_FILENAME)
    await fse.writeFile(fakePath, 'not json', 'utf-8')
    await expect(openProject(fakePath)).rejects.toThrow()
  })

  it('closeProject clears all state', async () => {
    await createProject(makeInput())
    closeProject()
    expect(isOpen()).toBe(false)
    expect(getProjectPath()).toBeNull()
    expect(getProjectRootPath()).toBeNull()
    expect(getProjectMeta()).toBeNull()
    expect(getAllNodes()).toHaveLength(0)
  })

  it('opening a new project closes the current one', async () => {
    const first = await createProject(makeInput({ title: 'First' }))
    const firstPath = first.path

    const secondDir = join(tmpdir(), `priama-test-${uuidv4()}`)
    await fse.ensureDir(secondDir)
    try {
      const second = await createProject(makeInput({ title: 'Second', primaryParentDir: secondDir }))
      expect(getProjectMeta()!.title).toBe('Second')
      closeProject()

      await openProject(firstPath)
      expect(getProjectMeta()!.title).toBe('First')
    } finally {
      closeProject()
      await fse.remove(secondDir)
    }
  })
})

describe('createNode', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('creates a chapter node', async () => {
    const node = await createNode(null, 'chapter', 'Chapter 1')
    expect(node.type).toBe('chapter')
    expect(node.title).toBe('Chapter 1')
    expect(node.parentId).toBeNull()
    expect(node.content).toBe('')
    expect(node.sortOrder).toBe(0)
    expect(node.id).toBeTruthy()
    expect(node.createdAt).toBeTruthy()
  })

  it('creates a character node', async () => {
    const node = await createNode(null, 'character', 'Hero')
    expect(node.type).toBe('character')
    expect(node.title).toBe('Hero')
  })

  it('assigns incremental sort orders', async () => {
    const a = await createNode(null, 'chapter', 'A')
    const b = await createNode(null, 'chapter', 'B')
    const c = await createNode(null, 'chapter', 'C')
    expect(a.sortOrder).toBe(0)
    expect(b.sortOrder).toBe(1)
    expect(c.sortOrder).toBe(2)
  })

  it('persists node to disk', async () => {
    const node = await createNode(null, 'chapter', 'Persisted')
    const path = getProjectPath()!
    closeProject()

    const opened = await openProject(path)
    const found = opened.nodes.find((n) => n.id === node.id)
    expect(found).toBeTruthy()
    expect(found!.title).toBe('Persisted')
  })

  it('adds node to cache immediately', async () => {
    const node = await createNode(null, 'chapter', 'Cached')
    expect(getNode(node.id)).toBeTruthy()
    expect(getAllNodes()).toHaveLength(1)
  })

  it('creates scene as child of chapter', async () => {
    const chapter = await createNode(null, 'chapter', 'Ch1')
    const scene = await createNode(chapter.id, 'scene', 'Scene 1')
    expect(scene.parentId).toBe(chapter.id)
    expect(scene.type).toBe('scene')
  })

  it('creates entry with categoryId', async () => {
    const node = await createNode(null, 'entry', 'Custom Entry', {
      categoryId: 'custom-cat'
    })
    expect(node.categoryId).toBe('custom-cat')
  })
})

describe('createFolder', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('creates a manuscript folder', async () => {
    const folder = await createFolder('manuscript', null, 'My Folder')
    expect(folder.type).toBe('folder')
    expect(folder.title).toBe('My Folder')
    expect(folder.metadata).toContain('manuscript')
  })

  it('creates a wiki folder with scope', async () => {
    const folder = await createFolder('characters', null, 'Group A')
    expect(folder.metadata).toContain('characters')
  })

  it('creates nested folder', async () => {
    const parent = await createFolder('manuscript', null, 'Parent')
    const child = await createFolder('manuscript', parent.id, 'Child')
    expect(child.parentId).toBe(parent.id)
  })
})

describe('updateNode', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('updates title', async () => {
    const node = await createNode(null, 'chapter', 'Original')
    const updated = await updateNode(node.id, { title: 'Renamed' })
    expect(updated.title).toBe('Renamed')
    expect(getNode(node.id)!.title).toBe('Renamed')
  })

  it('updates content', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    const updated = await updateNode(node.id, { content: 'Hello world' })
    expect(updated.content).toBe('Hello world')
  })

  it('updates parentId (reparenting)', async () => {
    const folder = await createFolder('manuscript', null, 'Folder')
    const chapter = await createNode(null, 'chapter', 'Ch1')
    const updated = await updateNode(chapter.id, { parentId: folder.id })
    expect(updated.parentId).toBe(folder.id)
  })

  it('updates sortOrder', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    const updated = await updateNode(node.id, { sortOrder: 5 })
    expect(updated.sortOrder).toBe(5)
  })

  it('persists updates to disk', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    await updateNode(node.id, { title: 'Updated Title', content: 'New content' })
    const path = getProjectPath()!
    closeProject()

    const opened = await openProject(path)
    const found = opened.nodes.find((n) => n.id === node.id)!
    expect(found.title).toBe('Updated Title')
    expect(found.content).toBe('New content')
  })

  it('throws for nonexistent node', async () => {
    await expect(updateNode('nonexistent', { title: 'X' })).rejects.toThrow('not found')
  })

  it('updates updatedAt timestamp', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    const before = node.updatedAt
    await new Promise((r) => setTimeout(r, 10))
    const updated = await updateNode(node.id, { title: 'Ch2' })
    expect(updated.updatedAt).not.toBe(before)
  })
})

describe('moveToTrash', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('soft-deletes a node', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    await moveToTrash(node.id)
    const trashed = getNode(node.id)!
    expect(trashed.deletedAt).toBeTruthy()
    expect(trashed.originalParentId).toBeNull()
  })

  it('soft-deletes chapter and its scenes', async () => {
    const chapter = await createNode(null, 'chapter', 'Ch1')
    const scene1 = await createNode(chapter.id, 'scene', 'S1')
    const scene2 = await createNode(chapter.id, 'scene', 'S2')

    await moveToTrash(chapter.id)

    expect(getNode(chapter.id)!.deletedAt).toBeTruthy()
    expect(getNode(scene1.id)!.deletedAt).toBeTruthy()
    expect(getNode(scene2.id)!.deletedAt).toBeTruthy()
  })

  it('soft-deletes folder and its children', async () => {
    const folder = await createFolder('manuscript', null, 'Folder')
    const chapter = await createNode(folder.id, 'chapter', 'Ch1')

    await moveToTrash(folder.id)

    expect(getNode(folder.id)!.deletedAt).toBeTruthy()
    expect(getNode(chapter.id)!.deletedAt).toBeTruthy()
  })

  it('preserves originalParentId for restore', async () => {
    const folder = await createFolder('manuscript', null, 'Folder')
    const chapter = await createNode(folder.id, 'chapter', 'Ch1')

    await moveToTrash(chapter.id)
    const trashed = getNode(chapter.id)!
    expect(trashed.originalParentId).toBe(folder.id)
  })

  it('persists trash state to disk', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    await moveToTrash(node.id)
    const path = getProjectPath()!
    closeProject()

    const opened = await openProject(path)
    const found = opened.nodes.find((n) => n.id === node.id)!
    expect(found.deletedAt).toBeTruthy()
  })
})

describe('restoreNode', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('restores a trashed node', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    await moveToTrash(node.id)
    await restoreNode(node.id)

    const restored = getNode(node.id)!
    expect(restored.deletedAt).toBeNull()
    expect(restored.originalParentId).toBeNull()
  })

  it('restores to original parent when parent still exists', async () => {
    const folder = await createFolder('manuscript', null, 'Folder')
    const chapter = await createNode(folder.id, 'chapter', 'Ch1')
    await moveToTrash(chapter.id)
    await restoreNode(chapter.id)

    expect(getNode(chapter.id)!.parentId).toBe(folder.id)
  })

  it('restores chapter with its scenes', async () => {
    const chapter = await createNode(null, 'chapter', 'Ch1')
    const scene = await createNode(chapter.id, 'scene', 'S1')
    await moveToTrash(chapter.id)
    await restoreNode(chapter.id)

    expect(getNode(chapter.id)!.deletedAt).toBeNull()
    expect(getNode(scene.id)!.deletedAt).toBeNull()
  })

  it('throws RESTORE_NEEDS_TARGET when original chapter is trashed', async () => {
    const chapter = await createNode(null, 'chapter', 'Ch1')
    const scene = await createNode(chapter.id, 'scene', 'S1')

    // Trash the whole chapter (cascades to scene)
    await moveToTrash(chapter.id)

    // Trying to restore just the scene while its chapter is still trashed
    await expect(restoreNode(scene.id)).rejects.toThrow('RESTORE_NEEDS_TARGET')
  })

  it('restores orphaned scene to specified target', async () => {
    const ch1 = await createNode(null, 'chapter', 'Ch1')
    const scene = await createNode(ch1.id, 'scene', 'S1')
    const ch2 = await createNode(null, 'chapter', 'Ch2')
    await moveToTrash(ch1.id)

    await restoreNode(scene.id, ch2.id)
    expect(getNode(scene.id)!.parentId).toBe(ch2.id)
    expect(getNode(scene.id)!.deletedAt).toBeNull()
  })
})

describe('permanentDelete', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('permanently removes a node from cache and disk', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    await permanentDelete(node.id)

    expect(getNode(node.id)).toBeNull()
    expect(getAllNodes().find((n) => n.id === node.id)).toBeUndefined()
  })

  it('permanently removes chapter and its scenes', async () => {
    const chapter = await createNode(null, 'chapter', 'Ch1')
    const scene = await createNode(chapter.id, 'scene', 'S1')
    await permanentDelete(chapter.id)

    expect(getNode(chapter.id)).toBeNull()
    expect(getNode(scene.id)).toBeNull()
  })

  it('does not reappear after reopen', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    await permanentDelete(node.id)
    const path = getProjectPath()!
    closeProject()

    const opened = await openProject(path)
    expect(opened.nodes.find((n) => n.id === node.id)).toBeUndefined()
  })
})

describe('reorderNodes', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('updates sort orders', async () => {
    const a = await createNode(null, 'chapter', 'A')
    const b = await createNode(null, 'chapter', 'B')
    const c = await createNode(null, 'chapter', 'C')

    await reorderNodes([
      { id: c.id, parentId: null, sortOrder: 0 },
      { id: a.id, parentId: null, sortOrder: 1 },
      { id: b.id, parentId: null, sortOrder: 2 }
    ])

    expect(getNode(c.id)!.sortOrder).toBe(0)
    expect(getNode(a.id)!.sortOrder).toBe(1)
    expect(getNode(b.id)!.sortOrder).toBe(2)
  })

  it('can reparent during reorder', async () => {
    const folder = await createFolder('manuscript', null, 'Folder')
    const chapter = await createNode(null, 'chapter', 'Ch1')

    await reorderNodes([
      { id: chapter.id, parentId: folder.id, sortOrder: 0 }
    ])

    expect(getNode(chapter.id)!.parentId).toBe(folder.id)
  })

  it('persists reorder to disk', async () => {
    const a = await createNode(null, 'chapter', 'A')
    const b = await createNode(null, 'chapter', 'B')

    await reorderNodes([
      { id: b.id, parentId: null, sortOrder: 0 },
      { id: a.id, parentId: null, sortOrder: 1 }
    ])

    const path = getProjectPath()!
    closeProject()
    const opened = await openProject(path)

    const foundA = opened.nodes.find((n) => n.id === a.id)!
    const foundB = opened.nodes.find((n) => n.id === b.id)!
    expect(foundB.sortOrder).toBe(0)
    expect(foundA.sortOrder).toBe(1)
  })
})

describe('createChapter', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('creates a simple chapter', async () => {
    const chapter = await createChapter('simple')
    expect(chapter.type).toBe('chapter')
    expect(chapter.title).toBe('New Chapter')
    expect(chapter.metadata).toContain('simple')
  })

  it('creates a scene chapter with initial scene', async () => {
    const chapter = await createChapter('scenes')
    expect(chapter.metadata).toContain('scenes')

    const scenes = getAllNodes().filter((n) => n.type === 'scene' && n.parentId === chapter.id)
    expect(scenes).toHaveLength(1)
    expect(scenes[0].title).toBe('New Scene')
  })

  it('creates chapter under a parent', async () => {
    const folder = await createFolder('manuscript', null, 'Folder')
    const chapter = await createChapter('simple', folder.id)
    expect(chapter.parentId).toBe(folder.id)
  })
})

describe('updateProjectMeta', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('updates title', async () => {
    const meta = await updateProjectMeta({ title: 'New Title' })
    expect(meta.title).toBe('New Title')
    expect(getProjectMeta()!.title).toBe('New Title')
  })

  it('updates author', async () => {
    const meta = await updateProjectMeta({ author: 'New Author' })
    expect(meta.author).toBe('New Author')
  })

  it('clears genre', async () => {
    const meta = await updateProjectMeta({ genre: '' })
    expect(meta.genre).toBe('')
  })

  it('persists to disk', async () => {
    await updateProjectMeta({ title: 'Persisted Title' })
    const path = getProjectPath()!
    closeProject()

    const opened = await openProject(path)
    expect(opened.meta.title).toBe('Persisted Title')
  })

  it('updates and persists spellCheckLang', async () => {
    const meta = await updateProjectMeta({ spellCheckLang: 'es' })
    expect(meta.spellCheckLang).toBe('es')
    expect(getProjectMeta()!.spellCheckLang).toBe('es')

    const path = getProjectPath()!
    closeProject()

    const opened = await openProject(path)
    expect(opened.meta.spellCheckLang).toBe('es')
  })
})

describe('updateBookSettings', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('updates and returns book settings', async () => {
    const settings = await updateBookSettings({ chapterLabelPrefix: 'Part' })
    expect(settings.chapterLabelPrefix).toBe('Part')
  })
})

describe('updateCategories', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('replaces categories', async () => {
    const newCats = [{ id: 'custom', name: 'Custom', nodeType: 'entry' as const, view: 'panel' as const }]
    const meta = await updateCategories(newCats)
    expect(meta.categories.some((c) => c.id === 'custom')).toBe(true)
  })
})

describe('getEntityNodes', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('returns only character/location/lore nodes', async () => {
    await createNode(null, 'chapter', 'Ch1')
    await createNode(null, 'character', 'Hero')
    await createNode(null, 'location', 'Town')
    await createNode(null, 'lore', 'Magic System')
    await createNode(null, 'note', 'My Note')

    const entities = getEntityNodes()
    expect(entities).toHaveLength(3)
    expect(entities.map((n) => n.type).sort()).toEqual(['character', 'location', 'lore'])
  })

  it('excludes trashed entities', async () => {
    const char = await createNode(null, 'character', 'Hero')
    await moveToTrash(char.id)

    expect(getEntityNodes()).toHaveLength(0)
  })
})

describe('saveProject', () => {
  it('returns success with lastSaved timestamp', async () => {
    await createProject(makeInput())
    const result = await saveProject()
    expect(result.success).toBe(true)
    expect(result.lastSaved).toBeTruthy()
  })

  it('returns failure when no project is open', async () => {
    const result = await saveProject()
    expect(result.success).toBe(false)
  })
})

describe('uiState', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('returns default uiState', () => {
    const state = getUiState()
    expect(state).toBeTruthy()
    expect(state.expandedSections).toBeTruthy()
  })

  it('persists uiState updates', async () => {
    const state = getUiState()
    const updated = await updateUiState({ ...state, selectedContainerId: 'manuscript' })
    expect(updated.selectedContainerId).toBe('manuscript')

    const path = getProjectPath()!
    closeProject()
    const opened = await openProject(path)
    expect(opened.uiState.selectedContainerId).toBe('manuscript')
  })
})

describe('edge cases', () => {
  it('throws on createNode without open project', async () => {
    await expect(createNode(null, 'chapter', 'Ch1')).rejects.toThrow('No project open')
  })

  it('throws on updateNode without open project', async () => {
    await expect(updateNode('fake-id', { title: 'X' })).rejects.toThrow('No project open')
  })

  it('throws on moveToTrash without open project', async () => {
    await expect(moveToTrash('fake-id')).rejects.toThrow('No project open')
  })

  it('handles creating many nodes without collision', async () => {
    await createProject(makeInput())
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const node = await createNode(null, 'chapter', `Ch ${i}`)
      expect(ids.has(node.id)).toBe(false)
      ids.add(node.id)
    }
    expect(getAllNodes()).toHaveLength(50)
  })
})
