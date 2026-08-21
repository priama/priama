import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { join, resolve, relative, sep } from 'path'
import fse from 'fs-extra'
import archiver from 'archiver'
import yauzl from 'yauzl'
import type {
  BackupKind,
  BackupLocationStatus,
  BackupRecord,
  BackupResultPayload,
  BackupStatus,
  BackupWarning,
  BackupDestinationStatus
} from '@shared/types'
import { PROJECT_FILENAME, TOMES_MAGIC } from '@shared/types'
import {
  detectPathLabel,
  formatBackupZipName,
  formatNamedBackupZipName,
  formatPreRestoreBackupZipName,
  getAssetsDir,
  getBackupsDir,
  getManuscriptDir,
  getProjectFolderName,
  getTomesPath,
  getWikiDir
} from './paths'
import { getBackupLocations } from '../config'

const PROJECT_TOMES_ENTRY = 'project.tomes'

/** How many of the most recent automatic interval zips to keep (per location). */
export const AUTOMATIC_INTERVAL_KEEP = 16

/**
 * Keep one automatic zip per UTC calendar day for this many days.
 * Buckets use the filename stamp (UTC), matching createdAt — not local wall time.
 */
export const AUTOMATIC_DAILY_KEEP_DAYS = 14

export const AUTOSAVE_BACKUP_GATE_MS = 15 * 60 * 1000
export const EXPLICIT_SAVE_BACKUP_GATE_MS = 60 * 1000

/**
 * Project-root entries restored by whole-project restore.
 * Any new book root must be added here, to createProject, and to backup tests.
 * Never includes `backups/`.
 */
export const PROJECT_RESTORE_ROOTS = [
  PROJECT_FILENAME,
  'manuscript',
  'wiki',
  'assets'
] as const

const ZIP_EXCLUDE_DIRS = ['backups', '.restore-tmp', '.restore-old']

const ISO_STAMP_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})(?:__(.+))?\.zip$/i

export interface BackupResult {
  localBackupPath?: string
  warnings: BackupWarning[]
  unreachablePaths: string[]
  kind: BackupKind
}

export type BackupTrigger = 'autosave' | 'explicit' | 'force' | 'named' | 'pre-restore'

interface ParsedBackupName {
  stamp: string
  createdAt: string | null
  kind: BackupKind
  name?: string
}

let zipInFlight: Promise<BackupResult> | null = null
let pendingAutoRequest: { projectRoot: string; externalDests: string[]; gateMs: number } | null =
  null

const lastExternalCopyAt = new Map<string, string>()

export function parseBackupFileName(fileName: string): ParsedBackupName {
  const match = fileName.match(ISO_STAMP_RE)
  if (!match) {
    return { stamp: '', createdAt: null, kind: 'auto' }
  }

  const stamp = match[1]
  const slug = match[2]
  const createdAt = stampToIso(stamp)

  if (!slug) {
    return { stamp, createdAt, kind: 'auto' }
  }
  if (slug === 'before-restore') {
    return { stamp, createdAt, kind: 'pre-restore', name: 'Before restore' }
  }
  return {
    stamp,
    createdAt,
    kind: 'named',
    name: slug.replace(/-/g, ' ')
  }
}

function stampToIso(stamp: string): string | null {
  // stamp: 2026-08-21T08-12-00 → 2026-08-21T08:12:00.000Z
  const m = stamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.000Z`
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : iso
}

function utcDayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function shouldCreateAutomaticBackup(
  lastAutomaticCreatedAt: string | null,
  gateMs: number,
  now = Date.now()
): boolean {
  if (!lastAutomaticCreatedAt) return true
  const last = Date.parse(lastAutomaticCreatedAt)
  if (Number.isNaN(last)) return true
  return now - last >= gateMs
}

async function extractProjectTomesFromZip(zipPath: string, destPath: string): Promise<boolean> {
  const zipfile = await new Promise<yauzl.ZipFile>((resolveZip, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, file) => {
      if (err || !file) reject(err ?? new Error('Failed to open backup archive'))
      else resolveZip(file)
    })
  })

  try {
    const entry = await new Promise<yauzl.Entry | null>((resolveEntry, reject) => {
      const onEntry = (e: yauzl.Entry): void => {
        if (e.fileName === PROJECT_TOMES_ENTRY) {
          zipfile.removeListener('entry', onEntry)
          zipfile.removeListener('end', onEnd)
          resolveEntry(e)
          return
        }
        zipfile.readEntry()
      }
      const onEnd = (): void => {
        zipfile.removeListener('entry', onEntry)
        resolveEntry(null)
      }
      zipfile.on('entry', onEntry)
      zipfile.on('end', onEnd)
      zipfile.on('error', reject)
      zipfile.readEntry()
    })

    if (!entry) return false

    const readStream = await new Promise<NodeJS.ReadableStream>((resolveStream, reject) => {
      zipfile.openReadStream(entry, (err, stream) => {
        if (err || !stream) reject(err ?? new Error('Failed to read project file from backup'))
        else resolveStream(stream)
      })
    })

    const tempPath = `${destPath}.${process.pid}.tmp`
    await pipeline(readStream, createWriteStream(tempPath))
    await fse.rename(tempPath, destPath)
    return true
  } finally {
    zipfile.close()
  }
}

export async function restoreProjectTomesFromLatestBackup(projectRoot: string): Promise<boolean> {
  const backups = await listLocalBackups(projectRoot)
  for (const backup of backups) {
    try {
      if (await extractProjectTomesFromZip(backup.path, getTomesPath(projectRoot))) {
        return true
      }
    } catch {
      // Try the next backup if this archive is unreadable.
    }
  }
  return false
}

async function checkPathReachable(targetPath: string): Promise<BackupLocationStatus> {
  const label = detectPathLabel(targetPath)
  try {
    if (!(await fse.pathExists(targetPath))) {
      return { path: targetPath, reachable: false, writable: false, label }
    }
    await fse.access(targetPath, fse.constants.W_OK)
    return { path: targetPath, reachable: true, writable: true, label }
  } catch {
    return { path: targetPath, reachable: false, writable: false, label }
  }
}

export async function checkBackupLocations(paths: string[]): Promise<BackupLocationStatus[]> {
  return Promise.all(paths.map(checkPathReachable))
}

async function createZipArchive(sourceDir: string, destZipPath: string): Promise<void> {
  await fse.ensureDir(join(destZipPath, '..'))
  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(destZipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', () => resolvePromise())
    archive.on('error', reject)

    archive.pipe(output)
    archive.glob('**/*', {
      cwd: sourceDir,
      ignore: ZIP_EXCLUDE_DIRS.flatMap((d) => [`${d}/**`, d])
    })
    archive.finalize()
  })
}

/**
 * Prune automatic zips only. Named and pre-restore archives are never deleted.
 * Retention: keep AUTOMATIC_INTERVAL_KEEP newest autos, plus one auto per UTC day
 * for the last AUTOMATIC_DAILY_KEEP_DAYS days (newest that day). Bucket by filename stamp.
 */
export async function pruneOldBackups(backupDir: string): Promise<void> {
  if (!(await fse.pathExists(backupDir))) return

  const files = (await fse.readdir(backupDir)).filter((f) => f.endsWith('.zip'))
  const records: { path: string; fileName: string; createdAt: string; kind: BackupKind }[] = []

  for (const fileName of files) {
    const fullPath = join(backupDir, fileName)
    const parsed = parseBackupFileName(fileName)
    let createdAt = parsed.createdAt
    if (!createdAt) {
      try {
        createdAt = (await fse.stat(fullPath)).mtime.toISOString()
      } catch {
        continue
      }
    }
    records.push({ path: fullPath, fileName, createdAt, kind: parsed.kind })
  }

  const autos = records
    .filter((r) => r.kind === 'auto')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  const keep = new Set<string>()

  for (const r of autos.slice(0, AUTOMATIC_INTERVAL_KEEP)) {
    keep.add(r.path)
  }

  const now = Date.now()
  const dayKeepCutoff = now - AUTOMATIC_DAILY_KEEP_DAYS * 24 * 60 * 60 * 1000
  const bestByDay = new Map<string, (typeof autos)[0]>()

  for (const r of autos) {
    const t = Date.parse(r.createdAt)
    if (Number.isNaN(t) || t < dayKeepCutoff) continue
    const day = utcDayKey(r.createdAt)
    const existing = bestByDay.get(day)
    if (!existing || Date.parse(r.createdAt) > Date.parse(existing.createdAt)) {
      bestByDay.set(day, r)
    }
  }
  for (const r of bestByDay.values()) {
    keep.add(r.path)
  }

  for (const r of autos) {
    if (!keep.has(r.path)) {
      await fse.remove(r.path).catch(() => {})
    }
  }
}

function friendlyErrorDetail(err: unknown): string {
  if (!(err instanceof Error)) return 'Something went wrong while writing the backup file.'
  const code = (err as NodeJS.ErrnoException).code
  if (code === 'ENOSPC') return 'The disk appears to be full.'
  if (code === 'EACCES' || code === 'EPERM') {
    return 'Permission was denied writing to the backups folder.'
  }
  if (code === 'ENOENT') return 'The backups folder could not be found or created.'
  if (err.message?.trim()) return err.message.trim()
  return 'Something went wrong while writing the backup file.'
}

function zipNameForKind(kind: BackupKind, name?: string): string {
  if (kind === 'pre-restore') return formatPreRestoreBackupZipName()
  if (kind === 'named' && name?.trim()) return formatNamedBackupZipName(name)
  return formatBackupZipName()
}

export async function createProjectBackup(
  projectRoot: string,
  externalDestinations: string[],
  options?: { kind?: BackupKind; name?: string }
): Promise<BackupResult> {
  const kind: BackupKind = options?.kind ?? 'auto'
  const warnings: BackupWarning[] = []
  const unreachablePaths: string[] = []

  const zipName = zipNameForKind(kind, options?.name)
  const localBackupDir = getBackupsDir(projectRoot)
  await fse.ensureDir(localBackupDir)

  const tempZip = join(localBackupDir, zipName)

  try {
    await createZipArchive(projectRoot, tempZip)
    await pruneOldBackups(localBackupDir)
  } catch (err) {
    warnings.push({
      path: localBackupDir,
      title: "Couldn't create local backup",
      message: `Your project may still be saved, but a zip could not be written to the project's backups folder. ${friendlyErrorDetail(err)}`
    })
    return { warnings, unreachablePaths, kind }
  }

  const folderName = getProjectFolderName(projectRoot)
  const copiedAt = new Date().toISOString()

  for (const dest of externalDestinations) {
    const status = await checkPathReachable(dest)
    const destLabel = status.label || dest
    if (!status.reachable || !status.writable) {
      unreachablePaths.push(dest)
      warnings.push({
        path: dest,
        title: 'Backup location unavailable',
        message: `Couldn't reach "${destLabel}". Connect that drive or folder to keep off-machine copies in sync.`
      })
      continue
    }

    const destDir = join(dest, folderName)
    try {
      await fse.ensureDir(destDir)
      const destZip = join(destDir, zipName)
      const destTmp = destZip + '.tmp'
      await fse.copy(tempZip, destTmp)
      await fse.rename(destTmp, destZip)
      await pruneOldBackups(destDir)
      lastExternalCopyAt.set(dest, copiedAt)
    } catch {
      unreachablePaths.push(dest)
      warnings.push({
        path: dest,
        title: 'Backup location unavailable',
        message: `Couldn't copy the backup to "${destLabel}". Check that the drive is connected and writable.`
      })
    }
  }

  return {
    localBackupPath: tempZip,
    warnings,
    unreachablePaths,
    kind
  }
}

export async function listLocalBackups(projectRoot: string): Promise<BackupRecord[]> {
  const backupDir = getBackupsDir(projectRoot)
  if (!(await fse.pathExists(backupDir))) return []

  const files = (await fse.readdir(backupDir)).filter((f) => f.endsWith('.zip'))
  const result: BackupRecord[] = []

  for (const fileName of files) {
    const fullPath = join(backupDir, fileName)
    try {
      const stat = await fse.stat(fullPath)
      const parsed = parseBackupFileName(fileName)
      result.push({
        path: fullPath,
        fileName,
        createdAt:
          parsed.createdAt && !Number.isNaN(Date.parse(parsed.createdAt))
            ? parsed.createdAt
            : stat.mtime.toISOString(),
        sizeBytes: stat.size,
        kind: parsed.kind,
        ...(parsed.name ? { name: parsed.name } : {})
      })
    } catch {
      // Skip unreadable entries.
    }
  }

  return result.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function getLastAutomaticBackupAt(projectRoot: string): Promise<string | null> {
  const list = await listLocalBackups(projectRoot)
  const auto = list.find((b) => b.kind === 'auto')
  return auto?.createdAt ?? null
}

export function isZipInFlight(): boolean {
  return zipInFlight !== null
}

async function runExclusiveZip(job: () => Promise<BackupResult>): Promise<BackupResult> {
  while (zipInFlight) {
    try {
      await zipInFlight
    } catch {
      // Previous job failed; still clear and continue.
    }
  }

  const promise = job().finally(() => {
    if (zipInFlight === promise) zipInFlight = null
  })
  zipInFlight = promise
  return promise
}

/**
 * Decide whether to zip after a content save. Queues automatic zips when the gate passes.
 * Returns null when skipped; otherwise the in-flight promise (caller may not await).
 */
export async function queueAutomaticBackupIfNeeded(
  projectRoot: string,
  externalDestinations: string[],
  gateMs: number,
  onComplete: (result: BackupResult) => void
): Promise<Promise<BackupResult> | null> {
  const lastAuto = await getLastAutomaticBackupAt(projectRoot)
  if (!shouldCreateAutomaticBackup(lastAuto, gateMs)) {
    return null
  }

  if (zipInFlight) {
    pendingAutoRequest = { projectRoot, externalDests: externalDestinations, gateMs }
    return zipInFlight
  }

  const promise = runExclusiveZip(() =>
    createProjectBackup(projectRoot, externalDestinations, { kind: 'auto' })
  ).then(async (result) => {
    if (result.localBackupPath || result.warnings.length > 0) {
      onComplete(result)
    }
    if (pendingAutoRequest) {
      const next = pendingAutoRequest
      pendingAutoRequest = null
      const nextLast = await getLastAutomaticBackupAt(next.projectRoot)
      if (shouldCreateAutomaticBackup(nextLast, next.gateMs)) {
        void runExclusiveZip(() =>
          createProjectBackup(next.projectRoot, next.externalDests, { kind: 'auto' })
        ).then((r) => {
          if (r.localBackupPath || r.warnings.length > 0) onComplete(r)
        })
      }
    }
    return result
  })

  return promise
}

export async function createAwaitedBackup(
  projectRoot: string,
  externalDestinations: string[],
  options?: { kind?: BackupKind; name?: string }
): Promise<BackupResult> {
  return runExclusiveZip(() =>
    createProjectBackup(projectRoot, externalDestinations, options)
  )
}

export function toBackupResultPayload(result: BackupResult): BackupResultPayload {
  return {
    localBackupPath: result.localBackupPath,
    warnings: result.warnings,
    unreachablePaths: result.unreachablePaths,
    kind: result.kind
  }
}

export async function getBackupStatus(
  projectRoot: string,
  projectId: string
): Promise<BackupStatus> {
  const local = await listLocalBackups(projectRoot)
  const destPaths = await getBackupLocations(projectId)
  const statuses = await checkBackupLocations(destPaths)
  const destinations: BackupDestinationStatus[] = statuses.map((s) => ({
    ...s,
    ...(lastExternalCopyAt.has(s.path)
      ? { lastSuccessfulCopyAt: lastExternalCopyAt.get(s.path) }
      : {})
  }))

  const lastLocal = local[0]?.createdAt ?? null
  let lastExternal: string | null = null
  for (const d of destinations) {
    if (d.lastSuccessfulCopyAt) {
      if (!lastExternal || Date.parse(d.lastSuccessfulCopyAt) > Date.parse(lastExternal)) {
        lastExternal = d.lastSuccessfulCopyAt
      }
    }
  }

  return {
    local,
    destinations,
    lastLocalBackupAt: lastLocal,
    lastExternalCopyAt: lastExternal,
    inFlight: isZipInFlight()
  }
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith('..'))
}

/**
 * Extract a zip into destDir. Rejects zip-slip. Skips `backups/` entries.
 */
export async function extractZipToDir(zipPath: string, destDir: string): Promise<void> {
  await fse.emptyDir(destDir)

  const zipfile = await new Promise<yauzl.ZipFile>((resolveZip, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, file) => {
      if (err || !file) reject(err ?? new Error('Failed to open backup archive'))
      else resolveZip(file)
    })
  })

  try {
    await new Promise<void>((resolveDone, reject) => {
      let settled = false
      const fail = (err: unknown): void => {
        if (settled) return
        settled = true
        reject(err instanceof Error ? err : new Error(String(err)))
      }
      const succeed = (): void => {
        if (settled) return
        settled = true
        resolveDone()
      }

      zipfile.on('error', fail)
      zipfile.on('end', () => succeed())
      zipfile.on('entry', (entry: yauzl.Entry) => {
        void (async () => {
          try {
            const name = entry.fileName.replace(/\\/g, '/')
            if (
              name === 'backups' ||
              name.startsWith('backups/') ||
              name.includes('/backups/')
            ) {
              zipfile.readEntry()
              return
            }

            // Reject absolute paths and any segment that escapes via ..
            if (name.startsWith('/') || name.split('/').includes('..')) {
              fail(new Error(`Zip entry escapes destination: ${entry.fileName}`))
              return
            }

            if (/\/$/.test(name)) {
              const dirPath = join(destDir, name)
              if (!isPathInside(destDir, dirPath)) {
                fail(new Error(`Zip entry escapes destination: ${entry.fileName}`))
                return
              }
              await fse.ensureDir(dirPath)
              zipfile.readEntry()
              return
            }

            const outPath = join(destDir, name)
            if (!isPathInside(destDir, outPath)) {
              fail(new Error(`Zip entry escapes destination: ${entry.fileName}`))
              return
            }

            await fse.ensureDir(join(outPath, '..'))
            const readStream = await new Promise<NodeJS.ReadableStream>((res, rej) => {
              zipfile.openReadStream(entry, (err, stream) => {
                if (err || !stream) rej(err ?? new Error('Failed to read zip entry'))
                else res(stream)
              })
            })
            await pipeline(readStream, createWriteStream(outPath))
            zipfile.readEntry()
          } catch (err) {
            fail(err)
          }
        })()
      })
      zipfile.readEntry()
    })
  } finally {
    try {
      zipfile.close()
    } catch {
      // ignore
    }
  }
}

async function validateExtractedManifest(
  tmpRoot: string,
  expectedProjectId?: string
): Promise<{ ok: true; title: string; id: string } | { ok: false; message: string }> {
  const tomesPath = join(tmpRoot, PROJECT_FILENAME)
  if (!(await fse.pathExists(tomesPath))) {
    return { ok: false, message: 'Backup is missing project.tomes' }
  }
  try {
    const raw = await fse.readFile(tomesPath, 'utf-8')
    const manifest = JSON.parse(raw) as {
      __tomes?: string
      id?: string
      title?: string
    }
    if (manifest.__tomes !== TOMES_MAGIC) {
      return { ok: false, message: 'Backup is not a valid Priama project' }
    }
    if (!manifest.id || !manifest.title) {
      return { ok: false, message: 'Backup project file is missing required fields' }
    }
    if (expectedProjectId && manifest.id !== expectedProjectId) {
      return {
        ok: false,
        message: 'This backup belongs to a different project and cannot be restored here'
      }
    }
    return { ok: true, title: manifest.title, id: manifest.id }
  } catch {
    return { ok: false, message: 'Backup project file is corrupted or invalid JSON' }
  }
}

async function swapRestoreRoots(projectRoot: string, tmpRoot: string): Promise<void> {
  const oldRoot = join(projectRoot, '.restore-old')
  await fse.remove(oldRoot).catch(() => {})
  await fse.ensureDir(oldRoot)

  const movedAside: string[] = []

  try {
    for (const root of PROJECT_RESTORE_ROOTS) {
      const live = join(projectRoot, root)
      const fromTmp = join(tmpRoot, root)
      const aside = join(oldRoot, root)

      if (await fse.pathExists(live)) {
        await fse.move(live, aside, { overwrite: true })
        movedAside.push(root)
      }

      if (await fse.pathExists(fromTmp)) {
        await fse.move(fromTmp, live, { overwrite: true })
      } else if (root === PROJECT_FILENAME) {
        throw new Error('Extracted backup is missing project.tomes')
      } else {
        // Directory missing in backup — recreate empty so layout stays valid.
        if (root === 'manuscript') await fse.ensureDir(getManuscriptDir(projectRoot))
        else if (root === 'wiki') await fse.ensureDir(getWikiDir(projectRoot))
        else if (root === 'assets') await fse.ensureDir(getAssetsDir(projectRoot))
      }
    }

    await fse.remove(oldRoot).catch(() => {})
    await fse.remove(tmpRoot).catch(() => {})
  } catch (err) {
    // Roll back whatever we moved aside.
    for (const root of movedAside.reverse()) {
      const live = join(projectRoot, root)
      const aside = join(oldRoot, root)
      if (await fse.pathExists(aside)) {
        await fse.remove(live).catch(() => {})
        await fse.move(aside, live, { overwrite: true }).catch(() => {})
      }
    }
    throw err
  }
}

export interface RestoreProjectOptions {
  projectRoot: string
  backupZipPath: string
  projectId: string
  /** Called after pre-restore zip + extract/validate, before swap — release handles. */
  beforeSwap: () => Promise<void>
  /** Write current manifest before pre-restore zip. */
  writeManifest: () => Promise<void>
  getExternalDestinations: () => Promise<string[]>
}

/**
 * Whole-project restore. Caller must flush editor content first.
 * Sequence: writeManifest → pre-restore zip → extract/validate → beforeSwap → swap → cleanup.
 */
export async function restoreProjectFromBackup(
  options: RestoreProjectOptions
): Promise<{ success: boolean; message?: string; preRestorePath?: string }> {
  const { projectRoot, backupZipPath, projectId, beforeSwap, writeManifest, getExternalDestinations } =
    options

  if (!(await fse.pathExists(backupZipPath))) {
    return { success: false, message: 'Backup file not found' }
  }

  const resolvedBackup = resolve(backupZipPath)
  const backupsDir = resolve(getBackupsDir(projectRoot))
  if (!isPathInside(backupsDir, resolvedBackup)) {
    return { success: false, message: 'Backup is not in this project’s backups folder' }
  }

  await writeManifest()

  const externalDests = await getExternalDestinations()
  let preRestorePath: string | undefined
  try {
    const pre = await createAwaitedBackup(projectRoot, externalDests, { kind: 'pre-restore' })
    preRestorePath = pre.localBackupPath
    if (!pre.localBackupPath) {
      return {
        success: false,
        message: pre.warnings[0]?.message ?? 'Could not create a before-restore backup'
      }
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Could not create a before-restore backup'
    }
  }

  const tmpRoot = join(projectRoot, '.restore-tmp')
  try {
    await extractZipToDir(resolvedBackup, tmpRoot)
  } catch (err) {
    await fse.remove(tmpRoot).catch(() => {})
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Could not read the backup archive'
    }
  }

  const validation = await validateExtractedManifest(tmpRoot, projectId)
  if (!validation.ok) {
    await fse.remove(tmpRoot).catch(() => {})
    return { success: false, message: validation.message }
  }

  try {
    await beforeSwap()
  } catch (err) {
    await fse.remove(tmpRoot).catch(() => {})
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Could not prepare the project for restore'
    }
  }

  try {
    await swapRestoreRoots(projectRoot, tmpRoot)
  } catch (err) {
    await fse.remove(tmpRoot).catch(() => {})
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Restore failed while replacing project files'
    }
  }

  return { success: true, preRestorePath }
}

/** Test helper — reset in-flight state between tests. */
export function __resetBackupStateForTests(): void {
  zipInFlight = null
  pendingAutoRequest = null
  lastExternalCopyAt.clear()
}