import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import {
  focusChromeActive,
  isWritingSurfaceOpen
} from '@/lib/writingSurface'
import { syncWritingMenuState } from '@/lib/writingMenuSync'
import { mergeWithNext, splitDocumentAtCaret } from '@/lib/documentActions'
import type { EntityHighlights, TypewriterScrolling } from '@shared/types'

/**
 * Wires View-menu focus/typewriter/highlights actions and keeps the
 * application menu checkbox/radio state in sync. Also handles Esc-to-leave
 * when no overlay (search/menus) owns Escape.
 */
export function useFocusMode(): void {
  const nodes = useAppStore((s) => s.nodes)
  const categories = useAppStore((s) => s.categories)
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const selectedContainerId = useAppStore((s) => s.selectedContainerId)
  const focusMode = useAppStore((s) => s.focusMode)
  const typewriterScrolling = useAppStore((s) => s.typewriterScrolling)
  const entityHighlights = useAppStore((s) => s.entityHighlights)
  const isProjectOpen = useAppStore((s) => s.isProjectOpen)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId && !n.deletedAt) ?? null,
    [nodes, selectedNodeId]
  )

  const writingSurfaceOpen = useMemo(
    () =>
      isProjectOpen &&
      isWritingSurfaceOpen({ selectedContainerId, selectedNode, categories }),
    [isProjectOpen, selectedContainerId, selectedNode, categories]
  )

  const chromeActive = focusChromeActive(focusMode, writingSurfaceOpen)

  useEffect(() => {
    document.documentElement.dataset.focusMode = chromeActive ? 'true' : 'false'
    document.documentElement.dataset.entityHighlights = entityHighlights
  }, [chromeActive, entityHighlights])

  useEffect(() => {
    syncWritingMenuState()
  }, [focusMode, writingSurfaceOpen, typewriterScrolling, entityHighlights, selectedNodeId, nodes])

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
  const nodes = useAppStore((s) => s.nodes)
  const categories = useAppStore((s) => s.categories)
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const selectedContainerId = useAppStore((s) => s.selectedContainerId)
  const focusMode = useAppStore((s) => s.focusMode)
  const isProjectOpen = useAppStore((s) => s.isProjectOpen)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId && !n.deletedAt) ?? null,
    [nodes, selectedNodeId]
  )

  return (
    isProjectOpen &&
    focusChromeActive(
      focusMode,
      isWritingSurfaceOpen({ selectedContainerId, selectedNode, categories })
    )
  )
}

export function useWritingSurfaceOpen(): boolean {
  const nodes = useAppStore((s) => s.nodes)
  const categories = useAppStore((s) => s.categories)
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const selectedContainerId = useAppStore((s) => s.selectedContainerId)
  const isProjectOpen = useAppStore((s) => s.isProjectOpen)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId && !n.deletedAt) ?? null,
    [nodes, selectedNodeId]
  )

  return (
    isProjectOpen &&
    isWritingSurfaceOpen({ selectedContainerId, selectedNode, categories })
  )
}
