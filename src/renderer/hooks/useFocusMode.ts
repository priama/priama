import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import {
  focusChromeActive,
  isWritingSurfaceOpen
} from '@/lib/writingSurface'
import { syncWritingMenuState } from '@/lib/writingMenuSync'
import { mergeWithNext, splitDocumentAtCaret } from '@/lib/documentActions'
import type { EntityHighlights, TypewriterScrolling } from '@shared/types'

/**
 * Derived inside the selector so callers (the app layout among them) re-render only when
 * the answer flips — not whenever `nodes` changes, e.g. after each content save.
 */
function selectWritingSurfaceOpen(s: ReturnType<typeof useAppStore.getState>): boolean {
  if (!s.isProjectOpen) return false
  const selectedNode = s.selectedNodeId
    ? (s.nodes.find((n) => n.id === s.selectedNodeId && !n.deletedAt) ?? null)
    : null
  return isWritingSurfaceOpen({
    selectedContainerId: s.selectedContainerId,
    selectedNode,
    categories: s.categories
  })
}

/**
 * Wires View-menu focus/typewriter/highlights actions and keeps the
 * application menu checkbox/radio state in sync. Also handles Esc-to-leave
 * when no overlay (search/menus) owns Escape.
 */
export function useFocusMode(): void {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const focusMode = useAppStore((s) => s.focusMode)
  const typewriterScrolling = useAppStore((s) => s.typewriterScrolling)
  const entityHighlights = useAppStore((s) => s.entityHighlights)
  const isProjectOpen = useAppStore((s) => s.isProjectOpen)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const writingSurfaceOpen = useAppStore(selectWritingSurfaceOpen)

  const chromeActive = focusChromeActive(focusMode, writingSurfaceOpen)

  useEffect(() => {
    document.documentElement.dataset.focusMode = chromeActive ? 'true' : 'false'
    document.documentElement.dataset.entityHighlights = entityHighlights
  }, [chromeActive, entityHighlights])

  useEffect(() => {
    syncWritingMenuState()
  }, [
    focusMode,
    writingSurfaceOpen,
    typewriterScrolling,
    entityHighlights,
    selectedNodeId,
    isProjectOpen,
    sidebarWidth
  ])

  // Split/merge enablement follows the tree, but subscribing to `nodes` during render
  // would re-render the whole layout that hosts this hook.
  useEffect(
    () =>
      useAppStore.subscribe((state, prev) => {
        if (state.nodes !== prev.nodes) syncWritingMenuState()
      }),
    []
  )

  useEffect(() => {
    const unsubToggle = window.electronAPI.on('menu:toggleFocusMode', () => {
      const state = useAppStore.getState()
      const node =
        state.nodes.find((n) => n.id === state.selectedNodeId && !n.deletedAt) ?? null
      const canFocus = isWritingSurfaceOpen({
        selectedContainerId: state.selectedContainerId,
        selectedNode: node,
        categories: state.categories
      })
      if (!canFocus && !state.focusMode) return
      if (!canFocus && state.focusMode) {
        state.setFocusMode(false)
        return
      }
      state.toggleFocusMode()
    })

    const unsubTypewriter = window.electronAPI.on(
      'menu:setTypewriterScrolling',
      (data: unknown) => {
        useAppStore
          .getState()
          .setTypewriterScrolling(data as TypewriterScrolling)
      }
    )

    const unsubHighlights = window.electronAPI.on(
      'menu:setEntityHighlights',
      (data: unknown) => {
        useAppStore.getState().setEntityHighlights(data as EntityHighlights)
      }
    )

    const unsubSplit = window.electronAPI.on('menu:splitDocument', () => {
      void splitDocumentAtCaret()
    })
    const unsubMerge = window.electronAPI.on('menu:mergeWithNext', () => {
      void mergeWithNext()
    })

    return () => {
      unsubToggle()
      unsubTypewriter()
      unsubHighlights()
      unsubSplit()
      unsubMerge()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (e.defaultPrevented) return

      const state = useAppStore.getState()
      if (!state.focusMode) return

      // Search / dialogs / overlays should preventDefault first.
      const openDialog = document.querySelector('[role="dialog"][data-state="open"]')
      if (openDialog) return

      e.preventDefault()
      state.setFocusMode(false)
    }

    // Bubble phase so capture handlers (search) run first.
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

/** Whether focus chrome (hidden panels) should currently apply. */
export function useFocusChromeActive(): boolean {
  const focusMode = useAppStore((s) => s.focusMode)
  const writingSurfaceOpen = useAppStore(selectWritingSurfaceOpen)
  return focusChromeActive(focusMode, writingSurfaceOpen)
}

export function useWritingSurfaceOpen(): boolean {
  return useAppStore(selectWritingSurfaceOpen)
}
