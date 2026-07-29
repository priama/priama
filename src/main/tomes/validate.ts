import { readFile } from 'fs/promises'
import fse from 'fs-extra'
import { join } from 'path'
import type { TomesManifest } from '@shared/types'
import { TOMES_MAGIC, PROJECT_FILENAME } from '@shared/types'
import { getProjectRoot } from './paths'
import { restoreProjectTomesFromLatestBackup } from './backup'

export interface ValidationResult {
  valid: boolean
  error?: string
  manifest?: TomesManifest
  projectRoot?: string
  restoredFromBackup?: boolean
}

export async function validateTomesFile(tomesPath: string): Promise<ValidationResult> {
  if (!tomesPath.endsWith(PROJECT_FILENAME) && !tomesPath.endsWith('.tomes')) {
    return { valid: false, error: 'File must be a project.tomes file' }
  }

  if (!(await fse.pathExists(tomesPath))) {
    return { valid: false, error: 'Project file not found' }
  }

  let manifest: TomesManifest
  let restoredFromBackup = false
  const projectRoot = getProjectRoot(tomesPath)
  try {
    const raw = await readFile(tomesPath, 'utf-8')
    if (!raw.trim()) throw new Error('empty manifest')
    manifest = JSON.parse(raw) as TomesManifest
  } catch {
    const restored = await restoreProjectTomesFromLatestBackup(projectRoot)
    if (!restored) {
      return { valid: false, error: 'Project file is corrupted or invalid JSON' }
    }
    restoredFromBackup = true
    try {
      const raw = await readFile(tomesPath, 'utf-8')
      manifest = JSON.parse(raw) as TomesManifest
    } catch {
      return { valid: false, error: 'Project file is corrupted or invalid JSON' }
    }
  }

  if (manifest.__tomes !== TOMES_MAGIC) {
    return { valid: false, error: 'Not a valid Priama project file' }
  }

  if (!manifest.title || !manifest.version || !manifest.id) {
    return { valid: false, error: 'Project file is missing required fields' }
  }

  const requiredDirs = [
    join(projectRoot, 'manuscript'),
    join(projectRoot, 'wiki')
  ]

  for (const dir of requiredDirs) {
    if (!(await fse.pathExists(dir))) {
      return { valid: false, error: 'Project folder structure is incomplete' }
    }
  }

  return { valid: true, manifest, projectRoot, restoredFromBackup }
}
