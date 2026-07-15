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

export function formatBackupZipName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 19)
  return iso.replace(/:/g, '-') + '.zip'
}
