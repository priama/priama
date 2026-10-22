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
  deleteProject,
  getEntityNodes,
  saveProject,
  getUiState,
  updateUiState
} from './projectStore'
import type { CategoryDefinition, CreateProjectInput } from '@shared/types'
import { PROJECT_FILENAME } from '@shared/types'
import { getRecoveryDir } from './paths'

vi.mock('../config', () => ({
  addRecentProject: vi.fn().mockResolvedValue(undefined),
  setBackupLocations: vi.fn().mockResolvedValue(undefined),
  updateRecentLastOpened: vi.fn().mockResolvedValue(undefined),
  updateRecentTitle: vi.fn().mockResolvedValue(undefined),
  getBackupLocations: vi.fn().mockResolvedValue([]),
  getConfig: vi.fn().mockResolvedValue({
    preferences: { maxBackupsPerLocation: 10, theme: 'dark', focusMode: false, typewriterScrolling: 'focus', entityHighlights: 'hide-in-focus', editorAppearance: { font: 'Literata', size: 18, leading: 1.625, measure: 80 } },
    recentProjects: []
  })
}))

vi.mock('./backup', () => ({
  createProjectBackup: vi.fn().mockResolvedValue({
    localBackupPath: '/tmp/fake.zip',
    warnings: [],
    unreachablePaths: [],
    kind: 'auto'
  }),
  createAwaitedBackup: vi.fn().mockResolvedValue({
    localBackupPath: '/tmp/fake.zip',
    warnings: [],
    unreachablePaths: [],
    kind: 'auto'
  }),
  queueAutomaticBackupIfNeeded: vi.fn().mockResolvedValue(null),
  toBackupResultPayload: vi.fn((r: { localBackupPath?: string; warnings: unknown[]; unreachablePaths: string[]; kind: string }) => r),
  restoreProjectTomesFromLatestBackup: vi.fn().mockResolvedValue(false),
  AUTOSAVE_BACKUP_GATE_MS: 15 * 60 * 1000,
  EXPLICIT_SAVE_BACKUP_GATE_MS: 60 * 1000
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

  it('seeds simple chapters from an imported manuscript', async () => {
    const result = await createProject(
      makeInput({
        importedChapters: [
          { title: 'Chapter 1', html: '<p>Once upon a time.</p>' },
          { title: 'Chapter 2', html: '<p>The next day.</p>' }
        ]
      })
    )

    const nodes = getAllNodes()
    expect(nodes).toHaveLength(2)
    expect(nodes.map((n) => n.title)).toEqual(['Chapter 1', 'Chapter 2'])
    expect(nodes[0].type).toBe('chapter')
    expect(nodes[0].content).toBe('<p>Once upon a time.</p>')
    expect(nodes[0].metadata).toContain('"structure":"simple"')
    expect(result.meta.title).toBe('Test Project')
    expect(await fse.pathExists(join(result.projectRoot, 'manuscript', 'chapter-01.txd'))).toBe(true)

    closeProject()
    await openProject(result.path)
    const reopened = getAllNodes()
    expect(reopened.map((n) => n.title)).toEqual(['Chapter 1', 'Chapter 2'])
    expect(reopened[1].content).toBe('<p>The next day.</p>')
    expect(getUiState().selectedNodeId).toBe(reopened[0].id)
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

  it('adds the opened project to recents', async () => {
    const { addRecentProject } = await import('../config')
    const created = await createProject(makeInput())
    closeProject()
    vi.mocked(addRecentProject).mockClear()

    await openProject(created.path)

    expect(addRecentProject).toHaveBeenCalledWith({
      id: created.meta.id,
      title: 'Test Project',
      author: 'Test Author',
      primaryPath: created.path
    })
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
      await createProject(makeInput({ title: 'Second', primaryParentDir: secondDir }))
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

function warningTitles(opened: { openWarnings?: { title: string }[] }): string[] {
  return (opened.openWarnings ?? []).map((w) => w.title)
}

function makeTxd(overrides: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  return {
    parentId: null,
    sortOrder: 0,
    content: '',
    metadata: '{}',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

async function reopen(path: string) {
  closeProject()
  return openProject(path)
}

async function readIndex(path: string) {
  return JSON.parse(await fse.readFile(path, 'utf-8'))
}

describe('openProject recovery', () => {
  beforeEach(async () => {
    await createProject(makeInput())
  })

  it('recovers a .txd file not present in the manifest', async () => {
    const root = getProjectRootPath()!
    const orphanId = uuidv4()
    await fse.writeFile(
      join(root, 'manuscript', 'chapter-99.txd'),
      JSON.stringify(makeTxd({ id: orphanId, type: 'chapter', title: 'Orphaned Chapter', content: 'Recovered words' })),
      'utf-8'
    )

    const path = getProjectPath()!
    const opened = await reopen(path)

    const recovered = opened.nodes.find((n) => n.id === orphanId)
    expect(recovered?.content).toBe('Recovered words')
    expect(warningTitles(opened)).toContain('Recovered missing items')

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
    expect(second.nodes.find((n) => n.id === orphanId)?.content).toBe('Recovered words')
  })

  it('drops a broken entry whose file id no longer matches and recovers the real content', async () => {
    const chapter = await createNode(null, 'chapter', 'Ch1')
    await updateNode(chapter.id, { content: 'Original' })

    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const manifestJson = await readIndex(path)
    const entry = manifestJson.index.chapters.find((e: { id: string }) => e.id === chapter.id)

    const replacementId = uuidv4()
    await fse.writeFile(
      join(root, 'manuscript', entry.filename),
      JSON.stringify(
        makeTxd({
          id: replacementId,
          type: 'chapter',
          title: 'Replacement',
          content: 'Replacement content'
        })
      ),
      'utf-8'
    )

    const opened = await reopen(path)

    expect(opened.nodes.find((n) => n.id === chapter.id)).toBeUndefined()
    const recoveredNode = opened.nodes.find((n) => n.id === replacementId)
    expect(recoveredNode?.content).toBe('Replacement content')

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
    expect(second.nodes.find((n) => n.id === replacementId)?.content).toBe('Replacement content')
  })

  it('moves a misplaced .txd into the canonical folder and does not recover again', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const orphanId = uuidv4()
    await fse.ensureDir(join(root, 'wiki', 'notes'))
    await fse.writeFile(
      join(root, 'wiki', 'notes', 'stray-chapter.txd'),
      JSON.stringify(makeTxd({ id: orphanId, type: 'chapter', title: 'Stray', content: 'From notes' })),
      'utf-8'
    )

    const opened = await reopen(path)
    expect(opened.nodes.find((n) => n.id === orphanId)?.content).toBe('From notes')
    expect(warningTitles(opened)).toContain('Recovered missing items')
    expect(await fse.pathExists(join(root, 'wiki', 'notes', 'stray-chapter.txd'))).toBe(false)
    expect(await fse.pathExists(join(root, 'manuscript', 'stray-chapter.txd'))).toBe(true)

    const chapterCount = (await readIndex(path)).index.chapters.filter(
      (e: { id: string }) => e.id === orphanId
    ).length
    expect(chapterCount).toBe(1)

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
    expect((await readIndex(path)).index.chapters.filter((e: { id: string }) => e.id === orphanId)).toHaveLength(1)
  })

  it('updates an existing index row when the file is found in the wrong folder', async () => {
    const chapter = await createNode(null, 'chapter', 'Ch1')
    await updateNode(chapter.id, { content: 'Live' })
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const manifestJson = await readIndex(path)
    const filename = manifestJson.index.chapters.find((e: { id: string }) => e.id === chapter.id).filename

    await fse.ensureDir(join(root, 'wiki', 'notes'))
    await fse.move(join(root, 'manuscript', filename), join(root, 'wiki', 'notes', filename))

    const opened = await reopen(path)
    expect(opened.nodes.find((n) => n.id === chapter.id)?.content).toBe('Live')
    expect(warningTitles(opened)).not.toContain('Recovered missing items')
    expect(await fse.pathExists(join(root, 'manuscript', filename))).toBe(true)
    expect((await readIndex(path)).index.chapters.filter((e: { id: string }) => e.id === chapter.id)).toHaveLength(1)

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('quarantines a duplicate-id extra file instead of indexing it twice', async () => {
    const chapter = await createNode(null, 'chapter', 'Ch1')
    await updateNode(chapter.id, { content: 'Canonical' })
    const root = getProjectRootPath()!
    const path = getProjectPath()!

    await fse.ensureDir(join(root, 'wiki', 'notes'))
    await fse.writeFile(
      join(root, 'wiki', 'notes', 'copy.txd'),
      JSON.stringify(
        makeTxd({
          id: chapter.id,
          type: 'chapter',
          title: 'Copy',
          content: 'Duplicate copy'
        })
      ),
      'utf-8'
    )

    const opened = await reopen(path)
    expect(opened.nodes.filter((n) => n.id === chapter.id)).toHaveLength(1)
    expect(opened.nodes.find((n) => n.id === chapter.id)?.content).toBe('Canonical')
    expect(warningTitles(opened)).toContain('Set aside extra files')
    expect(warningTitles(opened)).not.toContain('Recovered missing items')
    expect((await readIndex(path)).index.chapters.filter((e: { id: string }) => e.id === chapter.id)).toHaveLength(1)
    expect(await fse.pathExists(join(root, 'wiki', 'notes', 'copy.txd'))).toBe(false)
    expect(await fse.pathExists(join(getRecoveryDir(root), 'wiki', 'notes', 'copy.txd'))).toBe(true)

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('does not toast when the same folder filename exists in two wiki scopes', async () => {
    const notesFolder = await createFolder('notes', null, 'Capitulo 1')
    const loreFolder = await createFolder('lore', null, 'Humanos')
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const manifest = await readIndex(path)
    const notesEntry = manifest.index.folders.find((e: { id: string }) => e.id === notesFolder.id)
    const loreEntry = manifest.index.folders.find((e: { id: string }) => e.id === loreFolder.id)
    const sharedName = notesEntry.filename
    const loreSrc = join(root, 'wiki', 'lore', 'folders', loreEntry.filename)
    const loreDest = join(root, 'wiki', 'lore', 'folders', sharedName)
    if (loreSrc !== loreDest) {
      await fse.move(loreSrc, loreDest, { overwrite: true })
    }
    loreEntry.filename = sharedName
    delete notesEntry.folderScope
    // Trashed but inside the retention window: a fixed date expires and the purge on
    // open would delete the very entry this test inspects.
    notesEntry.deletedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await fse.writeFile(path, JSON.stringify(manifest, null, 2), 'utf-8')

    const opened = await reopen(path)
    expect(warningTitles(opened)).not.toContain('Recovered missing items')
    expect(opened.nodes.find((n) => n.id === notesFolder.id)?.title).toBe('Capitulo 1')
    expect(opened.nodes.find((n) => n.id === loreFolder.id)?.title).toBe('Humanos')
    const notesAfter = (await readIndex(path)).index.folders.find(
      (e: { id: string }) => e.id === notesFolder.id
    )
    expect(notesAfter.folderScope).toBe('notes')

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('moves a folder out of manuscript/ into manuscript/folders', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const folderId = uuidv4()
    await fse.writeFile(
      join(root, 'manuscript', 'folder-99.txd'),
      JSON.stringify(
        makeTxd({
          id: folderId,
          type: 'folder',
          title: 'Loose folder',
          metadata: JSON.stringify({ scope: 'manuscript' })
        })
      ),
      'utf-8'
    )

    const opened = await reopen(path)
    expect(opened.nodes.find((n) => n.id === folderId)?.title).toBe('Loose folder')
    expect(await fse.pathExists(join(root, 'manuscript', 'folder-99.txd'))).toBe(false)
    expect(await fse.pathExists(join(root, 'manuscript', 'folders', 'folder-99.txd'))).toBe(true)

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('relocates a folder from the entries/folders alias into entry/folders', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const folderId = uuidv4()
    const aliasDir = join(root, 'wiki', 'entries', 'folders')
    await fse.ensureDir(aliasDir)
    await fse.writeFile(
      join(aliasDir, 'folder-07.txd'),
      JSON.stringify(
        makeTxd({
          id: folderId,
          type: 'folder',
          title: 'Alias folder',
          metadata: JSON.stringify({ scope: 'entry' })
        })
      ),
      'utf-8'
    )

    const opened = await reopen(path)
    expect(opened.nodes.find((n) => n.id === folderId)?.title).toBe('Alias folder')
    expect(await fse.pathExists(join(aliasDir, 'folder-07.txd'))).toBe(false)
    expect(await fse.pathExists(join(root, 'wiki', 'entry', 'folders', 'folder-07.txd'))).toBe(true)

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('puts a scene with a missing chapter parent in the trash', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const sceneId = uuidv4()
    await fse.writeFile(
      join(root, 'manuscript', 'scene-01-99.txd'),
      JSON.stringify(
        makeTxd({
          id: sceneId,
          type: 'scene',
          title: 'Orphan scene',
          parentId: uuidv4(),
          content: 'Scene words'
        })
      ),
      'utf-8'
    )

    const opened = await reopen(path)
    const scene = opened.nodes.find((n) => n.id === sceneId)
    expect(scene?.content).toBe('Scene words')
    expect(scene?.deletedAt).toBeTruthy()
    expect(warningTitles(opened)).toContain('Recovered missing items')

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
    expect(second.nodes.find((n) => n.id === sceneId)?.deletedAt).toBeTruthy()
  })

  it('deletes expired trash leftovers instead of re-indexing them', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const expiredId = uuidv4()
    const expiredAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const stray = join(root, 'wiki', 'notes', 'expired.txd')
    await fse.ensureDir(join(root, 'wiki', 'notes'))
    await fse.writeFile(
      stray,
      JSON.stringify(
        makeTxd({
          id: expiredId,
          type: 'chapter',
          title: 'Expired',
          deletedAt: expiredAt
        })
      ),
      'utf-8'
    )

    const opened = await reopen(path)
    expect(opened.nodes.find((n) => n.id === expiredId)).toBeUndefined()
    expect(await fse.pathExists(stray)).toBe(false)
    expect(opened.openWarnings ?? []).toHaveLength(0)

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('quarantines an untyped file in manuscript and stays quiet on reopen', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    await fse.writeFile(
      join(root, 'manuscript', 'mystery.txd'),
      JSON.stringify(makeTxd({ id: uuidv4(), type: 'nope', title: 'Mystery' })),
      'utf-8'
    )

    const opened = await reopen(path)
    expect(await fse.pathExists(join(root, 'manuscript', 'mystery.txd'))).toBe(false)
    expect(warningTitles(opened)).toContain('Set aside extra files')

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('infers note type from wiki/notes when the type field is invalid', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const noteId = uuidv4()
    await fse.ensureDir(join(root, 'wiki', 'notes'))
    await fse.writeFile(
      join(root, 'wiki', 'notes', 'note-99.txd'),
      JSON.stringify(makeTxd({ id: noteId, type: 'nope', title: 'Inferred', content: 'Note body' })),
      'utf-8'
    )

    const opened = await reopen(path)
    const note = opened.nodes.find((n) => n.id === noteId)
    expect(note?.type).toBe('note')
    expect(note?.content).toBe('Note body')
    expect(warningTitles(opened)).toContain('Recovered missing items')

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('does not toast for unreadable .txd files left in place', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    const junk = join(root, 'manuscript', 'junk.txd')
    await fse.writeFile(junk, 'not json', 'utf-8')

    const opened = await reopen(path)
    expect(opened.openWarnings ?? []).toHaveLength(0)
    expect(await fse.pathExists(junk)).toBe(true)

    const second = await reopen(path)
    expect(second.openWarnings ?? []).toHaveLength(0)
  })

  it('skips AppleDouble ._ files', async () => {
    const root = getProjectRootPath()!
    const path = getProjectPath()!
    await fse.writeFile(
      join(root, 'manuscript', '._chapter-01.txd'),
      JSON.stringify(makeTxd({ id: uuidv4(), type: 'chapter', title: 'AppleDouble' })),
      'utf-8'
    )

    const opened = await reopen(path)
    expect(opened.openWarnings ?? []).toHaveLength(0)
    expect(opened.nodes.find((n) => n.title === 'AppleDouble')).toBeUndefined()
  })

  it('has no openWarnings on a normal open', async () => {
    await createNode(null, 'chapter', 'Ch1')
    const path = getProjectPath()!
    const opened = await reopen(path)
    expect(opened.openWarnings ?? []).toHaveLength(0)
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

  it('does not collide filenames across different parents', async () => {
    const folderA = await createFolder('manuscript', null, 'Folder A')
    const folderB = await createFolder('manuscript', null, 'Folder B')
    const chapterA = await createNode(folderA.id, 'chapter', 'Chapter A')
    const chapterB = await createNode(folderB.id, 'chapter', 'Chapter B')
    await updateNode(chapterA.id, { content: 'Content A' })
    await updateNode(chapterB.id, { content: 'Content B' })

    const path = getProjectPath()!
    closeProject()
    const opened = await openProject(path)

    const foundA = opened.nodes.find((n) => n.id === chapterA.id)
    const foundB = opened.nodes.find((n) => n.id === chapterB.id)
    expect(foundA?.content).toBe('Content A')
    expect(foundB?.content).toBe('Content B')
  })

  it('does not reuse a trashed sibling filename for a new node', async () => {
    const ch1 = await createNode(null, 'chapter', 'Ch1')
    await updateNode(ch1.id, { content: 'Original content' })
    await moveToTrash(ch1.id)

    const ch2 = await createNode(null, 'chapter', 'Ch2')
    await updateNode(ch2.id, { content: 'New content' })

    const path = getProjectPath()!
    closeProject()
    const opened = await openProject(path)

    const trashed = opened.nodes.find((n) => n.id === ch1.id)
    const fresh = opened.nodes.find((n) => n.id === ch2.id)
    expect(trashed?.content).toBe('Original content')
    expect(fresh?.content).toBe('New content')
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

  it('saves a complete .txd and leaves no temp file', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    await updateNode(node.id, { content: 'Hello world' })

    const manuscript = join(getProjectRootPath()!, 'manuscript')
    const names = await fse.readdir(manuscript)
    expect(names.filter((name) => name.endsWith('.tmp'))).toEqual([])

    const txdName = names.find((name) => name.endsWith('.txd'))
    expect(txdName).toBeTruthy()
    const raw = await fse.readFile(join(manuscript, txdName!), 'utf-8')
    expect(JSON.parse(raw).content).toBe('Hello world')
  })

  it('throws for nonexistent node', async () => {
    await expect(updateNode('nonexistent', { title: 'X' })).rejects.toThrow('not found')
  })

  it('leaves the project index untouched for body and metadata saves', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    const tomes = getProjectPath()!
    const before = await fse.readFile(tomes, 'utf-8')
    // Atomic writes rename a temp file into place, so any rewrite changes the inode.
    const inodeBefore = (await fse.stat(tomes)).ino

    await updateNode(node.id, { content: '<p>Typing</p>' })
    await updateNode(node.id, { metadata: node.metadata })
    await updateNode(node.id, { title: 'Ch1', sortOrder: node.sortOrder, parentId: null })

    expect((await fse.stat(tomes)).ino).toBe(inodeBefore)
    expect(await fse.readFile(tomes, 'utf-8')).toBe(before)
    expect(getNode(node.id)!.content).toBe('<p>Typing</p>')
  })

  it('rewrites the project index when title, order, or parent change', async () => {
    const folder = await createFolder('manuscript', null, 'Folder')
    const node = await createNode(null, 'chapter', 'Ch1')
    const tomes = getProjectPath()!
    const indexEntry = async (): Promise<{ title: string; sortOrder: number; parentId?: string }> =>
      JSON.parse(await fse.readFile(tomes, 'utf-8')).index.chapters.find(
        (e: { id: string }) => e.id === node.id
      )

    await updateNode(node.id, { title: 'Renamed' })
    expect((await indexEntry()).title).toBe('Renamed')

    await updateNode(node.id, { sortOrder: 7 })
    expect((await indexEntry()).sortOrder).toBe(7)

    await updateNode(node.id, { parentId: folder.id })
    expect((await indexEntry()).parentId).toBe(folder.id)
  })

  it('updates updatedAt timestamp', async () => {
    const node = await createNode(null, 'chapter', 'Ch1')
    const before = node.updatedAt
    await new Promise((r) => setTimeout(r, 10))
    const updated = await updateNode(node.id, { title: 'Ch2' })
    expect(updated.updatedAt).not.toBe(before)
  })

  it('serializes concurrent content and title updates so both persist', async () => {
    const node = await createNode(null, 'note', 'Draft')
    const contentPromise = updateNode(node.id, { content: 'Body text' })
    const titlePromise = updateNode(node.id, { title: 'Final title' })
    await Promise.all([contentPromise, titlePromise])

    const final = getNode(node.id)!
    expect(final.content).toBe('Body text')
    expect(final.title).toBe('Final title')
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
    const newCats: CategoryDefinition[] = [
      {
        id: 'custom',
        name: 'Custom',
        icon: 'Sparkles',
        mode: 'panel',
        sortOrder: 0,
        builtIn: false,
        nodeKind: 'entry'
      }
    ]
    const meta = await updateCategories(newCats)
    const saved = meta.categories.find((c) => c.id === 'custom')
    expect(saved).toBeDefined()
    expect(saved?.mode).toBe('panel')
    expect(saved?.nodeKind).toBe('entry')
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
    const result = await saveProject({ backup: 'none' })
    expect(result.success).toBe(true)
    expect(result.lastSaved).toBeTruthy()
  })

  it('returns success without requiring a zip', async () => {
    await createProject(makeInput())
    const result = await saveProject({ backup: 'autosave' })
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

describe('deleteProject guards', () => {
  it('refuses a directory that is not a Priama project', async () => {
    const stray = join(testDir, 'not-a-project')
    await fse.ensureDir(stray)
    await fse.writeFile(join(stray, 'important.txt'), 'user data', 'utf-8')

    await expect(deleteProject(join(stray, PROJECT_FILENAME))).rejects.toThrow(
      /no readable project file/
    )
    expect(await fse.pathExists(stray)).toBe(true)
  })

  it('refuses when the project id does not match', async () => {
    const created = await createProject(makeInput({ title: 'Guarded' }))

    await expect(deleteProject(created.path, 'some-other-id')).rejects.toThrow(
      /project id does not match/
    )
    expect(await fse.pathExists(created.projectRoot)).toBe(true)
  })

  it('deletes when the id matches', async () => {
    const created = await createProject(makeInput({ title: 'Removable' }))

    await deleteProject(created.path, created.meta.id)
    expect(await fse.pathExists(created.projectRoot)).toBe(false)
  })
})
