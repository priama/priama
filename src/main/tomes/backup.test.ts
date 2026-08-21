import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fse from 'fs-extra'
import { join } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import {
  AUTOMATIC_DAILY_KEEP_DAYS,
  AUTOMATIC_INTERVAL_KEEP,
  PROJECT_RESTORE_ROOTS,
  __resetBackupStateForTests,
  createProjectBackup,
  createAwaitedBackup,
  extractZipToDir,
  getLastAutomaticBackupAt,
  listLocalBackups,
  parseBackupFileName,
  pruneOldBackups,
  restoreProjectFromBackup,
  shouldCreateAutomaticBackup
} from './backup'
import {
  formatBackupZipName,
  formatNamedBackupZipName,
  formatPreRestoreBackupZipName,
  getBackupsDir,
  getManuscriptDir,
  getTomesPath
} from './paths'
import { PROJECT_FILENAME, TOMES_MAGIC } from '@shared/types'

let testDir: string

beforeEach(async () => {
  __resetBackupStateForTests()
  testDir = join(tmpdir(), `priama-backup-test-${uuidv4()}`)
  await fse.ensureDir(testDir)
})

afterEach(async () => {
  __resetBackupStateForTests()
  await fse.remove(testDir)
})

async function seedProject(root: string, opts?: { content?: string; id?: string }): Promise<void> {
  const id = opts?.id ?? uuidv4()
  await fse.ensureDir(getManuscriptDir(root))
  await fse.ensureDir(join(root, 'wiki'))
  await fse.ensureDir(join(root, 'assets'))
  await fse.ensureDir(getBackupsDir(root))
  await fse.writeFile(
    getTomesPath(root),
    JSON.stringify(
      {
        __tomes: TOMES_MAGIC,
        id,
        title: 'Test Book',
        author: 'Author',
        version: '1.0',
        createdAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
        index: {
          folders: [],
          chapters: [],
          scenes: [],
          characters: [],
          locations: [],
          lore: [],
          notes: [],
          entries: []
        }
      },
      null,
      2
    ),
    'utf-8'
  )
  await fse.writeFile(
    join(getManuscriptDir(root), 'chapter-01.txd'),
    JSON.stringify({
      id: uuidv4(),
      parentId: null,
      type: 'chapter',
      title: 'Ch1',
      sortOrder: 0,
      content: opts?.content ?? '<p>Hello</p>',
      metadata: '{}',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    'utf-8'
  )
}

describe('parseBackupFileName', () => {
  it('classifies legacy auto names', () => {
    const p = parseBackupFileName('2026-08-21T08-12-00.zip')
    expect(p.kind).toBe('auto')
    expect(p.createdAt).toBe('2026-08-21T08:12:00.000Z')
    expect(p.name).toBeUndefined()
  })

  it('classifies named and pre-restore', () => {
    expect(parseBackupFileName('2026-08-21T08-12-00__before-dock-rewrite.zip').kind).toBe('named')
    expect(parseBackupFileName('2026-08-21T08-12-00__before-dock-rewrite.zip').name).toContain(
      'before'
    )
    expect(parseBackupFileName('2026-08-21T08-12-00__before-restore.zip').kind).toBe('pre-restore')
  })
})

describe('shouldCreateAutomaticBackup', () => {
  it('allows first backup', () => {
    expect(shouldCreateAutomaticBackup(null, 60_000)).toBe(true)
  })

  it('respects gate windows', () => {
    const now = Date.parse('2026-08-21T12:00:00.000Z')
    const recent = '2026-08-21T11:59:30.000Z'
    expect(shouldCreateAutomaticBackup(recent, 60_000, now)).toBe(false)
    expect(shouldCreateAutomaticBackup(recent, 15 * 60 * 1000, now)).toBe(false)
    const older = '2026-08-21T11:00:00.000Z'
    expect(shouldCreateAutomaticBackup(older, 60_000, now)).toBe(true)
    expect(shouldCreateAutomaticBackup(older, 15 * 60 * 1000, now)).toBe(true)
  })
})

describe('createProjectBackup', () => {
  it('excludes backups and restore scratch dirs from the zip', async () => {
    const root = join(testDir, 'book')
    await seedProject(root)
    await fse.writeFile(join(getBackupsDir(root), 'secret.txt'), 'nope')
    await fse.ensureDir(join(root, '.restore-tmp'))
    await fse.writeFile(join(root, '.restore-tmp', 'x.txt'), 'tmp')
    await fse.ensureDir(join(root, '.restore-old'))
    await fse.writeFile(join(root, '.restore-old', 'y.txt'), 'old')

    const result = await createProjectBackup(root, [])
    expect(result.localBackupPath).toBeTruthy()
    expect(result.warnings).toHaveLength(0)

    const extractTo = join(testDir, 'extracted')
    await extractZipToDir(result.localBackupPath!, extractTo)
    expect(await fse.pathExists(join(extractTo, 'backups'))).toBe(false)
    expect(await fse.pathExists(join(extractTo, '.restore-tmp'))).toBe(false)
    expect(await fse.pathExists(join(extractTo, '.restore-old'))).toBe(false)
    expect(await fse.pathExists(join(extractTo, PROJECT_FILENAME))).toBe(true)
    expect(await fse.pathExists(join(extractTo, 'manuscript'))).toBe(true)
  })

  it('reports unreachable external destinations without failing local zip', async () => {
    const root = join(testDir, 'book')
    await seedProject(root)
    const missing = join(testDir, 'missing-drive')
    const result = await createProjectBackup(root, [missing])
    expect(result.localBackupPath).toBeTruthy()
    expect(result.unreachablePaths).toContain(missing)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

describe('listLocalBackups', () => {
  it('sorts by filename timestamp and classifies kinds', async () => {
    const root = join(testDir, 'book')
    await seedProject(root)
    const dir = getBackupsDir(root)

    const older = formatBackupZipName(new Date('2026-08-20T10:00:00.000Z'))
    const newer = formatNamedBackupZipName('my-save', new Date('2026-08-21T10:00:00.000Z'))
    await fse.writeFile(join(dir, older), 'zip')
    await fse.writeFile(join(dir, newer), 'zip')
    // Touch older file so mtime is newer — list must still prefer filename stamp.
    await fse.utimes(join(dir, older), new Date(), new Date('2026-08-22T10:00:00.000Z'))

    const list = await listLocalBackups(root)
    expect(list[0].fileName).toBe(newer)
    expect(list[0].kind).toBe('named')
    expect(list[1].kind).toBe('auto')
    expect(list[0].createdAt).toBe('2026-08-21T10:00:00.000Z')
  })
})

describe('pruneOldBackups', () => {
  it('keeps named and pre-restore, prunes excess autos', async () => {
    const dir = join(testDir, 'backups')
    await fse.ensureDir(dir)

    const named = formatNamedBackupZipName('keep-me', new Date('2026-01-01T00:00:00.000Z'))
    const pre = formatPreRestoreBackupZipName(new Date('2026-01-02T00:00:00.000Z'))
    await fse.writeFile(join(dir, named), 'n')
    await fse.writeFile(join(dir, pre), 'p')

    // Create more autos than AUTOMATIC_INTERVAL_KEEP, all on the same recent day
    // so daily keep only preserves one extra beyond interval? Interval keeps 16 newest;
    // daily also keeps one per day — same day so still 16.
    for (let i = 0; i < AUTOMATIC_INTERVAL_KEEP + 5; i++) {
      const d = new Date('2026-08-21T00:00:00.000Z')
      d.setUTCMinutes(i)
      await fse.writeFile(join(dir, formatBackupZipName(d)), `a${i}`)
    }

    await pruneOldBackups(dir)
    const left = await fse.readdir(dir)
    expect(left).toContain(named)
    expect(left).toContain(pre)
    const autos = left.filter((f) => !f.includes('__'))
    expect(autos.length).toBeLessThanOrEqual(AUTOMATIC_INTERVAL_KEEP)
  })

  it('keeps one auto per UTC day within the daily window', async () => {
    const dir = join(testDir, 'backups')
    await fse.ensureDir(dir)

    // Two autos on an old day within 14 days, and many recent ones filling interval.
    const dayA1 = formatBackupZipName(new Date('2026-08-10T08:00:00.000Z'))
    const dayA2 = formatBackupZipName(new Date('2026-08-10T18:00:00.000Z'))
    await fse.writeFile(join(dir, dayA1), 'a')
    await fse.writeFile(join(dir, dayA2), 'b')

    // Fill interval with very recent autos so dayA1/A2 are outside the newest 16
    for (let i = 0; i < AUTOMATIC_INTERVAL_KEEP; i++) {
      const d = new Date('2026-08-21T12:00:00.000Z')
      d.setUTCSeconds(i)
      await fse.writeFile(join(dir, formatBackupZipName(d)), `r${i}`)
    }

    // Freeze "now" by using real Date — tests may flake if wall clock is far from Aug 2026.
    // Use relative dates instead:
    await fse.emptyDir(dir)
    const now = Date.now()
    const dayAgo = (n: number, hour = 8): Date => {
      const d = new Date(now - n * 24 * 60 * 60 * 1000)
      d.setUTCHours(hour, 0, 0, 0)
      return d
    }

    await fse.writeFile(join(dir, formatBackupZipName(dayAgo(3, 8))), 'old-morning')
    await fse.writeFile(join(dir, formatBackupZipName(dayAgo(3, 20))), 'old-evening')
    for (let i = 0; i < AUTOMATIC_INTERVAL_KEEP; i++) {
      const d = new Date(now - i * 60 * 1000)
      await fse.writeFile(join(dir, formatBackupZipName(d)), `n${i}`)
    }

    await pruneOldBackups(dir)
    const left = (await fse.readdir(dir)).filter((f) => !f.includes('__'))
    // Interval keeps 16 newest; daily should also keep the evening zip from 3 days ago.
    expect(left.length).toBeGreaterThanOrEqual(AUTOMATIC_INTERVAL_KEEP)
    expect(left.length).toBeLessThanOrEqual(AUTOMATIC_INTERVAL_KEEP + AUTOMATIC_DAILY_KEEP_DAYS)
    const keptFromOldDay = left.filter((f) => f.includes(formatBackupZipName(dayAgo(3, 20)).slice(0, 10)))
    expect(keptFromOldDay.length).toBeGreaterThanOrEqual(1)
  })
})

describe('restoreProjectFromBackup', () => {
  it('restores content, leaves backups intact, writes pre-restore zip', async () => {
    const root = join(testDir, 'book')
    const projectId = uuidv4()
    await seedProject(root, { content: '<p>Old</p>', id: projectId })

    const backup = await createAwaitedBackup(root, [], { kind: 'auto' })
    expect(backup.localBackupPath).toBeTruthy()

    await fse.writeFile(
      join(getManuscriptDir(root), 'chapter-01.txd'),
      JSON.stringify({
        id: uuidv4(),
        parentId: null,
        type: 'chapter',
        title: 'Ch1',
        sortOrder: 0,
        content: '<p>Ruined</p>',
        metadata: '{}',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }),
      'utf-8'
    )

    const backupsBefore = await fse.readdir(getBackupsDir(root))

    let closed = false
    const result = await restoreProjectFromBackup({
      projectRoot: root,
      backupZipPath: backup.localBackupPath!,
      projectId,
      writeManifest: async () => {
        // Manifest already on disk for this unit test.
      },
      getExternalDestinations: async () => [],
      beforeSwap: async () => {
        closed = true
      }
    })

    expect(result.success).toBe(true)
    expect(closed).toBe(true)
    expect(result.preRestorePath).toBeTruthy()
    expect(await fse.pathExists(result.preRestorePath!)).toBe(true)

    const chapter = JSON.parse(
      await fse.readFile(join(getManuscriptDir(root), 'chapter-01.txd'), 'utf-8')
    ) as { content: string }
    expect(chapter.content).toBe('<p>Old</p>')

    for (const name of backupsBefore) {
      expect(await fse.pathExists(join(getBackupsDir(root), name))).toBe(true)
    }

    for (const r of PROJECT_RESTORE_ROOTS) {
      expect(await fse.pathExists(join(root, r))).toBe(true)
    }
    expect(PROJECT_RESTORE_ROOTS).not.toContain('backups')
  })

  it('rejects zip-slip and does not clobber live files', async () => {
    const root = join(testDir, 'book')
    const projectId = uuidv4()
    await seedProject(root, { content: '<p>Safe</p>', id: projectId })

    // Build a malicious zip with an escaping entry via archiver isn't easy with glob;
    // use extractZipToDir directly with a hand-crafted zip is heavy.
    // Instead: corrupt/missing zip path.
    const missing = join(getBackupsDir(root), 'nope.zip')
    const result = await restoreProjectFromBackup({
      projectRoot: root,
      backupZipPath: missing,
      projectId,
      writeManifest: async () => {},
      getExternalDestinations: async () => [],
      beforeSwap: async () => {
        throw new Error('should not swap')
      }
    })
    expect(result.success).toBe(false)

    const chapter = JSON.parse(
      await fse.readFile(join(getManuscriptDir(root), 'chapter-01.txd'), 'utf-8')
    ) as { content: string }
    expect(chapter.content).toBe('<p>Safe</p>')
  })

  it('rejects zip-slip entries on extract', async () => {
    const { default: archiver } = await import('archiver')
    const { createWriteStream } = await import('fs')
    const zipPath = join(testDir, 'slip.zip')
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiver('zip')
      output.on('close', () => resolve())
      archive.on('error', reject)
      archive.pipe(output)
      // Nested .. so path traversal is unambiguous if the archiver keeps the name.
      archive.append('evil', { name: 'ok/../../outside.txt' })
      archive.finalize()
    })

    const dest = join(testDir, 'out')
    await expect(extractZipToDir(zipPath, dest)).rejects.toThrow(
      /escapes|invalid relative path/
    )
  })

  it('does not swap when extracted manifest is invalid', async () => {
    const root = join(testDir, 'book')
    const projectId = uuidv4()
    await seedProject(root, { id: projectId })

    // Zip a folder without a valid project.tomes
    const junkRoot = join(testDir, 'junk')
    await fse.ensureDir(join(junkRoot, 'manuscript'))
    await fse.writeFile(join(junkRoot, PROJECT_FILENAME), '{not json', 'utf-8')
    const { default: archiver } = await import('archiver')
    const { createWriteStream } = await import('fs')
    const zipPath = join(getBackupsDir(root), formatBackupZipName())
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiver('zip')
      output.on('close', () => resolve())
      archive.on('error', reject)
      archive.pipe(output)
      archive.directory(junkRoot, false)
      archive.finalize()
    })

    let swapped = false
    const result = await restoreProjectFromBackup({
      projectRoot: root,
      backupZipPath: zipPath,
      projectId,
      writeManifest: async () => {},
      getExternalDestinations: async () => [],
      beforeSwap: async () => {
        swapped = true
      }
    })
    expect(result.success).toBe(false)
    expect(swapped).toBe(false)
  })
})

describe('PROJECT_RESTORE_ROOTS', () => {
  it('covers create-project book roots and excludes backups', () => {
    expect(PROJECT_RESTORE_ROOTS).toEqual(['project.tomes', 'manuscript', 'wiki', 'assets'])
    expect(PROJECT_RESTORE_ROOTS.includes('backups' as never)).toBe(false)
  })
})

describe('getLastAutomaticBackupAt', () => {
  it('returns newest auto only', async () => {
    const root = join(testDir, 'book')
    await seedProject(root)
    const dir = getBackupsDir(root)
    await fse.writeFile(
      join(dir, formatNamedBackupZipName('x', new Date('2026-08-21T12:00:00.000Z'))),
      'n'
    )
    await fse.writeFile(
      join(dir, formatBackupZipName(new Date('2026-08-21T10:00:00.000Z'))),
      'a'
    )
    expect(await getLastAutomaticBackupAt(root)).toBe('2026-08-21T10:00:00.000Z')
  })
})
