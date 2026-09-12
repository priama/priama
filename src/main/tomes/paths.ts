import { join, basename, dirname } from 'path'
import { platform } from 'process'

export function sanitizeFolderName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'Untitled Project'
}

export function getProjectRoot(tomesPath: string): string {
  return dirname(tomesPath)
}

export function getTomesPath(projectRoot: string): string {
  return join(projectRoot, 'project.tomes')
}

export function getManuscriptDir(projectRoot: string): string {
  return join(projectRoot, 'manuscript')
}

export function getWikiDir(projectRoot: string): string {
  return join(projectRoot, 'wiki')
}

export function getAssetsDir(projectRoot: string): string {
  return join(projectRoot, 'assets')
}

export function getCharacterImagesDir(projectRoot: string): string {
  return join(getWikiDir(projectRoot), 'characters', 'images')
}

export function getLocationImagesDir(projectRoot: string): string {
  return join(getWikiDir(projectRoot), 'locations', 'images')
}

export function getLoreImagesDir(projectRoot: string): string {
  return join(getWikiDir(projectRoot), 'lore', 'images')
}

export function getEntryImagesDir(projectRoot: string): string {
  return join(getWikiDir(projectRoot), 'entries', 'images')
}

export function getBackupsDir(projectRoot: string): string {
  return join(projectRoot, 'backups')
}

/** Unscanned folder for duplicate/unplaceable .txd files found on open. */
export const RECOVERY_DIR_NAME = '.recovery'

export function getRecoveryDir(projectRoot: string): string {
  return join(projectRoot, RECOVERY_DIR_NAME)
}

export function getNodeDir(projectRoot: string, type: string, scope?: string): string {
  switch (type) {
    case 'chapter':
    case 'scene':
      return getManuscriptDir(projectRoot)
    case 'folder':
      if (scope === 'manuscript' || !scope) {
        return join(getManuscriptDir(projectRoot), 'folders')
      }
      return join(getWikiDir(projectRoot), scope, 'folders')
    case 'character':
      return join(getWikiDir(projectRoot), 'characters')
    case 'location':
      return join(getWikiDir(projectRoot), 'locations')
    case 'lore':
      return join(getWikiDir(projectRoot), 'lore')
    case 'note':
      return join(getWikiDir(projectRoot), 'notes')
    case 'entry':
      return join(getWikiDir(projectRoot), 'entries')
    default:
      return getWikiDir(projectRoot)
  }
}

export function detectPathLabel(path: string): string {
  const lower = path.toLowerCase()
  if (lower.includes('icloud')) return 'iCloud Drive'
  if (lower.includes('google drive')) return 'Google Drive'
  if (lower.includes('mega')) return 'MEGA'
  if (platform === 'darwin' && path.startsWith('/Volumes/')) return 'External Drive'
  if (platform === 'win32') {
    const drive = path.slice(0, 2).toUpperCase()
    if (drive && drive !== 'C:' && /^[A-Z]:/.test(drive)) return 'External Drive'
  }
  return 'Local Folder'
}


export function getProjectFolderName(projectRoot: string): string {
  return basename(projectRoot)
}

/** UTC ISO-ish stamp used in backup zip filenames: `2026-08-21T08-12-00`. */
export function formatBackupIsoStamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace(/:/g, '-')
}

export function formatBackupZipName(date = new Date()): string {
  return formatBackupIsoStamp(date) + '.zip'
}

export function formatNamedBackupZipName(slug: string, date = new Date()): string {
  const safe = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const base = formatBackupIsoStamp(date)
  return safe ? `${base}__${safe}.zip` : `${base}.zip`
}

export function formatPreRestoreBackupZipName(date = new Date()): string {
  return `${formatBackupIsoStamp(date)}__before-restore.zip`
}
