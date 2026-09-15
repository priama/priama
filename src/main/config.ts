import { app } from 'electron'
import { join } from 'path'
import fse from 'fs-extra'
import type { PriamaConfig, RecentProjectEntry, PriamaPreferences } from '@shared/types'
import { COVER_COLORS, DEFAULT_EDITOR_APPEARANCE, clampEditorAppearance } from '@shared/types'
const CONFIG_FILENAME = 'priama-config.json'

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILENAME)
}

function defaultPreferences(): PriamaPreferences {
  return {
    maxBackupsPerLocation: 10,
    theme: 'dark',
    focusMode: false,
    typewriterScrolling: 'focus',
    entityHighlights: 'hide-in-focus',
    editorAppearance: { ...DEFAULT_EDITOR_APPEARANCE }
  }
}

function normalizePreferences(prefs: Partial<PriamaPreferences> | undefined): PriamaPreferences {
  const merged = { ...defaultPreferences(), ...prefs }
  merged.editorAppearance = clampEditorAppearance(prefs?.editorAppearance ?? merged.editorAppearance)
  return merged
}

function defaultConfig(): PriamaConfig {
  return {
    version: '1.0',
    recentProjects: [],
    backupLocations: {},
    preferences: defaultPreferences()
  }
}

let cachedConfig: PriamaConfig | null = null

async function loadConfig(): Promise<PriamaConfig> {
  const configPath = getConfigPath()
  if (!(await fse.pathExists(configPath))) {
    cachedConfig = defaultConfig()
    await saveConfig(cachedConfig)
    return cachedConfig
  }

  try {
    const raw = await fse.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as PriamaConfig
    cachedConfig = {
      ...defaultConfig(),
      ...parsed,
      preferences: normalizePreferences(parsed.preferences)
    }
    return cachedConfig
  } catch {
    cachedConfig = defaultConfig()
    return cachedConfig
  }
}

async function saveConfig(config: PriamaConfig): Promise<void> {
  const configPath = getConfigPath()
  await fse.ensureDir(app.getPath('userData'))
  await fse.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  cachedConfig = config
}

export async function getConfig(): Promise<PriamaConfig> {
  if (cachedConfig) return cachedConfig
  return loadConfig()
}

function pickCoverColor(): string {
  return COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)]
}

export async function addRecentProject(entry: Omit<RecentProjectEntry, 'coverColor' | 'lastOpened'> & {
  coverColor?: string
  lastOpened?: string
}): Promise<RecentProjectEntry> {
  const config = await getConfig()
  const now = new Date().toISOString()
  const existing = config.recentProjects.find((p) => p.id === entry.id)
  const full: RecentProjectEntry = {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    primaryPath: entry.primaryPath,
    lastOpened: entry.lastOpened ?? now,
    coverColor: entry.coverColor ?? existing?.coverColor ?? pickCoverColor()
  }

  config.recentProjects = config.recentProjects.filter((p) => p.id !== full.id)
  config.recentProjects.unshift(full)
  config.recentProjects = config.recentProjects.slice(0, 20)
  await saveConfig(config)
  return full
}

export async function updateRecentLastOpened(projectId: string): Promise<void> {
  const config = await getConfig()
  const entry = config.recentProjects.find((p) => p.id === projectId)
  if (!entry) return

  entry.lastOpened = new Date().toISOString()
  config.recentProjects = [
    entry,
    ...config.recentProjects.filter((p) => p.id !== projectId)
  ]
  await saveConfig(config)
}

export async function removeFromRecent(projectId: string): Promise<void> {
  const config = await getConfig()
  config.recentProjects = config.recentProjects.filter((p) => p.id !== projectId)
  delete config.backupLocations[projectId]
  await saveConfig(config)
}

export async function setBackupLocations(projectId: string, paths: string[]): Promise<void> {
  const config = await getConfig()
  config.backupLocations[projectId] = paths
  await saveConfig(config)
}

export async function getBackupLocations(projectId: string): Promise<string[]> {
  const config = await getConfig()
  return config.backupLocations[projectId] ?? []
}

export async function updatePreferences(updates: Partial<PriamaPreferences>): Promise<PriamaPreferences> {
  const config = await getConfig()
  const next: PriamaPreferences = {
    ...config.preferences,
    ...updates,
    editorAppearance: clampEditorAppearance(
      updates.editorAppearance !== undefined
        ? { ...config.preferences.editorAppearance, ...updates.editorAppearance }
        : config.preferences.editorAppearance
    )
  }
  config.preferences = next
  await saveConfig(config)
  return config.preferences
}

export async function updateWindowLayout(
  updates: Partial<import('@shared/types').WindowLayoutState>
): Promise<import('@shared/types').WindowLayoutState> {
  const config = await getConfig()
  const defaults: import('@shared/types').WindowLayoutState = {
    sidebarWidth: 280,
    rightPanelWidth: 320,
    secondaryWindows: []
  }
  config.windowLayout = { ...defaults, ...config.windowLayout, ...updates }
  await saveConfig(config)
  return config.windowLayout
}

export async function getWindowLayout(): Promise<import('@shared/types').WindowLayoutState> {
  const config = await getConfig()
  return (
    config.windowLayout ?? {
      sidebarWidth: 280,
      rightPanelWidth: 320,
      secondaryWindows: []
    }
  )
}

export async function updateRecentPrimaryPath(projectId: string, primaryPath: string): Promise<void> {
  const config = await getConfig()
  const entry = config.recentProjects.find((p) => p.id === projectId)
  if (entry) {
    entry.primaryPath = primaryPath
    await saveConfig(config)
  }
}

export async function updateRecentTitle(projectId: string, title: string): Promise<void> {
  const config = await getConfig()
  const entry = config.recentProjects.find((p) => p.id === projectId)
  if (entry) {
    entry.title = title
    await saveConfig(config)
  }
}
