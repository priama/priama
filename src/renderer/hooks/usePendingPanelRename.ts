import { useCallback, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type RefObject } from 'react'
import { useAppStore } from '@/store/appStore'
import { shouldAutoFocusPendingRename } from '@/lib/pendingRename'

type PendingPanelRename = {
  inputRef: RefObject<HTMLInputElement | null>
  shouldRename: boolean
  handleFocus: (e: FocusEvent<HTMLInputElement>) => void
  handleBlur: () => void
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>, onSave: () => void) => void
}

export function usePendingPanelRename(nodeId: string): PendingPanelRename {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingRenameNodeId = useAppStore((s) => s.pendingRenameNodeId)
  const pendingRenameTargets = useAppStore((s) => s.pendingRenameTargets)
  const shouldRename =
    pendingRenameNodeId === nodeId && pendingRenameTargets.includes('panel')

  const focusAndSelect = useCallback((): boolean => {
    const el = inputRef.current
    if (!el) return false
    el.focus()
    el.select()
    return true
  }, [])

  useLayoutEffect(() => {
    if (!shouldRename || !shouldAutoFocusPendingRename('panel')) return

    if (focusAndSelect()) return

    let raf2 = 0
    let timeoutId = 0
    const raf1 = requestAnimationFrame(() => {
      if (focusAndSelect()) return
      raf2 = requestAnimationFrame(() => {
        if (focusAndSelect()) return
        timeoutId = window.setTimeout(() => {
          focusAndSelect()
        }, 0)
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [shouldRename, nodeId, focusAndSelect])

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (shouldRename) e.currentTarget.select()
    },
    [shouldRename]
  )

  const handleBlur = useCallback(() => {
    if (shouldRename) useAppStore.getState().clearPendingRename()
  }, [shouldRename])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, onSave: () => void) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      onSave()
      useAppStore.getState().clearPendingRename()
    },
    []
  )

  return { inputRef, shouldRename, handleFocus, handleBlur, handleKeyDown }
}
