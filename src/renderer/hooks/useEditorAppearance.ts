import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import type { EditorSizeStep } from '@shared/types'

/**
 * Wires View-menu Editor Appearance actions and Cmd+/Cmd-/Cmd+0 type-size steps.
 * Appearance never rewrites manuscript HTML.
 */
export function useEditorAppearance(): void {
  useEffect(() => {
    const unsubOpen = window.electronAPI.on('menu:editorAppearance', () => {
      useAppStore.getState().setShowEditorAppearanceModal(true)
    })

    const unsubSize = window.electronAPI.on('menu:editorSize', (data: unknown) => {
      const direction = data as EditorSizeStep
      if (direction !== 'in' && direction !== 'out' && direction !== 'reset') return
      useAppStore.getState().stepEditorSize(direction)
    })

    return () => {
      unsubOpen()
      unsubSize()
    }
  }, [])
}
