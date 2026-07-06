import { useCallback, useLayoutEffect, useRef, type FocusEvent, type RefObject } from 'react'
import { useAppStore } from '@/store/appStore'

type PendingPanelRename = {
  inputRef: RefObject<HTMLInputElement | null>
  shouldRename: boolean
  handleFocus: (e: FocusEvent<HTMLInputElement>) => void
  handleBlur: () => void
}

export function usePendingPanelRename(nodeId: string): PendingPanelRename {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingRenameNodeId = useAppStore((s) => s.pendingRenameNodeId)
  const pendingRenameTarget = useAppStore((s) => s.pendingRenameTarget)
  const shouldRename =
    pendingRenameNodeId === nodeId && pendingRenameTarget === 'panel'

  const focusAndSelect = useCallback((): boolean => {
    const el = inputRef.current
    if (!el) return false
    el.focus()
    el.select()
    return true
  }, [])

  useLayoutEffect(() => {
    if (!shouldRename) return

    if (focusAndSelect()) return

    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      if (focusAndSelect()) return
      raf2 = requestAnimationFrame(() => {
        focusAndSelect()
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
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

  return { inputRef, shouldRename, handleFocus, handleBlur }
}
