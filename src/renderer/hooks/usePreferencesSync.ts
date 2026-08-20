import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { DEFAULT_EDITOR_APPEARANCE, type PriamaPreferences } from '@shared/types'

function applyFromConfig(prefs: PriamaPreferences): void {
  useAppStore.getState().applyWritingPreferences({
    theme: prefs.theme,
    focusMode: prefs.focusMode,
    typewriterScrolling: prefs.typewriterScrolling,
    entityHighlights: prefs.entityHighlights,
    editorAppearance: prefs.editorAppearance ?? DEFAULT_EDITOR_APPEARANCE
  })
}

/** Hydrate writing/theme prefs from config and keep all windows in sync. */
export function usePreferencesSync(): void {
  useEffect(() => {
    void window.electronAPI.tomes.getConfig().then((config) => {
      applyFromConfig(config.preferences)
    })

    const unsubPrefs = window.electronAPI.on('preferences:changed', (data: unknown) => {
      applyFromConfig(data as PriamaPreferences)
    })

    // Legacy channel kept for older main processes mid-upgrade.
    const unsubTheme = window.electronAPI.on('theme:changed', (data: unknown) => {
      const { theme } = data as { theme: 'light' | 'dark' }
      useAppStore.getState().setTheme(theme, { persist: false })
    })

    return () => {
      unsubPrefs()
      unsubTheme()
    }
  }, [])
}

/** @deprecated Prefer usePreferencesSync */
export function useThemeSync(): void {
  usePreferencesSync()
}
